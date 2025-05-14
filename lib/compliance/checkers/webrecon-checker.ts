import { ComplianceChecker, ComplianceResult, WebreconResponse } from '../types';
import fetch from 'node-fetch';

export class WebreconChecker implements ComplianceChecker {
  private readonly apiUrl: string;
  name = 'Webrecon';

  constructor() {
    const apiKey = process.env.WEBRECON_API_KEY;
    if (!apiKey) {
      throw new Error('WEBRECON_API_KEY environment variable is required');
    }
    this.apiUrl = `https://api.webrecon.net/phone_scrub/${apiKey}`;
  }

  async checkNumber(phoneNumber: string): Promise<ComplianceResult> {
    try {
      // Remove any non-numeric characters from the phone number
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          Phones: cleanNumber
        }]),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as any;
      const row = data.Rows[0];
      const score = row.Scores;
      const isCompliant = score === '0'; // 0 means no hit, 1 means hit, 'E' means error

      return {
        isCompliant,
        reasons: !isCompliant ? ['Phone number found in Webrecon database'] : [],
        source: this.name,
        phoneNumber,
        details: {},
        rawResponse: data,
      };
    } catch (error) {
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
