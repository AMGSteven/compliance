import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ComplianceEngine } from '@/lib/compliance/engine';
import { checkPhoneCompliance } from '@/app/lib/real-phone-validation';
import { validatePhoneDirectly } from '@/app/lib/phone-validation-hook';
import { checkForDuplicateLead } from '@/app/lib/duplicate-lead-check';

// Main POST handler for all lead formats
// Force dynamic routing for Vercel deployment
export const dynamic = 'force-dynamic';

// Define allowed states per dialer type
const INTERNAL_DIALER_ALLOWED_STATES = ['AL', 'AR', 'AZ', 'IN', 'KS', 'LA', 'MO', 'MS', 'OH', 'SC', 'TN', 'TX'];
const PITCH_BPO_ALLOWED_STATES = ['AL', 'AR', 'AZ', 'FL', 'IN', 'KS', 'LA', 'MI', 'MO', 'MS', 'OH', 'OK', 'SC', 'TN', 'TX'];

// Test constants for bypassing compliance and forcing routing
const TEST_PHONE_NUMBER = '6507769592'; // User's number for testing
const TEST_JUICED_MEDIA_LIST_ID = 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e'; // Juiced Media List ID

// Dialer type constants
const DIALER_TYPE_INTERNAL = 1;
const DIALER_TYPE_PITCH_BPO = 2;

// Pitch BPO constants
const PITCH_BPO_UUID = '70942646-125b-4ddd-96fc-b9a142c698b8';
const PITCH_BPO_CAMPAIGN = 'Jade ACA';
const PITCH_BPO_SUBCAMPAIGN = 'Juiced Real Time'; // Juiced Media List ID

/**
 * Forward a lead to the Pitch BPO dialer
 * @param params Parameters for the Pitch BPO dialer
 * @returns API response with success status and lead data
 */
