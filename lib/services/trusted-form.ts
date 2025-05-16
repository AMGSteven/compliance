import { prisma } from '../prisma';
const API_KEY = process.env.TRUSTED_FORM_API_KEY;
const BASE_URL = 'https://cert.trustedform.com';

interface TrustedFormResponse {
  outcome: boolean;
  match_lead?: {
    email?: string;
    phone?: string;
  };
  insights?: {
    properties?: {
      page_url?: string;
      created_at?: string;
      expires_at?: string;
      form_input_method?: string;
      form_input_kpm?: number;
      form_input_wpm?: number;
      ip?: string;
      browser?: string;
      os?: string;
      location?: {
        city?: string;
        state?: string;
        country?: string;
      };
    };
  };
}

export class TrustedFormService {
  static async listRetainedCertificates(page: number = 1, limit: number = 10) {
    try {
      const where = { status: 'active' };
      const [total, records] = await Promise.all([
        prisma.trusted_form_certificates.count({ where }),
        prisma.trusted_form_certificates.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
        }),
      ]);

      return {
        success: true,
        data: records,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error fetching retained certificates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async verifyCertificate(certificateId: string, data: {
    email?: string;
    phone?: string;
    reference?: string;
    vendor?: string;
  }) {
    try {
      // Extract certificate ID from URL or use as is
      const certId = certificateId.startsWith('http') 
        ? certificateId.split('/').pop() 
        : certificateId;
      
      // First try to get the certificate info
      let response = await fetch(`${BASE_URL}/certificates/${certId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      // If not found, try to claim it
      if (response.status === 404) {
        response = await fetch(`${BASE_URL}/certificates/${certId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Only send lead data for matching
          match_lead: {
            ...(data.email && { email: data.email }),
            ...(data.phone && { phone: data.phone }),
          },
          // Request additional insights
          insights: {
            properties: [
              'page_url',
              'created_at',
              'expires_at',
              'form_input_method',
              'form_input_kpm',
              'form_input_wpm',
              'ip',
              'browser',
              'os',
              'location',
            ],
          },
        }),
      });
      }

      if (!response.ok) {
        throw new Error(`TrustedForm API error: ${response.statusText}`);
      }

      const result: TrustedFormResponse = await response.json();

      // Store the certificate data in our database
      if (result.outcome) {
        await prisma.trusted_form_certificates.create({
          data: {
            certificate_id: certificateId,
            phone_number: data.phone || '',
            email: data.email,
            expires_at: new Date(result.insights?.properties?.expires_at || ''),
            page_url: result.insights?.properties?.page_url || '',
            reference: data.reference,
            vendor: data.vendor,
            metadata: {
              created_at: result.insights?.properties?.created_at,
              form_input_method: result.insights?.properties?.form_input_method,
              form_input_kpm: result.insights?.properties?.form_input_kpm,
              form_input_wpm: result.insights?.properties?.form_input_wpm,
            },
          },
        });
      }

      return result;
    } catch (error) {
      console.error('Error verifying TrustedForm certificate:', error);
      throw error;
    }
  }

  static async getCertificateRecords(params: {
    phone_number?: string;
    email?: string;
    page?: number;
    limit?: number;
  }) {
    const { phone_number, email, page = 1, limit = 10 } = params;

    const where = {
      ...(phone_number && { phone_number }),
      ...(email && { email }),
      status: 'active',
    };

    const [total, records] = await Promise.all([
      prisma.trusted_form_certificates.count({ where }),
      prisma.trusted_form_certificates.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
    ]);

    return {
      records,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
