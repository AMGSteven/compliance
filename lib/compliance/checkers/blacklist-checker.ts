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

      // Parse the response to determine if the number is blacklisted
      let isBlacklisted = false;
      let reason = '';

      // If message is "Good" or code is "good", the number is explicitly good
      if (data.message === "Good" || data.code === "good") {
        isBlacklisted = false;
      }
      // If message contains "Blacklisted" or code indicates a problem, it's blacklisted
      else if (
        data.message?.toLowerCase().includes("blacklist") ||
        (data.code && data.code !== "good")
      ) {
        isBlacklisted = true;
        reason = data.code ? `${data.message} (${data.code})` : data.message;
      }
      // Default case - if we can't determine status, assume it's good
      else {
        isBlacklisted = false;
      }
      
      return {
        isCompliant: !isBlacklisted,
        reasons: isBlacklisted ? [reason] : [],
        source: this.name,
        phoneNumber,
        details: {
          carrier: data.carrier,
          code: data.code,
          message: data.message
        },
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
