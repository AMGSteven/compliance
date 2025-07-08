import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Import the same compliance engine and duplicate checker from the main leads API
import { ComplianceEngine } from '@/lib/compliance/engine';

// Create Supabase client for server-side operations
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing Supabase config - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Lead distribution function
function distributeLeads(leads: any[], allocations: any[]): Record<string, any[]> {
  const distributed: Record<string, any[]> = {};
  let leadIndex = 0;
  
  // Initialize arrays for each routing
  for (const allocation of allocations) {
    distributed[allocation.routingId] = [];
  }
  
  // Distribute leads according to allocations
  for (const allocation of allocations) {
    const leadsToTake = Math.min(allocation.leadCount, leads.length - leadIndex);
    distributed[allocation.routingId] = leads.slice(leadIndex, leadIndex + leadsToTake);
    leadIndex += leadsToTake;
    
    if (leadIndex >= leads.length) break;
  }
  
  return distributed;
}

// Duplicate check function from /api/leads - exact same logic
async function checkForDuplicateLead(phone: string) {
  try {
    const supabase = createServerClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log(`[DUPLICATE CHECK] Checking for leads with phone ${phone} since ${thirtyDaysAgo.toISOString()}`);
    
    const { data: existingLeads, error } = await supabase
      .from('leads')
      .select('id, phone, created_at')
      .eq('phone', phone)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1);
    
    if (error) {
      console.error('[DUPLICATE CHECK] Database error:', error);
      return { isDuplicate: false, error: error.message };
    }
    
    if (existingLeads && existingLeads.length > 0) {
      const existingLead = existingLeads[0];
      const submissionDate = new Date(existingLead.created_at);
      const daysAgo = Math.floor((Date.now() - submissionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        isDuplicate: true,
        details: {
          existingLeadId: existingLead.id,
          originalSubmissionDate: submissionDate.toISOString(),
          daysAgo: daysAgo
        }
      };
    }
    
    return { isDuplicate: false };
  } catch (error) {
    console.error('[DUPLICATE CHECK] Error:', error);
    return { isDuplicate: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * POST /api/batch-insert-leads
 * Insert compliant leads from batch processing into the database
 * with full compliance validation and exact field mapping
 */
export async function POST(request: NextRequest) {
  try {
    const { compliantLeads, routingAllocations } = await request.json();
    
    console.log(`Processing multi-routing batch insert: ${compliantLeads?.length} leads across ${routingAllocations?.length} routings`);
    
    // Validate required parameters
    if (!compliantLeads || !Array.isArray(compliantLeads) || compliantLeads.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No compliant leads provided'
      }, { status: 400 });
    }
    
    if (!routingAllocations || !Array.isArray(routingAllocations) || routingAllocations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No routing allocations provided'
      }, { status: 400 });
    }
    
    // Validate each allocation
    for (const allocation of routingAllocations) {
      if (!allocation.listId || !allocation.routingId || typeof allocation.costPerLead !== 'number' || 
          allocation.costPerLead <= 0 || typeof allocation.leadCount !== 'number' || allocation.leadCount <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Invalid routing allocation parameters'
        }, { status: 400 });
      }
    }
    
    // Validate total allocation doesn't exceed available leads
    const totalAllocated = routingAllocations.reduce((sum: number, a: any) => sum + a.leadCount, 0);
    if (totalAllocated > compliantLeads.length) {
      return NextResponse.json({
        success: false,
        error: `Total allocated leads (${totalAllocated}) exceeds available leads (${compliantLeads.length})`
      }, { status: 400 });
    }
    
    // Create Supabase client
    const supabase = createServerClient();
    
    // Step 1: Validate and fetch routing data for all allocations
    const routingDataMap = new Map();
    for (const allocation of routingAllocations) {
      console.log('Looking up routing data for list ID:', allocation.listId);
      const { data: routingData, error: routingError } = await supabase
        .from('list_routings')
        .select('*')
        .eq('list_id', allocation.listId)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      
      if (routingError) {
        console.error('Error fetching routing data for', allocation.listId, ':', routingError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch routing configuration for ${allocation.listId}`
        }, { status: 500 });
      }
      
      if (!routingData) {
        return NextResponse.json({
          success: false,
          error: `No active routing found for list_id: ${allocation.listId}`
        }, { status: 404 });
      }
      
      routingDataMap.set(allocation.routingId, { ...routingData, allocation });
      console.log('Found routing data for', allocation.listId, ':', routingData);
    }
    
    // Step 2: Distribute leads across routings
    const distributedLeads = distributeLeads(compliantLeads, routingAllocations);
    
    // Step 3: Process each routing allocation
    const allResults = [];
    let totalInserted = 0;
    let totalFailed = 0;
    
    for (const [routingId, leadsForRouting] of Object.entries(distributedLeads)) {
      const routingInfo = routingDataMap.get(routingId);
      const allocation = routingInfo.allocation;
      
      console.log(`Processing ${leadsForRouting.length} leads for routing ${routingId}`);
      
      const insertedLeads = [];
      const failures = [];
      
      // Process each lead for this routing
      for (const csvLead of leadsForRouting) {
        try {
          // Extract phone number using the same logic as batch compliance API
          const phone = csvLead.phone || csvLead.Phone || csvLead.phone_number || 
                       csvLead.PhoneNumber || csvLead.primary_phone || csvLead.PrimaryPhone || 
                       csvLead.phone_home || '';
          
          if (!phone) {
            console.log('Skipping lead with no phone number');
            failures.push({
              lead: csvLead,
              error: 'No phone number found',
              details: 'Phone number is required for compliance validation'
            });
            continue;
          }
          
          // Step 1: Compliance validation (same as /api/leads)
          const complianceEngine = new ComplianceEngine();
          const complianceResult = await complianceEngine.checkPhoneNumber(phone);
          
          if (!complianceResult.isCompliant) {
            console.log(`Lead ${phone} failed compliance:`, complianceResult.results.filter(r => !r.isCompliant));
            failures.push({
              lead: csvLead,
              error: 'Compliance check failed',
              details: complianceResult.results.filter(r => !r.isCompliant)
            });
            continue;
          }
          
          // Step 2: Duplicate check (same as /api/leads)
          const duplicateCheck = await checkForDuplicateLead(phone);
          if (duplicateCheck.error) {
            console.error('Duplicate check error for', phone, ':', duplicateCheck.error);
            failures.push({
              lead: csvLead,
              error: 'Duplicate check failed',
              details: duplicateCheck.error
            });
            continue;
          }
          
          if (duplicateCheck.isDuplicate) {
            console.log(`Duplicate lead detected: ${phone}`);
            failures.push({
              lead: csvLead,
              error: 'Duplicate lead',
              details: duplicateCheck.details
            });
            continue;
          }
          
          // Step 3: Prepare lead data for insertion (exact same mapping as /api/leads)
          const leadData = {
            first_name: csvLead.first_name || '',
            last_name: csvLead.last_name || '',
            email: csvLead.email || '',
            phone: phone,
            zip_code: csvLead.zip_code || csvLead.zip || '',
            trusted_form_cert_url: csvLead.trusted_form_cert_url || '',
            list_id: allocation.listId,
            campaign_id: routingInfo.campaign_id,
            cadence_id: routingInfo.cadence_id,
            token: routingInfo.token || '',
            traffic_source: 'batch_upload',
            address: csvLead.address || '',
            city: csvLead.city || '',
            state: csvLead.state || '',
            source: 'Batch Upload',
            age_range: csvLead.age_range || '',
            birth_date: csvLead.birth_date || null,
            homeowner_status: csvLead.homeowner_status || '',
            income_bracket: csvLead.income_bracket || '',
            custom_fields: {
              batch_upload: true,
              batch_cost_per_lead: allocation.costPerLead,
              batch_timestamp: new Date().toISOString(),
              original_csv_row: leadsForRouting.indexOf(csvLead) + 1,
              routing_used: {
                list_id: allocation.listId,
                campaign_id: routingInfo.campaign_id,
                cadence_id: routingInfo.cadence_id,
                dialer_type: routingInfo.dialer_type
              }
            },
            status: 'new',
            created_at: new Date().toISOString()
          };
          
          console.log('Inserting lead data:', JSON.stringify(leadData, null, 2));
          
          const { data, error } = await supabase
            .from('leads')
            .insert([leadData])
            .select();
          
          if (error) {
            console.error('Database insertion failed for lead:', phone, error);
            failures.push({
              lead: csvLead,
              error: 'Database insertion failed',
              details: error
            });
          } else {
            // Successfully inserted
            console.log('Successfully inserted lead:', data[0].id);
            insertedLeads.push(data[0]);
          }
          
        } catch (error) {
          console.error('Processing error for lead:', error);
          failures.push({
            lead: csvLead,
            error: 'Processing failed',
            details: error
          });
        }
      }
      
      // Store results for this routing
      allResults.push({
        routingId,
        listId: allocation.listId,
        costPerLead: allocation.costPerLead,
        requestedLeads: allocation.leadCount,
        processedLeads: leadsForRouting.length,
        insertedLeads: insertedLeads,
        failures: failures,
        routingInfo: {
          campaign_id: routingInfo.campaign_id,
          cadence_id: routingInfo.cadence_id,
          dialer_type: routingInfo.dialer_type,
          dialer_name: routingInfo.dialer_type === 2 ? 'Pitch BPO' : 'Internal Dialer',
          token: routingInfo.token || ''
        }
      });
      
      totalInserted += insertedLeads.length;
      totalFailed += failures.length;
    }
    
    // Step 4: Auto-post leads to dialers for each routing
    console.log('Starting auto-posting to dialers...');
    const postingResults = [];
    
    for (const result of allResults) {
      if (result.insertedLeads.length > 0) {
        try {
          console.log(`Attempting to post ${result.insertedLeads.length} leads for routing ${result.routingId} (${result.routingInfo.dialer_name})`);
          
          // Determine dialer type based on routing info
          const dialerType = result.routingInfo.dialer_type === 1 ? 'internal' : 'pitch_bpo';
          const routingPostingResults = [];
          
          // Post each lead directly to external dialer APIs - same as /api/leads
          for (const insertedLead of result.insertedLeads) {
            try {
              let dialerResult;
              
              if (dialerType === 'pitch_bpo') {
                // Call Pitch BPO directly - EXACT SAME logic as /api/leads
                const PITCH_BPO_UUID = '70942646-125b-4ddd-96fc-b9a142c698b8';
                const PITCH_BPO_CAMPAIGN = 'Jade ACA'; // Same as /api/leads
                const PITCH_BPO_SUBCAMPAIGN = 'Juiced Real Time'; // Same as /api/leads
                
                console.log('Forwarding lead to Pitch BPO dialer');
                console.log('Using fixed Pitch BPO token: 70942646-125b-4ddd-96fc-b9a142c698b8');
                
                // Extract the subID from lead's custom_fields if available (same as /api/leads)
                const leadCustomFields = insertedLead.custom_fields || {};
                const leadSubId = typeof leadCustomFields === 'string'
                  ? JSON.parse(leadCustomFields)?.subid || ''
                  : leadCustomFields?.subid || '';
                
                console.log(`List ID to use for adv_SubID: ${result.listId}`);
                console.log(`SubId from custom_fields to use for adv_SubID2: ${leadSubId}`);
                
                const pitchBPOUrl = new URL('https://api.chasedatacorp.com/HttpImport/InjectLead.php');
                
                // Add required parameters (exact same as /api/leads)
                pitchBPOUrl.searchParams.append('token', PITCH_BPO_UUID); // Required: security token
                pitchBPOUrl.searchParams.append('accid', 'pitchperfect'); // Confirmed correct account ID
                pitchBPOUrl.searchParams.append('Campaign', PITCH_BPO_CAMPAIGN); // Required: existing campaign
                pitchBPOUrl.searchParams.append('Subcampaign', PITCH_BPO_SUBCAMPAIGN); // Optional: subcampaign
                
                // Always add list ID as adv_SubID parameter
                pitchBPOUrl.searchParams.append('adv_SubID', result.listId);
                
                // Only add adv_SubID2 if we have a subid in custom_fields (same as /api/leads)
                if (leadSubId) {
                  pitchBPOUrl.searchParams.append('adv_SubID2', leadSubId);
                }
                
                // Add lead information (exact same as /api/leads)
                pitchBPOUrl.searchParams.append('PrimaryPhone', insertedLead.phone); // Required: phone number
                pitchBPOUrl.searchParams.append('FirstName', insertedLead.first_name);
                pitchBPOUrl.searchParams.append('LastName', insertedLead.last_name);
                pitchBPOUrl.searchParams.append('email', insertedLead.email);
                pitchBPOUrl.searchParams.append('ZipCode', insertedLead.zip_code);
                pitchBPOUrl.searchParams.append('State', insertedLead.state || '');
                pitchBPOUrl.searchParams.append('ClientId', insertedLead.id); // Using compliance_lead_id as ClientId
                pitchBPOUrl.searchParams.append('Notes', 'Lead from Compliance Engine');
                
                // Optional insertion behavior parameters (exact same as /api/leads)
                pitchBPOUrl.searchParams.append('ImportOnly', '0'); // Always ImportOnly=0 per requirements
                pitchBPOUrl.searchParams.append('DuplicatesCheck', '1'); // Always DuplicatesCheck=1 per requirements
                pitchBPOUrl.searchParams.append('AllowDialingDups', '1'); // Always AllowDialingDups=1 per requirements
                
                // Log the details about the Pitch BPO submission (same as /api/leads)
                console.log('Sending lead to Pitch BPO:', pitchBPOUrl.toString());
                
                // Send the lead to Pitch BPO API - using InjectLead.php endpoint with GET method as per documentation
                const pitchBPOResponse = await fetch(pitchBPOUrl.toString(), {
                  method: 'GET', // Using GET as shown in the documentation examples
                  headers: {
                    'Accept': '*/*' // Accept any content type since the API might return HTML
                  }
                });
                
                // Get response text instead of trying to parse JSON (same as /api/leads)
                const responseText = await pitchBPOResponse.text();
                console.log('Pitch BPO API response status:', pitchBPOResponse.status);
                console.log('Pitch BPO API response (first 100 chars):', responseText.substring(0, 100));
                
                dialerResult = {
                  success: pitchBPOResponse.ok,
                  status: pitchBPOResponse.status,
                  response: responseText.substring(0, 100) // Just include beginning of response
                };
                
              } else if (dialerType === 'internal') {
                // Call Internal Dialer directly - same logic as /api/leads
                let authToken = insertedLead.token || result.routingInfo.token || '7f108eff2dbf3ab07d562174da6dbe53';
                
                const dialerPayload = {
                  first_name: insertedLead.first_name,
                  last_name: insertedLead.last_name,
                  email: insertedLead.email,
                  phone: insertedLead.phone,
                  address: insertedLead.address || '',
                  city: insertedLead.city || '',
                  state: insertedLead.state || '',
                  zip_code: insertedLead.zip_code || '',
                  source: 'Compliance API',
                  trusted_form_cert_url: insertedLead.trusted_form_cert_url || '',
                  custom_fields: {
                    compliance_lead_id: insertedLead.id
                  },
                  list_id: result.listId,
                  campaign_id: result.routingInfo.campaign_id,
                  cadence_id: result.routingInfo.cadence_id,
                  compliance_lead_id: insertedLead.id
                };
                
                const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
                dialerUrl.searchParams.append('list_id', result.listId);
                dialerUrl.searchParams.append('campaign_id', result.routingInfo.campaign_id);
                dialerUrl.searchParams.append('cadence_id', result.routingInfo.cadence_id);
                dialerUrl.searchParams.append('token', authToken);
                
                const internalResponse = await fetch(dialerUrl.toString(), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(dialerPayload)
                });
                
                const responseJson = await internalResponse.json();
                dialerResult = {
                  success: internalResponse.ok,
                  status: internalResponse.status,
                  response: responseJson
                };
              }
              
              routingPostingResults.push({
                leadId: insertedLead.id,
                success: dialerResult?.success || false,
                dialerType,
                response: dialerResult
              });
              
            } catch (postError) {
              console.error(`Error posting lead ${insertedLead.id}:`, postError);
              routingPostingResults.push({
                leadId: insertedLead.id,
                success: false,
                dialerType,
                error: postError instanceof Error ? postError.message : 'Unknown error'
              });
            }
          }
          
          const successCount = routingPostingResults.filter(r => r.success).length;
          const failureCount = routingPostingResults.filter(r => !r.success).length;
          
          console.log(`✅ Routing ${result.routingId} posting: ${successCount} successful, ${failureCount} failed`);
          
          postingResults.push({
            routingId: result.routingId,
            success: successCount > 0,
            successCount: successCount,
            failureCount: failureCount,
            leadsAffected: result.insertedLeads.length,
            dialerType: dialerType,
            results: routingPostingResults
          });
          
        } catch (error) {
          console.error(`❌ POSTING ERROR - Routing ${result.routingId} (${result.routingInfo.dialer_name}):`);
          console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
          console.error(`   Leads affected: ${result.insertedLeads.length}`);
          console.error(`   List ID: ${result.listId}`);
          
          postingResults.push({
            routingId: result.routingId,
            success: false,
            successCount: 0,
            failureCount: result.insertedLeads.length,
            error: error instanceof Error ? error.message : String(error),
            leadsAffected: result.insertedLeads.length
          });
        }
      } else {
        console.log(`Skipping posting for routing ${result.routingId} - no leads inserted`);
      }
    }
    
    // Log summary of posting results
    const totalSuccessfulPosts = postingResults.reduce((sum, r) => sum + (r.successCount || 0), 0);
    const totalFailedPosts = postingResults.reduce((sum, r) => sum + (r.failureCount || 0), 0);
    const routingsWithFailures = postingResults.filter(r => !r.success);
    
    if (totalFailedPosts > 0) {
      console.error(`⚠️  POSTING SUMMARY: ${totalSuccessfulPosts} successful, ${totalFailedPosts} failed`);
      console.error('Failed posting details:', routingsWithFailures);
    } else {
      console.log(`✅ POSTING SUMMARY: ${totalSuccessfulPosts} successful, 0 failed`);
    }
    
    console.log(`Multi-routing batch insert completed: ${totalInserted} total inserted, ${totalFailed} total failed across ${allResults.length} routings`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalLeads: compliantLeads.length,
        totalInserted: totalInserted,
        totalFailed: totalFailed,
        routingsProcessed: allResults.length,
        averageCostPerLead: routingAllocations.reduce((sum: number, a: any) => sum + (a.costPerLead * a.leadCount), 0) / routingAllocations.reduce((sum: number, a: any) => sum + a.leadCount, 0)
      },
      routingResults: allResults.map(result => ({
        routingId: result.routingId,
        listId: result.listId,
        costPerLead: result.costPerLead,
        requestedLeads: result.requestedLeads,
        processedLeads: result.processedLeads,
        insertedCount: result.insertedLeads.length,
        failedCount: result.failures.length,
        routingInfo: result.routingInfo,
        totalCost: result.costPerLead * result.insertedLeads.length
      }))
    });
    
  } catch (error) {
    console.error('Error in multi-routing batch-insert-leads API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
