#!/usr/bin/env tsx

/**
 * Script to re-post leads that failed webhooks to Internal Dialer
 * Date: July 7th, 2025 between 6:00 AM PT and 9:00 AM PT (13:00-16:00 UTC)
 * 
 * Usage: npx tsx scripts/repost-failed-webhooks-july7.ts
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Time range for failed webhooks (July 7th, 2025 6:00 AM - 9:00 AM PT)
const FAILURE_START_TIME = '2025-07-07 13:00:00+00';  // 6:00 AM PT = 13:00 UTC
const FAILURE_END_TIME = '2025-07-07 16:00:00+00';    // 9:00 AM PT = 16:00 UTC

// Dialer payload interface
interface DialerPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  source: string;
  trusted_form_cert_url: string;
  transaction_id: string;
  income_bracket: string;
  dob: string;
  homeowner_status: string;
  custom_fields: Record<string, any>;
  list_id: string;
  campaign_id: string;
  cadence_id: string | null;
  compliance_lead_id: string;
}

// Default routing configuration for Internal Dialer
const DEFAULT_ROUTING = {
  campaign_id: 'default-campaign',
  cadence_id: 'default-cadence',
  token: '7f108eff2dbf3ab07d562174da6dbe53'
};

async function getFailedWebhookLeads() {
  console.log('Fetching leads that likely failed webhook posting during the specified time window...');
  
  // Get leads created during the failure window that were routed to Internal Dialer
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      created_at,
      first_name,
      last_name,
      phone,
      email,
      list_id,
      custom_fields,
      address,
      city,
      state,
      zip_code,
      gender,
      trusted_form_cert_url,
      sub_id,
      campaign_id,
      cadence_id,
      income_bracket,
      homeowner_status,
      transaction_id,
      birth_date,
      age_range
    `)
    .gte('created_at', FAILURE_START_TIME)
    .lte('created_at', FAILURE_END_TIME)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }

  console.log(`Found ${leads?.length || 0} leads created during failure window`);
  
  // Analyze routing types and filter leads
  const dialerTypeCounts: Record<string, number> = {};
  const internalDialerLeads = [];
  const pitchBpoLeads = [];
  
  console.log('\nAnalyzing routing data for leads...');
  
  for (const lead of leads || []) {
    const routingData = await getRoutingData(lead.list_id);
    if (routingData) {
      const dialerType = routingData.dialer_type || 'unknown';
      dialerTypeCounts[dialerType] = (dialerTypeCounts[dialerType] || 0) + 1;
      
      if (routingData.dialer_type === 1) {
        internalDialerLeads.push(lead);
      } else if (routingData.dialer_type === 2) {
        pitchBpoLeads.push(lead);
      }
    } else {
      dialerTypeCounts['no_routing'] = (dialerTypeCounts['no_routing'] || 0) + 1;
    }
  }
  
  console.log('\n📊 Dialer type breakdown:');
  Object.entries(dialerTypeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} leads`);
  });
  
  console.log(`\nFound ${internalDialerLeads.length} leads for Internal Dialer`);
  console.log(`Found ${pitchBpoLeads.length} leads for Pitch BPO`);
  
  // For now, let's focus on Internal Dialer leads since that's what the user mentioned
  // But if there are no internal leads, we could potentially retry Pitch BPO as well
  if (internalDialerLeads.length === 0 && pitchBpoLeads.length > 0) {
    console.log('\n⚠️  No Internal Dialer leads found, but found Pitch BPO leads.');
    console.log('Would you like to retry Pitch BPO leads as well? (This script focuses on Internal Dialer)');
  }
  
  return internalDialerLeads;
}

async function getRoutingData(listId: string) {
  const { data: routingResults, error: routingError } = await supabase
    .from('list_routings')
    .select('*')
    .eq('list_id', listId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
    
  if (routingError) {
    console.error('Error looking up list routing:', routingError);
    return null;
  }
  
  return routingResults;
}

async function postToInternalDialer(lead: any): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    // Get routing data for this list_id
    const routingData = await getRoutingData(lead.list_id);
    
    if (!routingData || routingData.dialer_type !== 1) {
      return {
        success: false,
        error: 'Lead is not configured for Internal Dialer (dialer_type must be 1)'
      };
    }
    
    // Format phone number (remove non-digits and ensure 10 digits)
    const formattedPhone = lead.phone.replace(/\D/g, '');
    
    if (formattedPhone.length !== 10) {
      return {
        success: false,
        error: `Invalid phone number: ${lead.phone} (formatted: ${formattedPhone})`
      };
    }
    
    // Extract fields exactly like the /api/leads endpoint
    const firstName = lead.first_name || '';
    const lastName = lead.last_name || '';
    const email = lead.email || '';
    const state = lead.state || '';
    const zipCode = lead.zip_code || '';
    const trustedFormCertUrl = lead.trusted_form_cert_url || '';
    
    // Handle demographic fields with fallbacks
    const ageRange = lead.age_range || lead.custom_fields?.age_range || '';
    const birthDate = lead.birth_date || lead.custom_fields?.birth_date || '';
    const homeownerStatus = lead.homeowner_status || lead.custom_fields?.homeowner_status || '';
    const incomeBracket = lead.income_bracket || lead.custom_fields?.income_bracket || '';
    
    // Use routing data or fallback to defaults
    const effectiveCampaignId = routingData.campaign_id || DEFAULT_ROUTING.campaign_id;
    const effectiveCadenceId = routingData.cadence_id || DEFAULT_ROUTING.cadence_id;
    const authToken = routingData.token || DEFAULT_ROUTING.token;
    
    // Build dialer payload exactly like the original /api/leads endpoint
    const dialerPayload: DialerPayload = {
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: formattedPhone,
      address: lead.address || '',
      city: lead.city || '',
      state: state,
      zip_code: zipCode,
      source: 'webhook-retry',
      trusted_form_cert_url: trustedFormCertUrl,
      transaction_id: lead.transaction_id || lead.id,
      income_bracket: incomeBracket,
      dob: birthDate,
      homeowner_status: homeownerStatus,
      custom_fields: {
        ...lead.custom_fields,
        webhook_retry: true,
        original_created_at: lead.created_at,
        retry_timestamp: new Date().toISOString()
      },
      list_id: lead.list_id,
      campaign_id: effectiveCampaignId,
      cadence_id: effectiveCadenceId,
      compliance_lead_id: lead.id
    };

    console.log(`  Posting ${firstName} ${lastName} (${formattedPhone}) to Internal Dialer...`);
    
    // Construct Internal Dialer URL exactly like /api/leads endpoint
    const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
    dialerUrl.searchParams.append('list_id', lead.list_id);
    dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
    dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
    dialerUrl.searchParams.append('token', authToken);

    // Post to Internal Dialer
    const response = await fetch(dialerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dialerPayload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${JSON.stringify(result)}`
      };
    }

    return {
      success: true,
      response: result
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log('🚀 Starting failed webhook lead re-posting script...');
  console.log(`Target time range: July 7th, 2025 6:00 AM PT to 9:00 AM PT`);
  console.log(`UTC time range: ${FAILURE_START_TIME} to ${FAILURE_END_TIME}`);
  console.log('Target: Internal Dialer webhook failures');
  console.log('');

  try {
    // Get leads that likely failed webhook posting
    const leads = await getFailedWebhookLeads();
    
    if (leads.length === 0) {
      console.log('No leads found that need webhook re-posting');
      return;
    }

    console.log(`📊 Summary by list ID:`);
    const listCounts = leads.reduce((acc, lead) => {
      acc[lead.list_id] = (acc[lead.list_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(listCounts).forEach(([listId, count]) => {
      console.log(`  ${listId}: ${count} leads`);
    });
    console.log('');

    // Process leads in batches to avoid overwhelming the API
    const BATCH_SIZE = 5; // Smaller batches for webhook retries
    const DELAY_MS = 2000; // 2 second delay between batches
    
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ leadId: string; error: string }> = [];

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(leads.length / BATCH_SIZE)} (leads ${i + 1}-${Math.min(i + BATCH_SIZE, leads.length)})`);

      // Process batch in parallel
      const batchPromises = batch.map(async (lead) => {
        const result = await postToInternalDialer(lead);
        if (result.success) {
          successCount++;
          console.log(`  ✅ ${lead.first_name} ${lead.last_name} (${lead.phone}) - Posted successfully`);
        } else {
          errorCount++;
          errors.push({ leadId: lead.id, error: result.error || 'Unknown error' });
          console.log(`  ❌ ${lead.first_name} ${lead.last_name} (${lead.phone}) - Error: ${result.error}`);
        }
        return result;
      });

      await Promise.all(batchPromises);

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < leads.length) {
        console.log(`  Waiting ${DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log('');
    console.log('📈 Final Results:');
    console.log(`  Total leads processed: ${leads.length}`);
    console.log(`  Successful webhook reposts: ${successCount}`);
    console.log(`  Failed webhook reposts: ${errorCount}`);
    console.log(`  Success rate: ${((successCount / leads.length) * 100).toFixed(1)}%`);

    if (errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      errors.forEach(({ leadId, error }) => {
        console.log(`  Lead ID ${leadId}: ${error}`);
      });
    }

    console.log('');
    console.log('✅ Webhook retry script completed successfully!');

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