async function forwardToPitchBPO(params: {
  data: any[],
  listId: string,
  phone: string,
  firstName: string,
  lastName: string,
  email: string,
  zipCode: string,
  state: string,
  bidValue: number,
  routingData?: any
}) {
  const { data, listId, phone, firstName, lastName, email, zipCode, state, bidValue } = params;
  const leadId = data[0].id;
  
  console.log('Forwarding lead to Pitch BPO dialer');
  console.log('Using fixed Pitch BPO token: 70942646-125b-4ddd-96fc-b9a142c698b8');
  
  // Extract the subID from lead's custom_fields if available
  const leadCustomFields = data[0].custom_fields || {};
  const leadSubId = typeof leadCustomFields === 'string'
    ? JSON.parse(leadCustomFields)?.subid || ''
    : leadCustomFields?.subid || '';
  
  console.log(`List ID to use for adv_SubID: ${listId}`);
  console.log(`SubId from custom_fields to use for adv_SubID2: ${leadSubId}`);
  
  try {
    // Create the URL with query parameters for Pitch BPO according to their documentation
    // https://docs.chasedatacorp.com/content-user-guide/docs-page-user-guide-other.html
    const pitchBPOUrl = new URL('https://api.chasedatacorp.com/HttpImport/InjectLead.php');
    
    // Add required parameters
    pitchBPOUrl.searchParams.append('token', PITCH_BPO_UUID); // Required: security token
    pitchBPOUrl.searchParams.append('accid', 'pitchperfect'); // Confirmed correct account ID
    pitchBPOUrl.searchParams.append('Campaign', PITCH_BPO_CAMPAIGN); // Required: existing campaign
    pitchBPOUrl.searchParams.append('Subcampaign', PITCH_BPO_SUBCAMPAIGN); // Optional: subcampaign
    
    // Always add list ID as adv_SubID parameter
    pitchBPOUrl.searchParams.append('adv_SubID', listId);
    
    // Only add adv_SubID2 if we have a subid in custom_fields
    if (leadSubId) {
      pitchBPOUrl.searchParams.append('adv_SubID2', leadSubId);
    }
    
    // Add lead information
    pitchBPOUrl.searchParams.append('PrimaryPhone', phone); // Required: phone number
    pitchBPOUrl.searchParams.append('FirstName', firstName);
    pitchBPOUrl.searchParams.append('LastName', lastName);
    pitchBPOUrl.searchParams.append('email', email);
    pitchBPOUrl.searchParams.append('ZipCode', zipCode);
    pitchBPOUrl.searchParams.append('State', state);
    pitchBPOUrl.searchParams.append('ClientId', leadId); // Using compliance_lead_id as ClientId
    pitchBPOUrl.searchParams.append('Notes', 'Lead from Compliance Engine');
    
    // Optional insertion behavior parameters
    pitchBPOUrl.searchParams.append('ImportOnly', '0'); // Always ImportOnly=0 per requirements
    pitchBPOUrl.searchParams.append('DuplicatesCheck', '1'); // Always DuplicatesCheck=1 per requirements
    pitchBPOUrl.searchParams.append('AllowDialingDups', '1'); // Always AllowDialingDups=1 per requirements
    
    // Log the details about the Pitch BPO submission
    console.log('Sending lead to Pitch BPO:', pitchBPOUrl.toString());
    
    // Send the lead to Pitch BPO API - using InjectLead.php endpoint with GET method as per documentation
    const pitchBPOResponse = await fetch(pitchBPOUrl.toString(), {
      method: 'GET', // Using GET as shown in the documentation examples
      headers: {
        'Accept': '*/*' // Accept any content type since the API might return HTML
      }
    });
    
    // Get response text instead of trying to parse JSON
    const responseText = await pitchBPOResponse.text();
    console.log('Pitch BPO API response status:', pitchBPOResponse.status);
    console.log('Pitch BPO API response (first 100 chars):', responseText.substring(0, 100));
    
    // Return the response with lead data and Pitch BPO result
    return NextResponse.json({
      success: true,
      lead_id: data[0].id,
      data: data[0],
      bid: bidValue,
      dialer: {
        type: 'pitch_bpo',
        forwarded: true,
        status: pitchBPOResponse.status,
        response: responseText.substring(0, 100) // Just include beginning of response
      }
    });
  } catch (dialerError) {
    console.error('Error forwarding lead to Pitch BPO:', dialerError);
    // Still return success for the lead insertion, but include the dialer error
    return NextResponse.json({
      success: true,
      lead_id: data[0].id,
      data: data[0],
      bid: bidValue,
      dialer: {
        type: 'pitch_bpo',
        forwarded: false,
        error: dialerError instanceof Error ? dialerError.message : 'Unknown error'
      }
    });
  }
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received lead submission body:', JSON.stringify(body).slice(0, 500) + '...');
    
    // CRITICAL IMMEDIATE VALIDATION: Extract phone number from the request
    let phoneToCheck = '';
    
    // Extract phone number from appropriate field based on lead format
    if (body.ContactData && body.ContactData.Phone) {
      // Health insurance format
      phoneToCheck = body.ContactData.Phone;
    } else {
      // Standard format
      phoneToCheck = body.phone || body.Phone || '';
    }
    
    // Determine if this is a test call for the specific phone number
    let isTestModeForPhoneNumber = false;
    const normalizedPhoneToCheck = phoneToCheck ? phoneToCheck.replace(/\D/g, '') : '';
    if (normalizedPhoneToCheck === TEST_PHONE_NUMBER) {
      isTestModeForPhoneNumber = true;
      console.log(`[TEST MODE] Detected test phone number ${TEST_PHONE_NUMBER}.`);
    }

    // Direct phone validation disabled to save costs
    // if (phoneToCheck && !isTestModeForPhoneNumber) {
    //   console.log(`[DIRECT VALIDATION] Validating phone: ${phoneToCheck}`);
    //   const validationResult = await validatePhoneDirectly(phoneToCheck);
    //   
    //   if (!validationResult.isValid) {
    //     console.log(`[DIRECT VALIDATION] BLOCKING LEAD: ${validationResult.reason}`);
    //     return NextResponse.json(
    //       {
    //         success: false,
    //         bid: 0.00,
    //         error: `Phone validation failed: ${validationResult.reason}`,
    //         details: {
    //           phoneNumber: phoneToCheck,
    //           phoneType: validationResult.phoneType,
    //           status: validationResult.status,
    //           reason: validationResult.reason
    //         }
    //       },
    //       { status: 400 }
    //     );
    //   }
    //   console.log(`[DIRECT VALIDATION] Phone passed validation: ${phoneToCheck}`);
    // }
    
    // Duplicate check (re-enabled) - check if this is a duplicate lead within the past 30 days
    if (phoneToCheck && !isTestModeForPhoneNumber) {
      console.log(`[DUPLICATE CHECK] Checking if phone ${phoneToCheck} was submitted in the past 30 days`);
      const duplicateCheck = await checkForDuplicateLead(phoneToCheck);
      
      if (duplicateCheck.isDuplicate) {
        console.log(`[DUPLICATE CHECK] BLOCKING LEAD: Phone ${phoneToCheck} was submitted ${duplicateCheck.details?.daysAgo} days ago`);
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: `Duplicate lead: Phone number was submitted within the past 30 days`,
            details: {
              phoneNumber: phoneToCheck,
              originalSubmissionDate: duplicateCheck.details?.originalSubmissionDate,
              daysAgo: duplicateCheck.details?.daysAgo
            }
          },
          { status: 400 }
        );
      }
      console.log(`[DUPLICATE CHECK] Phone ${phoneToCheck} is not a duplicate`);
    } else if (phoneToCheck && isTestModeForPhoneNumber) {
      console.log(`[TEST MODE] Bypassed duplicate check for ${TEST_PHONE_NUMBER}.`);
    }
    
    // Log keys to help with debugging
    const keys = Object.keys(body);
    console.log('Request body keys:', keys);
    
    // Log the full request body for debugging - be careful with PII
    if (body.email === 'lray298915@gmail.com' || body.Email === 'lray298915@gmail.com' || 
        body.phone === '2106071548' || body.Phone === '2106071548' || 
        (body.ContactData && (body.ContactData.Email === 'lray298915@gmail.com' || body.ContactData.Phone === '2106071548'))) {
      console.log('IMPORTANT - Found Lindsay Ray lead:', JSON.stringify(body, null, 2));
    }
    
    // Test if this is the health insurance lead format
    if (keys.includes('ContactData') || keys.includes('ApiToken') || keys.includes('Vertical')) {
      console.log('Detected health insurance lead format');
      return await handleHealthInsuranceLead(body, request, isTestModeForPhoneNumber); 
    }
    // This is the standard lead format
    else {
      console.log('Using standard lead format');
      return await handleStandardLead(body, request, isTestModeForPhoneNumber);
    }
  } catch (error) {
    console.error('Error processing lead submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process lead submission: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Handle standard lead format
async function handleStandardLead(body: any, request: Request, isTestModeForPhoneNumber: boolean = false) {
  try {
    // Support both camelCase and snake_case field names
    const firstName = body.firstName || body.first_name || body.FirstName;
    const lastName = body.lastName || body.last_name || body.LastName;
    const email = body.email || body.Email || body.EmailAddress;
    const phone = body.phone || body.Phone || body.PhoneNumber;
    const zipCode = body.zipCode || body.zip_code || body.ZipCode;
    const trustedFormCertUrl = body.trustedFormCertUrl || body.trusted_form_cert_url || body.TrustedForm;
    // Use 'let' instead of 'const' to allow correcting the list ID for special cases
    let listId = body.listId || body.list_id;
    let campaignId = body.campaignId || body.campaign_id; // Changed to let
    let cadenceId = body.cadenceId || body.cadence_id;   // Changed to let

    const normalizedPhone = phone ? phone.replace(/\D/g, '') : '';

    if (isTestModeForPhoneNumber && normalizedPhone === TEST_PHONE_NUMBER) {
      console.log(`[TEST MODE] In handleStandardLead: Detected test phone number ${TEST_PHONE_NUMBER}. ListId will be forced.`);
      listId = TEST_JUICED_MEDIA_LIST_ID;
      // campaignId and cadenceId from request will be used for initial validation,
      // but will be overridden by list_routings for TEST_JUICED_MEDIA_LIST_ID later.
      console.log(`[TEST MODE] Set listId to ${listId}. Original campaignId ('${campaignId}') and cadenceId ('${cadenceId}') will be used for initial validation only.`);
    }
    const token = body.token || body.Token;
    
    // New required compliance fields
    const incomeBracket = body.incomeBracket || body.income_bracket || body.IncomeBracket;
    const ageRange = body.ageRange || body.age_range || body.AgeRange;
    const dob = body.dob || body.dateOfBirth || body.date_of_birth || body.DateOfBirth || body.birthDate || body.birth_date || body.BirthDate;
    const homeownerStatus = body.homeownerStatus || body.homeowner_status || body.HomeownerStatus || body.residenceType || body.residence_type;
    const state = body.state || body.State;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !listId || !campaignId || 
        !incomeBracket || !state || !homeownerStatus || !(ageRange || dob)) {
      console.error('Missing required fields:', { 
        firstName, lastName, email, phone, listId, campaignId,
        incomeBracket, state, homeownerStatus, ageRange, dob 
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          received: { 
            firstName, lastName, email, phone, listId, campaignId,
            incomeBracket, state, homeownerStatus, ageRange, dob 
          },
          required: [
            'firstName', 'lastName', 'email', 'phone', 'listId', 'campaignId',
            'incomeBracket', 'state', 'homeownerStatus', 'ageRange or dob'
          ]
        },
        { status: 400 }
      );
    }
    
    // Note: State validation will be performed after dialer routing is determined

    console.log('Submitting standard lead with validated fields:', { firstName, lastName, email, phone });
    
    // Clean the phone number for consistency checks
    const normalizedPhoneForComplianceCheck = phone ? phone.replace(/\D/g, '') : '';
    
    // First check if this is a duplicate lead within the past 30 days (unless it's a test phone)
    if (!isTestModeForPhoneNumber || normalizedPhoneForComplianceCheck !== TEST_PHONE_NUMBER) {
      console.log(`[DUPLICATE CHECK] Checking if phone ${normalizedPhoneForComplianceCheck} was submitted in the past 30 days`);
      
      const duplicateCheck = await checkForDuplicateLead(normalizedPhoneForComplianceCheck);
      
      if (duplicateCheck.isDuplicate) {
        console.log(`[DUPLICATE CHECK] BLOCKING LEAD: Phone ${normalizedPhoneForComplianceCheck} was submitted ${duplicateCheck.details?.daysAgo} days ago`);
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: `Duplicate lead: Phone number was submitted within the past 30 days`,
            details: {
              phoneNumber: normalizedPhoneForComplianceCheck,
              originalSubmissionDate: duplicateCheck.details?.originalSubmissionDate,
              daysAgo: duplicateCheck.details?.daysAgo,
              source: 'shift44' // Adding source info for debugging
            }
          },
          { status: 400 }
        );
      }
      
      console.log(`[DUPLICATE CHECK] Phone ${normalizedPhoneForComplianceCheck} is not a duplicate`);
    } else {
      console.log(`[TEST MODE] Bypassing duplicate check for test phone number ${TEST_PHONE_NUMBER}`);
    }
    
    // Perform comprehensive compliance check across all sources - using the same engine as the /compliance page
    let complianceReport: { isCompliant: boolean; results: Array<{ source: string; isCompliant: boolean; reasons: string[] }> };
    let phoneValidationResult: { isCompliant: boolean; reason?: string; details: Record<string, any> };
    let isCompliant: boolean;

    if ((isTestModeForPhoneNumber && normalizedPhoneForComplianceCheck === TEST_PHONE_NUMBER)) {
      console.log(`[TEST MODE] In handleStandardLead: Bypassing compliance checks for special test number.`);
      complianceReport = { 
        isCompliant: true, 
        results: [{ source: 'Test Mode Bypass', isCompliant: true, reasons: ["Test phone number bypass"] }] 
      };
      phoneValidationResult = { 
        isCompliant: true, 
        reason: 'Test Mode Bypass',
        details: { validationStatus: 'allowed', info: 'Test mode bypass for phone validation' } 
      };
      isCompliant = true;
    } else {
      console.log('Performing comprehensive compliance check for phone:', phone);
      
      const complianceEngine = new ComplianceEngine();
      complianceReport = await complianceEngine.checkPhoneNumber(phone);
      
      // Phone validation disabled per user request
      // console.log('Performing phone validation check for:', phone);
      // phoneValidationResult = await checkPhoneCompliance(phone); // Directly assign
      phoneValidationResult = { 
        isCompliant: true, 
        reason: 'Phone validation disabled',
        details: { validationStatus: 'bypassed', info: 'Phone validation disabled per user request' } 
      };
      
      isCompliant = complianceReport.isCompliant; // Only use DNC compliance, phone validation disabled
    }
    
    if (!isCompliant) {
      // Gather failed sources from DNC checkers
      const failedChecks = complianceReport.results.filter(result => !result.isCompliant);
      let failedSources = failedChecks.map(check => check.source);
      let failedReasons = failedChecks.flatMap(check => check.reasons);
      
      // Add phone validation failure if applicable
      if (!phoneValidationResult.isCompliant) {
        failedSources.push('Phone Validation');
        failedReasons.push(phoneValidationResult.reason || 'Failed phone validation');
      }
      
      const failedSourcesStr = failedSources.join(', ');
      console.log('Phone number failed compliance check, rejecting lead with $0 bid:', phone);
      
      return NextResponse.json(
        { 
          success: false, 
          bid: 0.00, // Force $0 bid for non-compliant leads regardless of routing
          error: `Phone number failed compliance check with: ${failedSources}`, 
          details: {
            failedSources: failedSources,
            reasons: failedReasons,
            phoneNumber: phone,
            phoneValidation: phoneValidationResult,
            complianceResults: complianceReport.results
          }
        },
        { status: 400 }
      );
    }
    
    // If the lead passes compliance checks, use the normal bid from routing
    let bidValue = 0.00; // Default bid value - will be updated from list routing later
    let routingData: any = null; // Will store routing data if found
    let effectiveCampaignId = campaignId; // Default is the one passed in the request
    let effectiveCadenceId = cadenceId; // Default is the one passed in the request
    
    // Determine traffic source based on list_id
    let trafficSource = body.trafficSource || body.traffic_source;
    
    // If no traffic_source is provided, set it based on list_id mapping
    if (!trafficSource) {
      if (listId === '1b759535-2a5e-421e-9371-3bde7f855c60') {
        trafficSource = 'Onpoint';
      } else if (listId === 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e') {
        trafficSource = 'Juiced';
      }
    }

    console.log('Using traffic source:', trafficSource);

    // Create Supabase client
    const supabase = createServerClient();

    // Insert lead into the database
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          address: body.address || '',
          city: body.city || '',
          state: state,
          zip_code: zipCode || '',
          source: body.source || '',
          // Removed bid field as it's not in the database schema
          trusted_form_cert_url: trustedFormCertUrl || '',
          transaction_id: body.transactionId || body.transaction_id || '',
          custom_fields: body.customFields || body.custom_fields || null,
          list_id: listId,
          campaign_id: campaignId,
          traffic_source: trafficSource,
          cadence_id: cadenceId || null,
          token: token || null,
          income_bracket: incomeBracket,
          age_range: ageRange || '',
          birth_date: dob ? new Date(dob).toISOString().split('T')[0] : null,
          homeowner_status: homeownerStatus,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Failed to insert standard lead:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to insert lead' },
        { status: 500 }
      );
    }

    console.log('Lead inserted successfully:', data);
    
    // Look up campaign and cadence IDs from the routings table
    console.log('Looking up routing data for list ID:', listId);

    const normalizedPhoneForRoutingCheck = phone ? phone.replace(/\D/g, '') : '';
    if (isTestModeForPhoneNumber && normalizedPhoneForRoutingCheck === TEST_PHONE_NUMBER && listId === TEST_JUICED_MEDIA_LIST_ID) {
      console.log(`[TEST MODE] Proceeding with list_routings lookup for TEST_JUICED_MEDIA_LIST_ID (${TEST_JUICED_MEDIA_LIST_ID}). CampaignId ('${campaignId}') and CadenceId ('${cadenceId}') from the request will be IGNORED if routing data provides its own.`);
    }
    
    // Handle Onpoint leads with fuzzy list ID matching
    // This handles cases where minor variations in the Onpoint list ID are sent
    const correctOnpointListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
    
    // Check if this is an Onpoint lead based on list ID pattern or source
    const isOnpointListId = (
      listId === correctOnpointListId || 
      (listId && listId.length > 30 && (
        listId.includes('759') && 
        listId.includes('3bde7f8') && 
        listId.includes('421e-9371')
      ))
    );
    
    const isOnpointSource = (
      body.source?.toLowerCase()?.includes('onpoint') || 
      body.Source?.toLowerCase()?.includes('onpoint')
    );
    
    if (isOnpointListId || isOnpointSource) {
      console.log('IMPORTANT - Detected Onpoint lead with listId:', listId);
      console.log('Onpoint lead campaign ID:', campaignId);
      console.log('Onpoint lead cadence ID:', cadenceId);
      
      // Correct the list ID for Onpoint leads to ensure they're properly processed
      if (listId !== correctOnpointListId) {
        console.log(`Correcting Onpoint list ID from ${listId} to ${correctOnpointListId}`);
        listId = correctOnpointListId;
      }
    }
    
    // Variables were already declared earlier
    // Just set their initial values here
    routingData = null;
    effectiveCampaignId = campaignId || '';
    effectiveCadenceId = cadenceId || '';
    
    console.log('Initial values:', { campaignId, cadenceId });
    
    // Query list_routings to get routing data including the bid
    const { data: routingResults, error: routingError } = await supabase
      .from('list_routings')
      .select('*')
      .eq('list_id', listId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
      
    if (routingError) {
      console.error('Error looking up list routing:', routingError);
    }
    
    console.log('Routing results:', routingResults);
      
    // Get the bid value to store with the lead
    
    if (routingResults) {
      routingData = routingResults;
      console.log(`Found list routing for ${listId}:`, routingData);
      
      // Get the bid value from routing data
      if (routingData.bid) {
        bidValue = routingData.bid;
        console.log(`Using bid value from list routing: $${bidValue.toFixed(2)}`);
      }
      
      // Override campaign_id and cadence_id if provided in the routing
      if (routingData.campaign_id) {
        console.log(`Overriding campaign_id from ${effectiveCampaignId} to ${routingData.campaign_id}`);
        effectiveCampaignId = routingData.campaign_id;
      }
      
      if (routingData.cadence_id) {
        console.log(`Overriding cadence_id from ${effectiveCadenceId} to ${routingData.cadence_id}`);
        effectiveCadenceId = routingData.cadence_id;
      }
    } else {
      console.log('No routing found for list ID:', listId);
      
      // Set default bid values based on known list IDs if no routing found
      if (listId === '1b759535-2a5e-421e-9371-3bde7f855c60' || isOnpointListId || isOnpointSource) {
        bidValue = 0.50; // Default for Onpoint
        console.log('Using default bid value for Onpoint: $0.50');
      } else if (listId === 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e') {
        bidValue = 1.00; // Default for Juiced
        console.log('Using default bid value for Juiced: $1.00');
      }
    }
    
    console.log('Final values used for dialer:', { effectiveCampaignId, effectiveCadenceId });
    
    // Get the dialer type from routing data (default to internal dialer if not specified)
    const dialerType = routingData?.dialer_type || DIALER_TYPE_INTERNAL;
    console.log(`Using dialer type: ${dialerType === DIALER_TYPE_INTERNAL ? 'Internal Dialer' : 'Pitch BPO'}`);

    // Validate state based on dialer type
    const normalizedState = state.toUpperCase();
    const allowedStates = dialerType === DIALER_TYPE_PITCH_BPO ? PITCH_BPO_ALLOWED_STATES : INTERNAL_DIALER_ALLOWED_STATES;
    const dialerName = dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : 'Internal Dialer';
    
    if (!allowedStates.includes(normalizedState)) {
      console.log(`[STATE VALIDATION] Rejecting lead with non-allowed state: ${state} for ${dialerName}`);
      return NextResponse.json(
        {
          success: false,
          bid: 0.00,
          error: `State ${state} not allowed for ${dialerName}`,
          details: {
            state: state,
            dialerType: dialerName,
            allowedStates: allowedStates
          }
        },
        { status: 400 }
      );
    }
    
    console.log(`[STATE VALIDATION] State ${state} is allowed for ${dialerName}`);

    // Check if this lead should be forwarded to the appropriate dialer API
    // Any list ID in the routing settings will have routingData and be eligible for forwarding
    if (routingData) {
      // Log the effective cadence ID that will be used for the lead
      const isOnpointLead = listId === '1b759535-2a5e-421e-9371-3bde7f855c60';
      
      if (isOnpointLead) {
        console.log(`Onpoint lead detected - using cadence ID from routing management: ${effectiveCadenceId}`);
      }
      
      try {
        // If this is the Pitch BPO dialer type, route to Pitch BPO instead of internal dialer
        if (dialerType === DIALER_TYPE_PITCH_BPO) {
          console.log('Routing lead to Pitch BPO (dialer_type=2)');
          return await forwardToPitchBPO({
            data,
            listId, // We'll still pass this to the function but won't include it in the API payload
            phone,
            firstName,
            lastName,
            email,
            zipCode,
            state,
            bidValue: bidValue,
            routingData
          });
        }
        
        console.log('Forwarding lead to internal dialer API for list:', listId);
        
        // Prepare the lead data for dialer API - follow exact format expected by dialer
        // Format phone number with +1 prefix if it doesn't have it already
        const formattedPhone = phone.startsWith('+1') ? phone : `+1${phone.replace(/\D/g, '')}`;
        
        // Define the type for dialer payload to avoid TypeScript errors
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
          compliance_lead_id: string; // Add compliance_lead_id to the interface
        };
        
        // Create the dialer payload with all required fields
        const dialerPayload: DialerPayload = {
          // Primary lead fields
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: formattedPhone,
          address: body.address || '',
          city: body.city || '',
          state: state || '',
          zip_code: zipCode || '',
          source: body.source || 'Compliance API',
          trusted_form_cert_url: trustedFormCertUrl || '',
          transaction_id: body.transactionId || body.transaction_id || '',
          
          // Important compliance and demographic fields
          income_bracket: incomeBracket,
          dob: dob || '',
          homeowner_status: homeownerStatus,
          
          // Custom fields passed through as a nested object
          custom_fields: {
            ...(body.customFields || body.custom_fields || {}),
            compliance_lead_id: data[0].id // Add compliance_lead_id to custom fields
          },
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          compliance_lead_id: data[0].id
        };
        
        // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
        // Use the routing token if available, then the provided token, then fallback to a default
        let authToken = '';
        
        if (routingData && routingData.token) {
          console.log(`Using token from routing settings: ${routingData.token}`);
          authToken = routingData.token;
        } else if (token) {
          console.log(`Using token from request: ${token}`);
          authToken = token;
        } else {
          console.log('No token available, using default token');
          authToken = '7f108eff2dbf3ab07d562174da6dbe53';
        }
        
        // Construct the URL with required parameters in the query string
        const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
        dialerUrl.searchParams.append('list_id', listId);
        dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
        dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
        dialerUrl.searchParams.append('token', authToken);
        
        console.log('Sending lead to dialer API:', dialerUrl.toString());
        console.log('Dialer payload with compliance_lead_id:', JSON.stringify(dialerPayload, null, 2));
        console.log('Lead ID being sent to dialer:', dialerPayload.compliance_lead_id);
        
        // Send the lead to the dialer API
        const dialerResponse = await fetch(dialerUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dialerPayload)
        });
        
        const dialerResult = await dialerResponse.json();
        console.log('Dialer API response:', dialerResult);
        
        // Check if dialer response contains a compliance_lead_id to associate with our lead_id
        if (dialerResult && dialerResult.compliance_lead_id) {
          console.log('Received compliance_lead_id from dialer:', dialerResult.compliance_lead_id);
          
          // Update the lead record with the dialer's compliance_lead_id
          try {
            const supabase = createServerClient();
            await supabase
              .from('leads')
              .update({ 
                dialer_compliance_id: dialerResult.compliance_lead_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', data[0].id);
            
            console.log('Successfully associated dialer compliance_lead_id with lead record');
          } catch (updateError) {
            console.error('Error updating lead with compliance_lead_id:', updateError);
          }
        }
        
        // Include the dialer response in our API response
        const responseObj: any = {
          success: true,
          lead_id: data[0].id,
          data: data[0],
          bid: routingData?.bid || 0.00,
          dialer: {
            type: 'internal',
            forwarded: true,
            status: dialerResponse.status,
            response: dialerResult
          }
        };
        
        return NextResponse.json(responseObj);
      } catch (dialerError) {
        console.error('Error forwarding lead to dialer:', dialerError);
        // Still return success for the lead insertion, but include the dialer error
        // Include bid information for successful lead submission even when dialer fails
        return NextResponse.json({ 
          success: true, 
          lead_id: data[0].id, // Explicitly return the lead ID
          data: data[0],
          bid: routingData?.bid || 0.00,
          dialer: {
            forwarded: false,
            error: dialerError instanceof Error ? dialerError.message : 'Unknown error'
          }
        });
      }
    }
    
    // Include bid in the response for successful submissions
    return NextResponse.json({
      success: true, 
      lead_id: data[0].id, // Explicitly return the lead ID
      data: data[0],
      bid: routingData?.bid || 0.00
    });
  } catch (error: any) {
    console.error('Error in leads API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

// Handle health insurance lead format
async function handleHealthInsuranceLead(body: any, request: Request, isTestModeForPhoneNumber: boolean = false) {
  try {
    if (isTestModeForPhoneNumber) {
      const phoneFromHealthLead = (body.ContactData && body.ContactData.Phone) ? body.ContactData.Phone.replace(/\D/g, '') : '';
      if (phoneFromHealthLead === TEST_PHONE_NUMBER) {
        console.log(`[TEST MODE] handleHealthInsuranceLead called for test phone number ${TEST_PHONE_NUMBER}. Specific compliance bypass for this handler is not fully implemented.`);
      }
    }
    console.log('Processing health insurance lead...');
    
    // Create the contact data for health insurance lead
    const contactData = body.ContactData || {};
    const person = body.Person || {};
    const conditions = body.Conditions || {};
    const medicalHistory = body.MedicalHistory || {};
    const requestedInsurance = body.RequestedInsurance || {};
    const currentInsurance = body.CurrentInsurance || {};
    
    // Extract cadence_id and token if provided
    const cadenceId = body.CadenceID || body.cadenceId || body.cadence_id || null;
    const token = body.Token || body.token || null;
    
    // Extract lead demographic info
    const firstName = contactData.FirstName || '';
    const lastName = contactData.LastName || '';
    const email = contactData.Email || '';
    const phone = contactData.Phone || '';
    const state = contactData.State || '';
    
    // Compliance fields - extract from various potential locations
    const incomeBracket = person.HouseHoldIncome || '50000-75000';  // Default value
    const ageRange = '';  // Derive from DOB if needed
    const dob = person.DOB || '';
    const homeownerStatus = contactData.ResidenceType || 'Not Provided';
    
    // Validate required fields for health insurance lead
    if (!firstName || !lastName || !email || !phone || !state) {
      console.error('Missing required fields for health insurance lead:', {
        firstName, lastName, email, phone, state
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields for health insurance lead',
          received: {
            firstName, lastName, email, phone, state
          },
          required: ['firstName', 'lastName', 'email', 'phone', 'state']
        },
        { status: 400 }
      );
    }
    
    // Validate that the state is in the allowed list (health insurance leads use internal dialer)
    const normalizedState = state.toUpperCase();
    if (!INTERNAL_DIALER_ALLOWED_STATES.includes(normalizedState)) {
      console.log(`[STATE VALIDATION] Rejecting health insurance lead with non-allowed state: ${state}`);
      return NextResponse.json(
        {
          success: false,
          bid: 0.00,
          error: `State ${state} not allowed for Internal Dialer`,
          details: {
            state: state,
            dialerType: 'Internal Dialer',
            allowedStates: INTERNAL_DIALER_ALLOWED_STATES
          }
        },
        { status: 400 }
      );
    }
    
    console.log(`[STATE VALIDATION] State ${state} is allowed for health insurance lead (Internal Dialer)`);
    
    // Perform comprehensive compliance check for health insurance lead phone
    console.log('Performing compliance check for health insurance lead phone:', phone);
    
    // 1. Check using the five DNC sources (TCPA, Blacklist, WebRecon, Internal DNC, Synergy DNC)
    const engine = new ComplianceEngine();
    const complianceReport = await engine.checkPhoneNumber(phone);
    
    // 2. Phone validation disabled per user request
    // console.log('Performing phone validation check for:', phone);
    // const phoneValidationResult = await checkPhoneCompliance(phone);
    const phoneValidationResult = { 
      isCompliant: true, 
      reason: 'Phone validation disabled',
      details: { validationStatus: 'bypassed', info: 'Phone validation disabled per user request' } 
    };
    
    // Combined compliance result - only use DNC checks since phone validation is disabled
    const isCompliant = complianceReport.isCompliant; // Phone validation disabled
    
    if (!isCompliant) {
      // Gather failed sources from DNC checkers
      const failedChecks = complianceReport.results.filter(result => !result.isCompliant);
      let failedSources = failedChecks.map(check => check.source);
      let failedReasons = failedChecks.flatMap(check => check.reasons);
      
      // Add phone validation failure if applicable
      if (!phoneValidationResult.isCompliant) {
        failedSources.push('Phone Validation');
        failedReasons.push(phoneValidationResult.reason || 'Failed phone validation');
      }
      
      const failedSourcesStr = failedSources.join(', ');
      console.log('Health insurance lead phone failed compliance check:', phone);
      
      return NextResponse.json(
        { 
          success: false,
          bid: 0.00, // Force $0 bid for non-compliant leads regardless of routing
          error: `Phone number failed compliance check with: ${failedSources}`, 
          details: {
            failedSources: failedSources,
            reasons: failedReasons,
            phoneNumber: phone,
            phoneValidation: phoneValidationResult,
            complianceResults: complianceReport.results
          }
        },
        { status: 400 }
      );
    }
    
    // If the lead passes compliance checks, use the normal bid from routing
    
    // Create Supabase client
    const supabase = createServerClient();

    // Check if the schema has the necessary fields for health insurance leads
    try {
      // Check if the leads table has been updated with health insurance fields
      const { data: tableInfo, error: tableError } = await supabase
        .from('leads')
        .select('vertical')
        .limit(1);
        
      if (tableError) {
        console.error('Failed to check schema:', tableError);
        return NextResponse.json(
          { success: false, error: 'Database schema not ready for health insurance leads. Run the migration first.' },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error('Failed to check schema:', err);
    }
    
    // Insert health insurance lead into the database
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          // Basic lead info
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          trusted_form_cert_url: body.TrustedForm || '',
          list_id: body.SubId || 'health-insurance-default',
          campaign_id: body.Vertical || 'health-insurance-campaign',
          traffic_source: body.Source || (body.SubId === 'OPG4' ? 'Onpoint' : ''),
          
          // Address details
          address: contactData.Address || '',
          city: contactData.City || '',
          state: state,
          zip_code: contactData.ZipCode || '',
          
          // Compliance fields
          income_bracket: incomeBracket,
          age_range: ageRange || '',
          homeowner_status: homeownerStatus,
          
          // API details
          api_token: body.ApiToken || '',
          vertical: body.Vertical || '',
          sub_id: body.SubId || '',
          user_agent: body.UserAgent || '',
          original_url: body.OriginalUrl || '',
          jornaya_lead_id: body.JornayaLeadId || '',
          session_length: body.SessionLength || '',
          tcpa_text: body.TcpaText || '',
          verify_address: body.VerifyAddress === 'true',
          original_creation_date: body.OriginalCreationDate ? new Date(body.OriginalCreationDate).toISOString() : null,
          site_license_number: body.SiteLicenseNumber || '',
          ip_address: contactData.IpAddress || '',
          
          // Contact details
          day_phone_number: contactData.DayPhoneNumber || '',

          years_at_residence: contactData.YearsAtResidence || '',
          months_at_residence: contactData.MonthsAtResidence || '',
          
          // Person details
          birth_date: dob ? new Date(dob).toISOString().split('T')[0] : null,
          gender: person.Gender || '',
          marital_status: person.MaritalStatus || '',
          relationship_to_applicant: person.RelationshipToApplicant || '',
          denied_insurance: person.DeniedInsurance || '',
          us_residence: person.USResidence === 'True',
          height_ft: person.Height_FT || '',
          height_inch: person.Height_Inch || '',
          weight: person.Weight || '',
          student: person.Student === 'true',
          occupation: person.Occupation || '',
          education: person.Education || '',
          house_hold_size: person.HouseHoldSize || '',
          
          // Medical information (as JSON)
          conditions: conditions,
          medical_history: medicalHistory,
          
          // Insurance information
          coverage_type: requestedInsurance.CoverageType || '',
          insurance_company: currentInsurance.InsuranceCompany || '',
          
          cadence_id: cadenceId,
          token: token,
          
          created_at: new Date().toISOString(),
          source: body.Source || ''
        }
      ])
      .select();
      
    if (error) {
      console.error('Failed to insert health insurance lead:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to insert health insurance lead' },
        { status: 500 }
      );
    }

    // Look up campaign and cadence IDs from the routings table
    let listId = body.SubId || 'health-insurance-default';
    console.log('Looking up routing data for list ID:', listId);
    
    // Handle Onpoint leads with fuzzy list ID matching in health insurance leads
    const correctOnpointListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
    
    // Check if this is an Onpoint lead based on list ID pattern
    const isOnpointListId = (
      listId === correctOnpointListId || 
      (listId && listId.length > 30 && (
        listId.includes('759') && 
        listId.includes('3bde7f8') && 
        listId.includes('421e-9371')
      ))
    );
    
    if (isOnpointListId || body.source?.toLowerCase()?.includes('onpoint')) {
      console.log('IMPORTANT - Detected Onpoint health insurance lead with listId:', listId);
      
      // Correct the list ID for Onpoint leads
      if (listId !== correctOnpointListId) {
        console.log(`Correcting Onpoint list ID from ${listId} to ${correctOnpointListId}`);
        listId = correctOnpointListId;
      }
    }
    
    let routingData = null;
    // Create mutable copies of the campaign and cadence IDs
    let effectiveCampaignId = body.Vertical || '';
    let effectiveCadenceId = body.CadenceID || body.cadenceId || body.cadence_id || null;
    let bid = 0.00;
    
    console.log('Initial values:', { campaignId: effectiveCampaignId, cadenceId: effectiveCadenceId });
    
    // Normalize the list ID to ensure consistent matching
    const normalizedListId = listId.trim().toLowerCase();
    
    // Query list_routings to get routing data including the bid
    const { data: routingResults, error: routingError } = await supabase
      .from('list_routings')
      .select('*')
      .eq('list_id', listId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
      
    if (routingError) {
      console.error('Error looking up list routing:', routingError);
    }
    
    console.log('Routing results:', routingResults);
      
    if (routingResults) {
      routingData = routingResults;
      console.log(`Found list routing for ${listId}:`, routingData);
      
      // Override campaign_id and cadence_id if provided in the routing
      if (routingData.campaign_id) {
        console.log(`Overriding campaign_id from ${effectiveCampaignId} to ${routingData.campaign_id}`);
        effectiveCampaignId = routingData.campaign_id;
      }
      
      if (routingData.cadence_id) {
        console.log(`Overriding cadence_id from ${effectiveCadenceId} to ${routingData.cadence_id}`);
        effectiveCadenceId = routingData.cadence_id;
      }
      
      if (routingData.bid) {
        bid = routingData.bid;
      }
    } else {
      console.log('No routing found for list ID:', listId);
    }
    
    console.log('Final values used for dialer:', { effectiveCampaignId, effectiveCadenceId });

    // Check if this lead should be forwarded to the dialer API based on routing configuration
    let dialerResponse = null;
    if (routingData) {
      // Load balancing for Onpoint leads - split between two cadence IDs
      const isOnpointLead = listId === '1b759535-2a5e-421e-9371-3bde7f855c60';
      
      if (isOnpointLead) {
        // Use phone number or email as a deterministic way to split leads
        // This ensures the same lead always goes to the same cadence
        const hashSource = contactData.Phone || contactData.Email || '';
        const useFirstCadence = hashSource.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0) % 2 === 0;
        
        const onpointCadenceOptions = [
          'd669792b-2b43-4c8e-bb9d-d19e5420de63', // First cadence (50%)
          '39a9381e-14ef-4fdd-a95a-9649025590a4'  // Second cadence (50%)
        ];
        
        const selectedCadence = useFirstCadence ? onpointCadenceOptions[0] : onpointCadenceOptions[1];
        console.log(`Onpoint health insurance lead detected - load balancing to cadence: ${selectedCadence} (${useFirstCadence ? 'first' : 'second'} group)`);
        
        // Override the cadence ID for Onpoint leads
        effectiveCadenceId = selectedCadence;
      }
      
      try {
        console.log('Forwarding health insurance lead to dialer API for list:', listId);
        
        // Format phone number with +1 prefix if it doesn't have it already
        const formattedPhone = phone.startsWith('+1') ? phone : `+1${phone.replace(/\D/g, '')}`;        
        
        // Define the type for dialer payload to avoid TypeScript errors
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
          compliance_lead_id: string; // Add compliance_lead_id to the interface
        };
        
        // Create the dialer payload with all required fields
        const dialerPayload: DialerPayload = {
          // Primary lead fields
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: formattedPhone,
          address: contactData.Address || '',
          city: contactData.City || '',
          state: state || '',
          zip_code: contactData.ZipCode || '',
          source: 'Health Insurance API',
          trusted_form_cert_url: body.TrustedForm || '',
          transaction_id: '',
          
          // Important compliance and demographic fields
          income_bracket: incomeBracket,
          dob: dob || '',
          homeowner_status: homeownerStatus,
          
          // Custom fields passed through as a nested object
          custom_fields: {
            compliance_lead_id: data[0].id // Add compliance_lead_id to custom fields
          },
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          compliance_lead_id: data[0].id
        };
        
        // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
        // Use the routing token if available, then the provided token, then fallback to a default
        let authToken = '';
        
        if (routingData && routingData.token) {
          console.log(`Using token from routing settings: ${routingData.token}`);
          authToken = routingData.token;
        } else if (body.ApiToken) {
          console.log(`Using token from request: ${body.ApiToken}`);
          authToken = body.ApiToken;
        } else {
          console.log('No token available, using default token');
          authToken = '7f108eff2dbf3ab07d562174da6dbe53';
        }
        
        // Construct the URL with required parameters in the query string
        const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
        dialerUrl.searchParams.append('list_id', listId);
        dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
        dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
        dialerUrl.searchParams.append('token', authToken);
        
        console.log('Sending health insurance lead to dialer API:', dialerUrl.toString());
        console.log('Dialer payload with compliance_lead_id:', JSON.stringify(dialerPayload, null, 2));
        console.log('Lead ID being sent to dialer:', dialerPayload.compliance_lead_id);
        
        // Send the lead to the dialer API
        const response = await fetch(dialerUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dialerPayload)
        });
        
        dialerResponse = await response.json();
        console.log('Dialer API response:', dialerResponse);
        
        // Check if dialer response contains a compliance_lead_id to associate with our lead_id
        if (dialerResponse && dialerResponse.compliance_lead_id) {
          console.log('Received compliance_lead_id from dialer:', dialerResponse.compliance_lead_id);
          
          // Update the lead record with the dialer's compliance_lead_id
          try {
            const supabase = createServerClient();
            await supabase
              .from('leads')
              .update({ 
                dialer_compliance_id: dialerResponse.compliance_lead_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', data[0].id);
            
            console.log('Successfully associated dialer compliance_lead_id with lead record');
          } catch (updateError) {
            console.error('Error updating lead with compliance_lead_id:', updateError);
          }
        }
        
      } catch (dialerError: any) {
        console.error('Error forwarding health insurance lead to dialer:', dialerError);
        dialerResponse = { error: dialerError?.message || 'Unknown error' };
      }
    }

    // Include bid, lead_id, and dialer response in the API response
    const responseObj: any = {
      success: true, 
      lead_id: data[0].id, // Explicitly return the lead ID
      data: data[0],
      bid: bid
    };
    
    if (dialerResponse) {
      responseObj.dialer = {
        forwarded: true,
        response: dialerResponse
      };
    }
    
    return NextResponse.json(responseObj);
    } catch (error) {
      console.error('Error processing health insurance lead submission:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process health insurance lead submission' },
        { status: 500 }
      );
    }
  }
