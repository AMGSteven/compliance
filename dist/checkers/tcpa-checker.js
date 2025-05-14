import fetch from 'node-fetch';
export class TCPAChecker {
    constructor() {
        this.baseUrl = 'https://api.tcpalitigatorlist.com';
        this.name = 'TCPA Litigator List';
        const credentials = Buffer.from('tcpa_tI0B1esXbt:CPFC jkfP pWbB KOlN 11x2 5oVR').toString('base64');
        this.auth = `Basic ${credentials}`;
    }
    async checkNumber(phoneNumber) {
        try {
            const response = await fetch(`${this.baseUrl}/scrub/phone/`, {
                method: 'POST',
                headers: {
                    'Authorization': this.auth,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `type=["tcpa","dnc"]&phone_number=${phoneNumber}`,
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return {
                isCompliant: data.results.clean === 1,
                reasons: data.results.status_array || [],
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
