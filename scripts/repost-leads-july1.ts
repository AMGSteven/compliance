#!/usr/bin/env tsx

/**
 * Script to re-post leads from specific list IDs to Juiced Media dialer
 * Date: July 1st, 2025 between 12:00 AM EST and 10:30 AM EST
 * 
 * Usage: npx tsx scripts/repost-leads-july1.ts
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

// Target list IDs to re-post
const TARGET_LIST_IDS = [
  '9cfc34d0-1236-4258-b4cd-9947baf28467',
  'f2a566d2-0e97-4a7d-bc95-389dade78caf',
  'ad57802a-d172-48e7-a6ba-1080a3f06d8d',
  '6a3bb656-ea60-412b-ab8d-530162736852',
  '1b759535-2a5e-421e-9371-3bde7f855c60',
  'd98bba1b-82db-476a-a6fb-73f27360ff7b'
];

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

// Default routing configuration
const DEFAULT_ROUTING = {
  campaign_id: 'default-campaign',
  cadence_id: 'default-cadence',
  token: '7f108eff2dbf3ab07d562174da6dbe53'
};

async function getLeadsToRepost() {
  console.log('Fetching leads to re-post...');
  
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
      income_bracket,
      homeowner_status,
      transaction_id
    `)
    .in('list_id', TARGET_LIST_IDS)
    .gte('created_at', '2025-07-01 05:00:00+00')  // 12:00 AM EST
    .lte('created_at', '2025-07-01 15:30:00+00')  // 10:30 AM EST
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }

  console.log(`Found ${leads?.length || 0} leads to re-post`);
  return leads || [];
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

async function postToDialer(lead: any): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    // Get routing data for this list_id
    const routingData = await getRoutingData(lead.list_id);
    
    // Format phone number (remove non-digits and ensure 10 digits)
    const formattedPhone = lead.phone.replace(/\D/g, '');
    
    // Extract fields exactly like the original endpoint
    const firstName = lead.first_name || '';
    const lastName = lead.last_name || '';
    const email = lead.email || '';
    const state = lead.state || '';
    const zipCode = lead.zip_code || '';
    const trustedFormCertUrl = lead.trusted_form_cert_url || '';
    
    // Handle demographic fields with fallbacks like the original
    const incomeBracket = lead.income_bracket || lead.custom_fields?.incomeBracket || lead.custom_fields?.income_bracket || '';
    const dob = lead.custom_fields?.dob || lead.custom_fields?.dateOfBirth || lead.custom_fields?.date_of_birth || lead.custom_fields?.DateOfBirth || lead.custom_fields?.birthDate || lead.custom_fields?.birth_date || lead.custom_fields?.BirthDate || '';
    const homeownerStatus = lead.homeowner_status || lead.custom_fields?.homeownerStatus || lead.custom_fields?.homeowner_status || lead.custom_fields?.HomeownerStatus || lead.custom_fields?.residenceType || lead.custom_fields?.residence_type || '';
    
    // Use routing data for campaign/cadence or fallback to defaults
    let effectiveCampaignId = lead.campaign_id || DEFAULT_ROUTING.campaign_id;
    let effectiveCadenceId = DEFAULT_ROUTING.cadence_id;
    
    if (routingData) {
      if (routingData.campaign_id) {
        effectiveCampaignId = routingData.campaign_id;
      }
      if (routingData.cadence_id) {
        effectiveCadenceId = routingData.cadence_id;
      }
    }
    
    // Create the dialer payload with all required fields - EXACTLY like the original
    const dialerPayload: DialerPayload = {
      // Primary lead fields
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: formattedPhone,
      address: lead.address || '',
      city: lead.city || '',
      state: state,
      zip_code: zipCode,
      source: 'Compliance API Repost',
      trusted_form_cert_url: trustedFormCertUrl,
      transaction_id: lead.transaction_id || '',
      
      // Important compliance and demographic fields
      income_bracket: incomeBracket,
      dob: dob,
      homeowner_status: homeownerStatus,
      
      // Custom fields passed through as a nested object
      custom_fields: {
        ...(lead.custom_fields || {}),
        compliance_lead_id: lead.id, // Add compliance_lead_id to custom fields
        repost_reason: 'July 1st batch repost',
        original_created_at: lead.created_at
      },
      
      // Include the routing IDs directly in the payload
      list_id: lead.list_id,
      campaign_id: effectiveCampaignId,
      cadence_id: effectiveCadenceId,
      
      // Include the lead ID to enable policy postback tracking
      compliance_lead_id: lead.id
    };

    // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
    // Use the routing token if available, then fallback to default
    let authToken = DEFAULT_ROUTING.token;
    
    if (routingData && routingData.token) {
      console.log(`Using token from routing settings: ${routingData.token}`);
      authToken = routingData.token;
    }
    
    // Construct the URL with required parameters in the query string
    const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
    dialerUrl.searchParams.append('list_id', lead.list_id);
    dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
    dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
    dialerUrl.searchParams.append('token', authToken);

    // Post to dialer
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
  console.log('🚀 Starting lead re-posting script for July 1st leads...');
  console.log(`Target time range: July 1st, 2025 12:00 AM EST to 10:30 AM EST`);
  console.log(`Target list IDs: ${TARGET_LIST_IDS.join(', ')}`);
  console.log('');

  try {
    // Get leads to repost
    const leads = await getLeadsToRepost();
    
    if (leads.length === 0) {
      console.log('No leads found to re-post');
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
    const BATCH_SIZE = 10;
    const DELAY_MS = 1000; // 1 second delay between batches
    
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ leadId: string; error: string }> = [];

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(leads.length / BATCH_SIZE)} (leads ${i + 1}-${Math.min(i + BATCH_SIZE, leads.length)})`);

      // Process batch in parallel
      const batchPromises = batch.map(async (lead) => {
        const result = await postToDialer(lead);
        if (result.success) {
          successCount++;
          console.log(`  ✅ ${lead.first_name} ${lead.last_name} (${lead.phone}) - Success`);
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
    console.log(`  Successful reposts: ${successCount}`);
    console.log(`  Failed reposts: ${errorCount}`);
    console.log(`  Success rate: ${((successCount / leads.length) * 100).toFixed(1)}%`);

    if (errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      errors.forEach(({ leadId, error }) => {
        console.log(`  Lead ID ${leadId}: ${error}`);
      });
    }

    console.log('');
    console.log('✅ Script completed successfully!');

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
