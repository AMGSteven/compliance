import fetch from 'node-fetch';
export class WebreconChecker {
    constructor() {
        this.loginUrl = 'https://www.webrecon.net/a/login';
        this.apiUrl = 'https://www.webrecon.net/api/phone_scrub';
        this.name = 'Webrecon';
    }
    async ensureAuthenticated() {
        if (this.sessionCookie)
            return;
        const response = await fetch(this.loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'americanhm',
                password: 'Reuc82TA3',
            }),
        });
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        const setCookie = response.headers.get('set-cookie');
        if (!setCookie) {
            throw new Error('No session cookie received');
        }
        this.sessionCookie = setCookie;
    }
    async checkNumber(phoneNumber) {
        try {
            await this.ensureAuthenticated();
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.sessionCookie,
                },
                body: JSON.stringify({ phoneNumber }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return {
                isCompliant: !data.match,
                reasons: data.match ? [`Match found: ${data.matchType} (${data.dateFound})`] : [],
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
