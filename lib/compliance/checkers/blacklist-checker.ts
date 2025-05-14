import { ComplianceChecker, ComplianceResult, BlacklistAllianceResponse } from '../types';
import fetch from 'node-fetch';

export class BlacklistChecker implements ComplianceChecker {
  private readonly baseUrl = 'https://api.blacklistalliance.net';
  private readonly apiKey: string;
  name = 'Blacklist Alliance';

  constructor() {
    const apiKey = process.env.BLACKLIST_ALLIANCE_API_KEY;
    if (!apiKey) {
      throw new Error('BLACKLIST_ALLIANCE_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  async checkNumber(phoneNumber: string): Promise<ComplianceResult> {
    try {
      // Remove any non-numeric characters from the phone number
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      const response = await fetch(`${this.baseUrl}/lookup?phone=${cleanNumber}&key=${this.apiKey}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as BlacklistAllianceResponse;

      return {
        isCompliant: !data.found,
        reasons: data.found && data.details ? [`${data.details.reason} (${data.details.date_added})`] : [],
        source: this.name,
        phoneNumber,
        details: data.details,
        rawResponse: data,
      };
    } catch (error) {
      console.error("THIS FAILED")
      return {
        isCompliant: false,
        reasons: [],
        source: this.name,
        phoneNumber,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
