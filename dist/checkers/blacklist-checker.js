import fetch from 'node-fetch';
export class BlacklistChecker {
    constructor() {
        this.baseUrl = 'https://api.blacklist-alliance.com/standard/api/v1';
        this.name = 'Blacklist Alliance';
        this.apiKey = '2tMFT86TJpyTQfAyRBae';
    }
    async checkNumber(phoneNumber) {
        try {
            const response = await fetch(`${this.baseUrl}/lookup/single/${phoneNumber}`, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return {
                isCompliant: !data.found,
                reasons: data.found && data.details ? [`${data.details.reason} (${data.details.date_added})`] : [],
                source: this.name,
                phoneNumber,
                rawResponse: data,
            };
        }
        catch (error) {
            return {
                isCompliant: false,
                reasons: [],
                source: this.name,
                phoneNumber,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
