import { ComplianceChecker, ComplianceResult } from '../types';
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';
type ErrorWithMessage = { message: string };
type DNCMetadata = {
  campaign?: string;
  agentId?: string;
  dialerTimestamp?: string;
  customData?: any;
  lastUpdated?: string;
};

export type DNCEntry = {
  phone_number: string;
  date_added: Date;
  reason: string;
  source: string;
  added_by: string;
  status: string;
  metadata: Prisma.JsonValue;
  expiration_date?: Date | null;
};

export class InternalDNCChecker implements ComplianceChecker {
  name = 'Internal DNC List';
  private initialized: Promise<void>;

  constructor() {
    this.initialized = this.initializeDatabase();
  }

  private async initializeDatabase() {
    // Add test number if it doesn't exist
    await this.addToDNC({
      phone_number: '9999999999',
      reason: 'Test number - automatically blocked',
      source: 'system_seed',
      added_by: 'system',
      metadata: { customData: { isTestNumber: true } }
    });
  }

  async checkNumber(phoneNumber: string): Promise<ComplianceResult> {
    await this.initialized;
    const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
    
    try {
      const dncEntry = await prisma.dNCEntry.findFirst({
        where: {
          phone_number: normalizedNumber,
          status: 'active',
          OR: [
            { expiration_date: null },
            { expiration_date: { gt: new Date() } }
          ]
        }
      });

      return {
        isCompliant: !dncEntry,
        reasons: dncEntry ? [dncEntry.reason] : [],
        source: this.name,
        details: dncEntry?.metadata || {},
        phoneNumber: normalizedNumber,
        rawResponse: dncEntry
      };
    } catch (error) {
      console.error('Error checking DNC:', error);
      const err = error as ErrorWithMessage;
      return {
        isCompliant: true, // Fail open if DB error
        reasons: [`Error checking DNC: ${err.message}`],
        source: this.name,
        details: {},
        phoneNumber: normalizedNumber,
        error: err.message
      };
    }
  }

  async addToDNC(entry: Partial<DNCEntry>): Promise<DNCEntry> {
    const normalizedEntry = {
      phone_number: this.normalizePhoneNumber(entry.phone_number!),
      date_added: new Date(),
      reason: entry.reason || 'Added to DNC',
      source: entry.source || 'manual',
      added_by: entry.added_by || 'system',
      status: 'active',
      metadata: entry.metadata || {},
      expiration_date: entry.expiration_date
    };

    try {
      const result = await prisma.dNCEntry.upsert({
        where: { phone_number: normalizedEntry.phone_number },
        update: {
          ...normalizedEntry,
          metadata: {
            ...(normalizedEntry.metadata as any),
            lastUpdated: new Date().toISOString()
          }
        },
        create: normalizedEntry
      });

      await this.notifyWebhooks(result);
      return result;
    } catch (error) {
      console.error('Error adding to DNC:', error);
      const err = error as ErrorWithMessage;
      throw new Error(err.message);
    }
  }

  async bulkAddToDNC(entries: Partial<DNCEntry>[]): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    errors: Array<{ phone_number: string; error: string }>;
  }> {
    const results = {
      totalProcessed: entries.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ phone_number: string; error: string }>
    };

    for (const entry of entries) {
      try {
        await this.addToDNC(entry);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          phone_number: entry.phone_number!,
          error: (error as Error).message
        });
      }
    }

    return results;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.toString().replace(/\D/g, '');
    
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    return '+' + cleaned;
  }

  private async notifyWebhooks(dncEntry: DNCEntry) {
    const webhookUrl = process.env.DNC_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'dnc_added',
          data: dncEntry,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.error('Webhook notification failed:', await response.text());
      }
    } catch (error) {
      console.error('Webhook notification failed:', error);
    }
  }
}
