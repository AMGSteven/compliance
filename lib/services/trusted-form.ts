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

  /**
   * Retain a TrustedForm certificate using the Retain API v4.0
   * @param certificateUrl - The TrustedForm certificate URL
   * @param leadData - Lead data for matching (email, phone)
   * @param options - Optional metadata (reference, vendor)
   */
  static async retainCertificate(
    certificateUrl: string,
    leadData: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    },
    options: {
      reference?: string;
      vendor?: string;
    } = {}
  ) {
    try {
      if (!API_KEY) {
        throw new Error('TrustedForm API key not configured');
      }

      // Extract certificate ID from URL
      const certificateId = certificateUrl.startsWith('http') 
        ? certificateUrl.split('/').pop() 
        : certificateUrl;
      
      if (!certificateId) {
        throw new Error('Invalid certificate URL: cannot extract certificate ID');
      }

      console.log(`[TrustedForm] Retaining certificate: ${certificateId}`);

      // Build request body - match_lead is always required for v4.0 retain operations
      const requestBody = {
        match_lead: {
          // Include actual data if available, otherwise use minimal structure
          ...(leadData.email && leadData.email.trim() && { email: leadData.email.trim() }),
          ...(leadData.phone && leadData.phone.trim() && { phone: leadData.phone.trim() }),
          // If no lead data, TrustedForm might still require the parameter present
        },
        retain: {
          ...(options.reference && { reference: options.reference }),
          ...(options.vendor && { vendor: options.vendor }),
        },
      };

      console.log(`[TrustedForm] Request body:`, JSON.stringify(requestBody, null, 2));

      // Call TrustedForm Retain API v4.0
      const response = await fetch(`https://cert.trustedform.com/${certificateId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
          'Content-Type': 'application/json',
          'Api-Version': '4.0',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      
      console.log(`[TrustedForm] Retain API response:`, {
        status: response.status,
        success: response.ok,
        certificateId,
        result: JSON.stringify(result).substring(0, 200)
      });

      // Store the result in our database using the correct schema
      if (response.ok) {
        try {
          // Use Supabase client instead of Prisma to match the actual schema
          const { createServerClient } = await import('@/lib/supabase/server');
          const supabase = createServerClient();
          
          const { error: insertError } = await supabase
            .from('trusted_form_certificates')
            .upsert({
              certificate_url: certificateUrl,
              status: 'verified',
              verified_at: new Date().toISOString(),
              metadata: {
                ...result,
                retained_at: new Date().toISOString(),
                reference: options.reference,
                vendor: options.vendor,
                lead_data: leadData,
              },
            });
            
          if (insertError) {
            console.error('[TrustedForm] Error storing certificate:', insertError);
          } else {
            console.log('[TrustedForm] Certificate stored successfully');
          }
        } catch (dbError) {
          console.error('[TrustedForm] Database error:', dbError);
          // Don't throw here - retention was successful, just storage failed
        }
      }

      return {
        success: response.ok,
        certificateId,
        status: response.status,
        data: result,
        error: response.ok ? null : (result.message || 'Retain API failed'),
      };
    } catch (error) {
      console.error('[TrustedForm] Error retaining certificate:', error);
      return {
        success: false,
        certificateId: null,
        status: 500,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
