import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing Supabase config - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Pitch BPO constants (EXACT same as /api/leads)
const PITCH_BPO_UUID = '70942646-125b-4ddd-96fc-b9a142c698b8';
const PITCH_BPO_CAMPAIGN = 'Jade ACA';
const PITCH_BPO_SUBCAMPAIGN = 'Juiced Real Time';

/**
 * Forward a lead to Pitch BPO (EXACT same logic as /api/leads)
 */
async function forwardToPitchBPO(lead: any, listId: string) {
  console.log('Forwarding batch lead to Pitch BPO dialer:', lead.id);
  console.log('Using fixed Pitch BPO token: 70942646-125b-4ddd-96fc-b9a142c698b8');
  
  // Extract the subID from lead's custom_fields if available
  const leadCustomFields = lead.custom_fields || {};
  const leadSubId = typeof leadCustomFields === 'string'
    ? JSON.parse(leadCustomFields)?.subid || ''
    : leadCustomFields?.subid || '';
  
  console.log(`List ID to use for adv_SubID: ${listId}`);
  console.log(`SubId from custom_fields to use for adv_SubID2: ${leadSubId}`);
  
  try {
    // Create the URL with query parameters for Pitch BPO (exact same as /api/leads)
    const pitchBPOUrl = new URL('https://api.chasedatacorp.com/HttpImport/InjectLead.php');
    
    // Add required parameters
    pitchBPOUrl.searchParams.append('token', PITCH_BPO_UUID);
    pitchBPOUrl.searchParams.append('accid', 'pitchperfect');
    pitchBPOUrl.searchParams.append('Campaign', PITCH_BPO_CAMPAIGN);
    pitchBPOUrl.searchParams.append('Subcampaign', PITCH_BPO_SUBCAMPAIGN);
    
    // Always add list ID as adv_SubID parameter
    pitchBPOUrl.searchParams.append('adv_SubID', listId);
    
    // Only add adv_SubID2 if we have a subid in custom_fields
    if (leadSubId) {
      pitchBPOUrl.searchParams.append('adv_SubID2', leadSubId);
    }
    
    // Add lead information
    pitchBPOUrl.searchParams.append('PrimaryPhone', lead.phone);
    pitchBPOUrl.searchParams.append('FirstName', lead.first_name);
    pitchBPOUrl.searchParams.append('LastName', lead.last_name);
    pitchBPOUrl.searchParams.append('email', lead.email);
    pitchBPOUrl.searchParams.append('ZipCode', lead.zip_code);
    pitchBPOUrl.searchParams.append('State', lead.state);
    pitchBPOUrl.searchParams.append('ClientId', lead.id); // Using lead.id as ClientId
    pitchBPOUrl.searchParams.append('Notes', 'Batch Lead from Compliance Engine');
    
    // Optional insertion behavior parameters
    pitchBPOUrl.searchParams.append('ImportOnly', '0');
    pitchBPOUrl.searchParams.append('DuplicatesCheck', '1');
    pitchBPOUrl.searchParams.append('AllowDialingDups', '1');
    
    console.log('Sending batch lead to Pitch BPO:', pitchBPOUrl.toString());
    
    // Send the lead to Pitch BPO API
    const pitchBPOResponse = await fetch(pitchBPOUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': '*/*'
      }
    });
    
    const responseText = await pitchBPOResponse.text();
    console.log('Pitch BPO API response status:', pitchBPOResponse.status);
    console.log('Pitch BPO API response (first 100 chars):', responseText.substring(0, 100));
    
    return {
      success: pitchBPOResponse.ok,
      status: pitchBPOResponse.status,
      response: responseText.substring(0, 100),
      leadId: lead.id
    };
    
  } catch (error) {
    console.error('Error forwarding batch lead to Pitch BPO:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      leadId: lead.id
    };
  }
}

/**
 * Forward a lead to Internal Dialer (EXACT same logic as /api/leads)
 */
async function forwardToInternalDialer(lead: any, routingData: any) {
  console.log('Forwarding batch lead to Internal Dialer:', lead.id);
  
  try {
    // Format phone number with +1 prefix if it doesn't have it already
    const formattedPhone = lead.phone.startsWith('+1') ? lead.phone : `+1${lead.phone.replace(/\D/g, '')}`;
    
    // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
    // Use the routing token if available, then fallback to a default (EXACT same as /api/leads)
    let authToken = '';
    
    if (routingData && routingData.token) {
      console.log(`Using token from routing settings: ${routingData.token}`);
      authToken = routingData.token;
    } else {
      console.log('No token available, using default token');
      authToken = '7f108eff2dbf3ab07d562174da6dbe53';
    }
    
    // Get effective routing IDs from routing data or lead data
    const effectiveCampaignId = routingData?.campaign_id || lead.campaign_id;
    const effectiveCadenceId = routingData?.cadence_id || lead.cadence_id;
    const listId = routingData?.list_id || lead.list_id;
    
    // Create the dialer payload (exact same format as /api/leads)
    const dialerPayload = {
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: formattedPhone,
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      zip_code: lead.zip_code,
      source: lead.source || 'Batch Upload',
      trusted_form_cert_url: lead.trusted_form_cert_url || '',
      transaction_id: '',
      income_bracket: lead.income_bracket || '',
      dob: lead.birth_date || '',
      homeowner_status: lead.homeowner_status || '',
      
      // Custom fields passed through as a nested object (exact same as /api/leads)
      custom_fields: {
        ...(lead.custom_fields || {}),
        compliance_lead_id: lead.id // Add compliance_lead_id to custom fields
      },
      
      // Include the routing IDs directly in the payload
      list_id: listId,
      campaign_id: effectiveCampaignId,
      cadence_id: effectiveCadenceId,
      
      // Include the lead ID to enable policy postback tracking
      compliance_lead_id: lead.id
    };
    
    // Construct the URL with required parameters (EXACT same as /api/leads)
    const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
    dialerUrl.searchParams.append('list_id', listId);
    dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
    dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
    dialerUrl.searchParams.append('token', authToken);
    
    console.log('Sending batch lead to Internal Dialer:', dialerUrl.toString());
    console.log('Dialer payload with compliance_lead_id:', JSON.stringify(dialerPayload, null, 2));
    console.log('Lead ID being sent to dialer:', dialerPayload.compliance_lead_id);
    
    const response = await fetch(dialerUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dialerPayload)
    });
    
    const result = await response.json();
    console.log('Internal Dialer API response:', result);
    
    return {
      success: response.ok,
      status: response.status,
      response: result,
      leadId: lead.id
    };
    
  } catch (error) {
    console.error('Error forwarding batch lead to Internal Dialer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      leadId: lead.id
    };
  }
}

/**
 * POST /api/batch-post-leads
 * Post a specified number of leads to external dialer APIs
 */
export async function POST(request: NextRequest) {
  try {
    const { leadIds, dialerType, count } = await request.json();
    
    console.log(`Processing batch post: ${count} leads from ${leadIds?.length} available, dialer: ${dialerType}`);
    
    // Validate required parameters
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No lead IDs provided'
      }, { status: 400 });
    }
    
    if (!dialerType || !['pitch_bpo', 'internal'].includes(dialerType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid dialer type. Must be "pitch_bpo" or "internal"'
      }, { status: 400 });
    }
    
    if (!count || count <= 0 || count > leadIds.length) {
      return NextResponse.json({
        success: false,
        error: `Invalid count. Must be between 1 and ${leadIds.length}`
      }, { status: 400 });
    }
    
    // Create Supabase client
    const supabase = createServerClient();
    
    // Randomly select leads from the provided IDs
    const shuffledIds = leadIds.sort(() => 0.5 - Math.random());
    const selectedLeadIds = shuffledIds.slice(0, count);
    
    console.log('Selected lead IDs for posting:', selectedLeadIds);
    
    // Fetch full lead data for the selected leads
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .in('id', selectedLeadIds);
    
    if (fetchError) {
      console.error('Error fetching leads for posting:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch lead data'
      }, { status: 500 });
    }
    
    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No leads found with provided IDs'
      }, { status: 404 });
    }
    
    console.log(`Found ${leads.length} leads to post to ${dialerType}`);
    
    const postingResults = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Process each lead
    for (const lead of leads) {
      try {
        let result;
        
        if (dialerType === 'pitch_bpo') {
          // For Pitch BPO, we need the list_id parameter
          const listId = lead.list_id || 'default-list-id';
          result = await forwardToPitchBPO(lead, listId);
        } else {
          // For Internal Dialer, fetch routing data if available (EXACT same as /api/leads)
          let routingData = null;
          if (lead.routing_id) {
            try {
              const { data: routing, error: routingError } = await supabase
                .from('routings')
                .select('*')
                .eq('id', lead.routing_id)
                .single();
              
              if (!routingError && routing) {
                routingData = routing;
                console.log(`Using routing data for lead ${lead.id}:`, routingData);
              }
            } catch (routingFetchError) {
              console.warn(`Could not fetch routing data for lead ${lead.id}:`, routingFetchError);
            }
          }
          
          result = await forwardToInternalDialer(lead, routingData);
        }
        
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        
        postingResults.push({
          leadId: lead.id,
          phone: lead.phone,
          success: result.success,
          status: result.status,
          response: result.response,
          error: result.error || null
        });
        
      } catch (error) {
        failureCount++;
        console.error('Error processing lead for posting:', lead.id, error);
        postingResults.push({
          leadId: lead.id,
          phone: lead.phone,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`Batch posting completed: ${successCount} successful, ${failureCount} failed`);
    
    return NextResponse.json({
      success: true,
      postingResults,
      summary: {
        requested: count,
        attempted: leads.length,
        successful: successCount,
        failed: failureCount,
        dialerType: dialerType,
        dialerName: dialerType === 'pitch_bpo' ? 'Pitch BPO' : 'Internal Dialer'
      }
    });
    
  } catch (error) {
    console.error('Error in batch-post-leads API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
