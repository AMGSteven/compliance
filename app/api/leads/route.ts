import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ComplianceEngine } from '@/lib/compliance/engine';
import { checkPhoneCompliance } from '@/app/lib/real-phone-validation';
import { validatePhoneDirectly } from '@/app/lib/phone-validation-hook';
import { checkForDuplicateLead, checkForDuplicateLeadInVertical } from '@/app/lib/duplicate-lead-check';
import { TrustedFormService } from '@/lib/services/trusted-form';
import { normalizeSubIdKey } from '@/lib/utils/subid';
import { getAllowedStatesForVertical, isStateAllowedForVertical } from '@/lib/vertical-state-validator';

// Main POST handler for all lead formats
// Force dynamic routing for Vercel deployment
export const dynamic = 'force-dynamic';

// Define allowed states per dialer type
const INTERNAL_DIALER_ALLOWED_STATES = ['AL', 'AR', 'AZ', 'GA', 'IN', 'KY', 'LA', 'ME', 'MI', 'MO', 'MS', 'NC', 'NM', 'OH', 'PA', 'SC', 'TN', 'VA', 'WV'];
const PITCH_BPO_ALLOWED_STATES = ['AL', 'AR', 'AZ', 'FL', 'IN', 'KS', 'LA', 'MI', 'MO', 'MS', 'OH', 'OK', 'SC', 'TN', 'TX'];
const CONVOSO_ALLOWED_STATES = ['TX', 'FL', 'CA', 'PA', 'NY', 'IL', 'OH', 'GA', 'MI', 'NC', 'NJ', 'VA', 'WA', 'AZ', 'TN', 'MA', 'IN', 'MD', 'MO', 'WI', 'MN', 'CO', 'AL', 'SC', 'LA', 'OR', 'OK', 'CT', 'IA', 'AR', 'UT', 'NV', 'KS', 'NM', 'NE', 'WV', 'ID', 'HI', 'NH', 'ME', 'RI', 'MT', 'DE', 'SD', 'AK', 'ND', 'VT', 'WY'];

// Test constants for bypassing compliance and forcing routing
const TEST_PHONE_NUMBER = '6507769592'; // User's number for testing
const TEST_JUICED_MEDIA_LIST_ID = 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e'; // Juiced Media List ID

// Dialer type constants
const DIALER_TYPE_INTERNAL = 1;
const DIALER_TYPE_PITCH_BPO = 2;
const DIALER_TYPE_CONVOSO = 3;

// Pitch BPO constants
const PITCH_BPO_UUID = '70942646-125b-4ddd-96fc-b9a142c698b8';
const PITCH_BPO_CAMPAIGN = 'Jade ACA';
const PITCH_BPO_SUBCAMPAIGN = 'Juiced Real Time'; // Juiced Media List ID

// Convoso (IBP BPO) API constants - using environment variables for security
const CONVOSO_AUTH_TOKEN = process.env.CONVOSO_AUTH_TOKEN || 'b3zkvwyo3gcxovyb0zhjhmqaer7ydhaf';
const CONVOSO_CRITERIA_KEY = process.env.CONVOSO_CRITERIA_KEY || '8nb95qx1kf9a9wnvb4nmhd3105us3w02';
const CONVOSO_LIST_ID_PROD = process.env.CONVOSO_LIST_ID_PROD || '6497'; // Production list ID
const CONVOSO_LIST_ID_TEST = process.env.CONVOSO_LIST_ID_TEST || '5989'; // Test list ID

/**
 * Check if a dialer is approved for a specific list ID
 * @param listId The list ID to check
 * @param dialerType The dialer type (1=Internal, 2=Pitch BPO, 3=Convoso)
 * @returns Promise<boolean> true if approved, false if denied
 */
async function isDialerApproved(listId: string, dialerType: number): Promise<boolean> {
  try {
    console.log(`⚙️ DIALER APPROVAL CHECK: Starting check for listId=${listId}, dialer_type=${dialerType}`);
    
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('dialer_approvals')
      .select('approved, reason, approved_by')
      .eq('list_id', listId)
      .eq('dialer_type', dialerType)
      .single();

    if (error) {
      console.warn(`⚠️ DIALER APPROVAL: No record found for listId: ${listId}, dialer_type: ${dialerType}. Error: ${error.message}. DEFAULTING TO APPROVED.`);
      return true; // Default to approved if no record exists (backward compatibility)
    }

    const isApproved = data.approved === true;
    const dialerName = dialerType === 1 ? 'Internal' : dialerType === 2 ? 'Pitch BPO' : dialerType === 3 ? 'Convoso' : 'Unknown';
    
    console.log(`✅ DIALER APPROVAL RESULT:`, {
      listId: listId,
      dialer_type: dialerType,
      dialer_name: dialerName,
      approved: data.approved,
      is_approved: isApproved,
      reason: data.reason || 'N/A',
      approved_by: data.approved_by || 'N/A',
      decision: isApproved ? 'ALLOW ROUTING' : 'BLOCK ROUTING'
    });

    return isApproved;
  } catch (error) {
    console.error(`❌ DIALER APPROVAL ERROR: Unexpected error checking approval for listId: ${listId}, dialer_type: ${dialerType}:`, error);
    console.log('ℹ️ DIALER APPROVAL: DEFAULTING TO APPROVED due to error (fail-safe)');
    return true; // Default to approved on error (fail-safe)
  }
}

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
  const { data, listId, phone, firstName, lastName, email, zipCode, state, bidValue, routingData } = params;
  const leadId = data[0].id;
  
  // Initialize Supabase client
  const supabase = createServerClient();
  
  console.log('Forwarding lead to Pitch BPO dialer');
  
  // Get the vertical from routing data to query vertical configs
  const vertical = routingData?.vertical || 'ACA'; // Default to ACA if no vertical specified
  console.log(`Lead vertical: ${vertical}`);
  
  // Query vertical_configs to get the correct token and settings for this vertical + Pitch BPO (dialer_type=2)
  let token = PITCH_BPO_UUID; // Fallback ACA token
  let campaign = PITCH_BPO_CAMPAIGN; // Fallback ACA campaign
  let subcampaign = PITCH_BPO_SUBCAMPAIGN; // Fallback ACA subcampaign
  
  try {
    const { data: verticalConfig } = await supabase
      .from('vertical_configs')
      .select('token, campaign_id, cadence_id')
      .eq('vertical', vertical)
      .eq('dialer_type', 2) // Pitch BPO
      .eq('active', true)
      .single();
    
    if (verticalConfig && verticalConfig.token) {
      token = verticalConfig.token;
      console.log(`Using token from vertical config for ${vertical}: ${token}`);
      
      // Token-based campaign/subcampaign mapping
      if (token === '9f62ddd5-384c-42bd-b862-0cdce7b00a73') {
        // Final Expense Pitch campaign
        campaign = 'Final Expense Pitch';
        subcampaign = 'Synergy FE RT';
        console.log('Using Final Expense Pitch campaign settings');
      } else if (token === 'b7aa238e-3f2a-488a-b223-a272aa48d252') {
        // Medicare campaign
        campaign = 'Medicare Aragon';
        subcampaign = 'Juiced Medicare RT';
        console.log('Using Medicare campaign settings');
      } else if (token === '70942646-125b-4ddd-96fc-b9a142c698b8') {
        // ACA campaign (keep existing values)
        campaign = 'Jade ACA';
        subcampaign = 'Juiced Real Time';
        console.log('Using ACA campaign settings');
      } else {
        console.log(`Using vertical config token ${token} with fallback ACA campaign settings`);
      }
    } else {
      console.log(`No vertical config found for ${vertical} + Pitch BPO, using fallback ACA settings`);
    }
  } catch (error) {
    console.error('Error querying vertical configs for Pitch BPO token:', error);
    console.log('Falling back to default ACA token and campaign settings');
  }
  
  // Extract the subID from lead's custom_fields if available
  const leadCustomFields = data[0].custom_fields || {};
  const leadSubId = typeof leadCustomFields === 'string'
    ? JSON.parse(leadCustomFields)?.subid || ''
    : leadCustomFields?.subid || '';
  
  console.log(`List ID to use for adv_SubID: ${listId}`);
  console.log(`SubId from custom_fields to use for adv_SubID2: ${leadSubId}`);
  console.log(`Campaign: ${campaign}, Subcampaign: ${subcampaign}`);
  
  try {
    // Create the URL with query parameters for Pitch BPO according to their documentation
    // https://docs.chasedatacorp.com/content-user-guide/docs-page-user-guide-other.html
    const pitchBPOUrl = new URL('https://api.chasedatacorp.com/HttpImport/InjectLead.php');
    
    // Add required parameters
    pitchBPOUrl.searchParams.append('token', token); // Required: security token (token-specific)
    pitchBPOUrl.searchParams.append('accid', 'pitchperfect'); // Confirmed correct account ID
    pitchBPOUrl.searchParams.append('Campaign', campaign); // Required: token-specific campaign
    pitchBPOUrl.searchParams.append('Subcampaign', subcampaign); // Optional: token-specific subcampaign
    
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

/**
 * Forward a lead to the Convoso (IBP BPO) dialer
 * @param params Parameters for the Convoso dialer
 * @returns API response with success status and lead data
 */
async function forwardToConvoso(params: {
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
  const { data, listId, phone, firstName, lastName, email, zipCode, state, bidValue, routingData } = params;
  const leadId = data[0].id;
  
  console.log('Forwarding lead to Convoso (IBP BPO) dialer');
  console.log('Using Convoso auth token:', CONVOSO_AUTH_TOKEN);
  
  // Extract custom fields for additional tracking
  const leadCustomFields = data[0].custom_fields || {};
  const leadSubId = typeof leadCustomFields === 'string'
    ? JSON.parse(leadCustomFields)?.subid || ''
    : leadCustomFields?.subid || '';
  
  try {
    // Determine which Convoso list ID to use - check routing data for test mode
    const isTestMode = routingData?.test_mode || listId.includes('test') || phone === TEST_PHONE_NUMBER;
    // Force test list ID 5989 for test mode to ensure proper routing
    const convosoListId = isTestMode ? '5989' : CONVOSO_LIST_ID_PROD;
    
    console.log(`Using Convoso list ID: ${convosoListId} (test mode: ${isTestMode})`);
    console.log('Test mode factors:', { 
      test_mode_flag: routingData?.test_mode, 
      listId_includes_test: listId.includes('test'), 
      is_test_phone: phone === TEST_PHONE_NUMBER,
      phone: phone,
      listId: listId
    });
    
    // Ensure phone number is properly formatted (remove any non-digits, ensure 10 digits)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? cleanPhone : cleanPhone.substring(cleanPhone.length - 10);
    
    console.log('Phone number formatting:', { original: phone, cleaned: cleanPhone, formatted: formattedPhone });
    
    // Prepare the payload according to Convoso API specs
    const convosoPayload = {
      auth_token: CONVOSO_AUTH_TOKEN,
      criteria_key: CONVOSO_CRITERIA_KEY,
      listId: convosoListId,
      first_name: firstName,
      last_name: lastName,
      email: email || '', // Optional but include if available
      phone_number: formattedPhone, // Ensure 10-digit US number
      address1: data[0].address || '', // Optional
      city: data[0].city || '', // Optional
      state: state, // Required - two-letter state abbreviation
      postal_code: zipCode || '', // Optional
      gender: data[0].gender || '', // Optional
      date_of_birth: data[0].date_of_birth || data[0].dob || '', // Optional - YYYY-MM-DD format
      trustedform: data[0].trusted_form_cert_url || '', // Optional TrustedForm certificate URL
      jornaya: data[0].jornaya_token || '', // Optional Jornaya token
      check_dnc: 1, // Required - DNC scrub flag
      check_dup: 3, // Required - Duplicate check flag
      subid_2: leadSubId || listId // Custom sub-ID for tracking
    };
    
    console.log('Sending lead to Convoso API:', JSON.stringify(convosoPayload, null, 2));
    
    // Use the new Convoso API endpoint as provided by IBP (GET with query parameters)
    const apiParams = new URLSearchParams({
      auth_token: CONVOSO_AUTH_TOKEN,
      listId: convosoListId,
      check_dup: '3',
      phone_code: '1', // US country code
      first_name: firstName,
      last_name: lastName,
      email: email || '', // Email field was missing
      phone_number: formattedPhone,
      address1: data[0].address || '',
      city: data[0].city || '',
      state: state,
      postal_code: zipCode || '',
      date_of_birth: data[0].date_of_birth || data[0].dob || '',
      trustedform: data[0].trusted_form_cert_url || '',
      jornaya: data[0].jornaya_token || '',
      subid_2: leadSubId || listId
    });
    
    const apiUrl = `https://api.convoso.com/v1/leads/insert?${apiParams.toString()}`;
    console.log('Convoso API URL:', apiUrl);
    
    const convosoResponse = await fetch(apiUrl, {
      method: 'GET'
    });
    
    const responseData = await convosoResponse.json();
    console.log('Convoso API response status:', convosoResponse.status);
    console.log('Convoso API response:', responseData);
    
    // Check if the response indicates success
    const isSuccess = responseData.success === true && responseData.data && responseData.data.lead_id;
    
    if (isSuccess) {
      // Update our lead record with Convoso's lead ID for tracking
      try {
        const supabase = createServerClient();
        await supabase
          .from('leads')
          .update({ 
            dialer_compliance_id: responseData.data.lead_id.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', data[0].id);
        
        console.log('Successfully associated Convoso lead_id with lead record');
      } catch (updateError) {
        console.error('Error updating lead with Convoso lead_id:', updateError);
      }
    }
    
    // Return the response with lead data and Convoso result
    return NextResponse.json({
      success: true,
      lead_id: data[0].id,
      data: data[0],
      bid: bidValue,
      dialer: {
        type: 'convoso',
        forwarded: true,
        status: convosoResponse.status,
        response: responseData,
        convoso_lead_id: responseData.data?.lead_id || null
      }
    });
  } catch (dialerError) {
    console.error('Error forwarding lead to Convoso:', dialerError);
    // Still return success for the lead insertion, but include the dialer error
    return NextResponse.json({
      success: true,
      lead_id: data[0].id,
      data: data[0],
      bid: bidValue,
      dialer: {
        type: 'convoso',
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
    
    // CRITICAL IMMEDIATE VALIDATION: Extract phone number and list ID from the request
    let phoneToCheck = '';
    let listId = '';
    
    // Extract phone number from appropriate field based on lead format
    if (body.ContactData && body.ContactData.Phone) {
      // Health insurance format
      phoneToCheck = body.ContactData.Phone;
      listId = body.SubId || body.listId || body.list_id || '';
    } else {
      // Standard format
      phoneToCheck = body.phone || body.Phone || '';
      listId = body.listId || body.list_id || '';
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
    
    // Duplicate check (re-enabled) - Vertical-specific if listId provided
    if (phoneToCheck && !isTestModeForPhoneNumber) {
      console.log(`[DUPLICATE CHECK] Checking if phone ${phoneToCheck} was submitted in the past 30 days`);
      
      let duplicateCheck;
      if (listId) {
        // Use vertical-specific duplicate check
        duplicateCheck = await checkForDuplicateLeadInVertical(phoneToCheck, listId);
        console.log(`[DUPLICATE CHECK] Using vertical-specific check for listId: ${listId}`);
      } else {
        // Fallback to global duplicate check
        duplicateCheck = await checkForDuplicateLead(phoneToCheck);
        console.log('[DUPLICATE CHECK] Using global check (no listId provided)');
      }
      
      if (duplicateCheck.isDuplicate) {
        const vertical = duplicateCheck.details?.vertical || 'unknown';
        const checkType = duplicateCheck.details?.checkType || 'unknown';
        console.log(`[DUPLICATE CHECK] BLOCKING LEAD: Phone ${phoneToCheck} was submitted ${duplicateCheck.details?.daysAgo} days ago in vertical: ${vertical} (${checkType})`);
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: `Duplicate lead: Phone number was submitted within the past 30 days`,
            details: {
              phoneNumber: phoneToCheck,
              originalSubmissionDate: duplicateCheck.details?.originalSubmissionDate,
              daysAgo: duplicateCheck.details?.daysAgo,
              vertical: vertical,
              checkType: checkType
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
    const zipCode = body.zipCode || body.zip_code || body.ZipCode || body.zip;
    const trustedFormCertUrl = body.trustedFormCertUrl || body.trusted_form_cert_url || body.TrustedForm;
    // Use 'let' instead of 'const' to allow correcting the list ID for special cases
    let listId = body.listId || body.list_id;
    let campaignId = body.campaignId || body.campaign_id; // Changed to let
    let cadenceId = body.cadenceId || body.cadence_id;   // Changed to let

    const normalizedPhone = phone ? phone.replace(/\D/g, '') : '';

    if (isTestModeForPhoneNumber && normalizedPhone === TEST_PHONE_NUMBER) {
      console.log(`[TEST MODE] In handleStandardLead: Detected test phone number ${TEST_PHONE_NUMBER}. Bypassing duplicate checks only - listId will NOT be overridden.`);
      // Note: listId override removed - test phone will now use the actual listId provided in request
      // This allows testing of actual routing configurations while still bypassing compliance/duplicate checks
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
    
    // Check for duplicate leads in the last 30 days - Vertical-specific if listId provided
    if (!isTestModeForPhoneNumber || normalizedPhoneForComplianceCheck !== TEST_PHONE_NUMBER) {
      console.log(`[DUPLICATE CHECK] Checking for duplicates for phone: ${normalizedPhoneForComplianceCheck}`);
      
      let duplicateCheck;
      if (listId) {
        // Use vertical-specific duplicate check
        duplicateCheck = await checkForDuplicateLeadInVertical(normalizedPhoneForComplianceCheck, listId);
        console.log(`[DUPLICATE CHECK] Using vertical-specific check for listId: ${listId}`);
      } else {
        // Fallback to global duplicate check
        duplicateCheck = await checkForDuplicateLead(normalizedPhoneForComplianceCheck);
        console.log('[DUPLICATE CHECK] Using global check (no listId provided)');
      }
      
      if (duplicateCheck.isDuplicate) {
        const vertical = duplicateCheck.details?.vertical || 'unknown';
        const checkType = duplicateCheck.details?.checkType || 'unknown';
        console.log(`[DUPLICATE CHECK] BLOCKING LEAD: Phone ${normalizedPhoneForComplianceCheck} was submitted ${duplicateCheck.details?.daysAgo} days ago in vertical: ${vertical} (${checkType})`);
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: `Duplicate lead: Phone number was submitted within the past 30 days`,
            details: {
              phoneNumber: normalizedPhoneForComplianceCheck,
              originalSubmissionDate: duplicateCheck.details?.originalSubmissionDate,
              daysAgo: duplicateCheck.details?.daysAgo,
              vertical: vertical,
              checkType: checkType,
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
    
    // STEP 2: Perform comprehensive compliance check across all sources - using the same engine as the /compliance page
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
    
    // Determine traffic source based on listId
    let trafficSource = body.trafficSource || body.traffic_source;
    
    // If no traffic_source is provided, set it based on listId mapping
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
    const { data: leadData, error } = await supabase
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
          bid_amount: bidValue, // Store historical bid amount at time of submission
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

    console.log('Lead inserted successfully:', leadData);
    
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
    console.log('Routing lookup parameters:', { listId, effectiveCampaignId, active: true });
    
    // Query list_routings to get routing data including the bid
    // CRITICAL FIX: Remove campaign_id filtering to avoid ID mismatches
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
    
    // For Pitch BPO lists, if strict match fails, try listId-only match for flexibility
    let finalRoutingResults = routingResults;
    if (!routingResults && listId.startsWith('pitch-bpo-list-')) {
      console.log(`[PITCH BPO] Strict match failed for ${listId}, trying listId-only match for flexibility...`);
      
      const { data: fallbackResults, error: fallbackError } = await supabase
        .from('list_routings')
        .select('*')
        .eq('list_id', listId)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
        
      if (fallbackError) {
        console.error('Error looking up list routing (listId-only fallback):', fallbackError);
      } else if (fallbackResults) {
        console.log(`[PITCH BPO] Found routing with listId-only match:`, fallbackResults);
        finalRoutingResults = fallbackResults;
        // Override with routing data's campaign and cadence IDs
        console.log(`[PITCH BPO] Using routing config campaignId: ${fallbackResults.campaign_id}, cadenceId: ${fallbackResults.cadence_id}`);
        effectiveCampaignId = fallbackResults.campaign_id;
        effectiveCadenceId = fallbackResults.cadence_id;
      }
    }
    
    console.log('Final routing results:', finalRoutingResults);
      
    // Get the bid value to store with the lead
    
    if (finalRoutingResults) {
      routingData = finalRoutingResults;
      console.log(`Found list routing for ${listId}:`, routingData);
      
      // STEP 1: TrustedForm Certificate Claiming (BEFORE compliance checks)
      // This must happen first - if claiming fails, reject the lead
      if (routingData?.auto_claim_trusted_form && trustedFormCertUrl) {
        console.log('[TrustedForm Pre-Claim] Starting BLOCKING auto-claim process for certificate:', trustedFormCertUrl);
        
        try {
          const claimResult = await TrustedFormService.retainCertificate(
            trustedFormCertUrl,
            {
              email: email,
              phone: phone,
              firstName: firstName,
              lastName: lastName,
            },
            {
              reference: 'pre-claim-validation',
              vendor: 'compliance-system',
            }
          );
          
          if (!claimResult.success) {
            console.error('[TrustedForm Pre-Claim] BLOCKING LEAD: Failed to claim certificate:', {
              error: claimResult.error,
              certificateUrl: trustedFormCertUrl,
              status: claimResult.status
            });
            
            return NextResponse.json(
              {
                success: false,
                bid: 0.00,
                error: `TrustedForm certificate claiming failed: ${claimResult.error}`,
                details: {
                  certificateUrl: trustedFormCertUrl,
                  claimStatus: claimResult.status,
                  source: 'trustedform-pre-claim'
                }
              },
              { status: 400 }
            );
          }
          
          console.log('[TrustedForm Pre-Claim] Certificate claimed successfully:', {
            certificateId: claimResult.certificateId,
            status: claimResult.status
          });
          
        } catch (claimError: any) {
          console.error('[TrustedForm Pre-Claim] BLOCKING LEAD: Unexpected error during claiming:', {
            error: claimError.message,
            certificateUrl: trustedFormCertUrl
          });
          
          return NextResponse.json(
            {
              success: false,
              bid: 0.00,
              error: `TrustedForm certificate claiming error: ${claimError.message}`,
              details: {
                certificateUrl: trustedFormCertUrl,
                source: 'trustedform-pre-claim-exception'
              }
            },
            { status: 500 }
          );
        }
      } else if (routingData?.auto_claim_trusted_form && !trustedFormCertUrl) {
        console.log('[TrustedForm Pre-Claim] BLOCKING LEAD: Auto-claim enabled but no TrustedForm certificate URL found in lead data');
        
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: 'TrustedForm auto-claim enabled but no certificate URL provided',
            details: {
              source: 'trustedform-missing-url'
            }
          },
          { status: 400 }
        );
      }
      
      // ✅ ENHANCED: SUBID-Aware Bidding System (Phase 2)
      // Extract SUBID from lead custom_fields for bid lookup
      const leadCustomFields = body.custom_fields || body.customFields;
      const extractedSubId = normalizeSubIdKey(leadCustomFields);
      
      console.log(`🎯 SUBID-Aware Bidding: listId=${listId}, subid=${extractedSubId || 'none'}`);
      
      try {
        // Use optimized SQL function to get SUBID-specific bid or fallback to list-level bid
        const { data: effectiveBid, error: bidError } = await supabase
          .rpc('get_effective_bid', {
            p_list_id: listId,
            p_subid: extractedSubId
          });
          
        if (bidError) {
          console.error('Error looking up effective bid:', bidError);
          // Fallback to original routing data bid
          bidValue = routingData.bid || 0.00;
          console.log(`⚠️ Bid lookup error, using routing fallback: $${bidValue.toFixed(2)}`);
        } else {
          bidValue = effectiveBid || 0.00;
          const bidSource = extractedSubId ? 'SUBID-specific' : 'list-level';
          console.log(`✅ Using ${bidSource} bid: $${bidValue.toFixed(2)} for SUBID: ${extractedSubId || 'none'}`);
        }
      } catch (error) {
        console.error('Exception in bid lookup:', error);
        // Ultimate fallback to routing data
        bidValue = routingData.bid || 0.00;
        console.log(`🚨 Exception fallback bid: $${bidValue.toFixed(2)}`);
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
    
    // Auto-claim TrustedForm certificate if enabled for this routing (async, non-blocking)
    // TrustedForm claiming now happens BEFORE compliance checks (above)
    // This section has been moved to the beginning of the function
    
    // Determine dialer type: use weighted selection when enabled, else routing default
    let dialerType = routingData?.dialer_type || DIALER_TYPE_INTERNAL;
    try {
      if (routingData?.weighted_routing_enabled) {
        const supabase = createServerClient();
        const { data: selectedDialer, error: weightErr } = await supabase
          .rpc('get_weighted_dialer', { p_list_id: listId });
        if (!weightErr && typeof selectedDialer === 'number') {
          dialerType = selectedDialer;
          console.log(`[WEIGHTED_ROUTING] Selected dialer ${dialerType} via get_weighted_dialer for list ${listId}`);
        } else if (weightErr) {
          console.warn('[WEIGHTED_ROUTING] Fallback to routing dialer due to RPC error:', weightErr);
        }
      }
    } catch (weightedSelectionErr) {
      console.warn('[WEIGHTED_ROUTING] Exception selecting weighted dialer; using routing default:', weightedSelectionErr);
    }
    console.log(`Using dialer type: ${dialerType === DIALER_TYPE_INTERNAL ? 'Internal Dialer' : dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : dialerType === DIALER_TYPE_CONVOSO ? 'Convoso (IBP BPO)' : 'Unknown'}`);

    // STEP 1: Validate state based on dialer type (existing validation)
    const normalizedState = state.toUpperCase();
    const allowedStates = dialerType === DIALER_TYPE_PITCH_BPO ? PITCH_BPO_ALLOWED_STATES : dialerType === DIALER_TYPE_CONVOSO ? CONVOSO_ALLOWED_STATES : INTERNAL_DIALER_ALLOWED_STATES;
    const dialerName = dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : dialerType === DIALER_TYPE_CONVOSO ? 'Convoso (IBP BPO)' : 'Internal Dialer';
    
    if (!allowedStates.includes(normalizedState)) {
      console.log(`[STATE VALIDATION - DIALER] Rejecting lead with non-allowed state: ${state} for ${dialerName}`);
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
    
    console.log(`[STATE VALIDATION - DIALER] State ${state} is allowed for ${dialerName}`);

    // STEP 2: Validate state based on vertical configuration (additional check)
    const vertical = routingData?.vertical || 'ACA';
    console.log(`[STATE VALIDATION - VERTICAL] Checking state ${normalizedState} for vertical: ${vertical}`);
    
    const isVerticalStateAllowed = await isStateAllowedForVertical(vertical, normalizedState);
    
    if (!isVerticalStateAllowed) {
      const verticalAllowedStates = await getAllowedStatesForVertical(vertical);
      console.log(`[STATE VALIDATION - VERTICAL] Rejecting lead: state ${state} not approved for ${vertical} vertical`);
      return NextResponse.json(
        {
          success: false,
          bid: 0.00,
          error: `State ${state} not approved for ${vertical} vertical`,
          details: {
            state: state,
            vertical: vertical,
            dialerType: dialerName,
            verticalAllowedStates: verticalAllowedStates,
            reason: 'State not approved in vertical configuration'
          }
        },
        { status: 400 }
      );
    }
    
    console.log(`[STATE VALIDATION - VERTICAL] State ${state} is approved for ${vertical} vertical`);

    // Check if this lead should be forwarded to the appropriate dialer API
    // Any list ID in the routing settings will have routingData and be eligible for forwarding
    if (routingData) {
      // Log the effective cadence ID that will be used for the lead
      const isOnpointLead = listId === '1b759535-2a5e-421e-9371-3bde7f855c60';
      
      if (isOnpointLead) {
        console.log(`Onpoint lead detected - using cadence ID from routing management: ${effectiveCadenceId}`);
      }
      
      try {
        // *** DIALER APPROVAL ENFORCEMENT ***
        // Check if the target dialer is approved for this list ID
        const isApproved = await isDialerApproved(listId, dialerType);
        if (!isApproved) {
          console.error(`❌ COMPLIANCE BLOCK: Dialer type ${dialerType} is DENIED for listId: ${listId}. Lead routing blocked.`);
          return NextResponse.json({
            success: false,
            error: 'COMPLIANCE_VIOLATION',
            message: `Dialer type ${dialerType} is not approved for this list ID. Contact compliance team.`,
            details: {
              listId: listId,
              dialer_type: dialerType,
              phone: phone,
              reason: 'Dialer approval denied by compliance team'
            }
          }, { status: 403 }); // 403 Forbidden
        }
        
        // If this is the Pitch BPO dialer type, route to Pitch BPO instead of internal dialer
        if (dialerType === DIALER_TYPE_PITCH_BPO) {
          // WRITE-TIME ATTRIBUTION: set assigned_dialer_type and selection method
          try {
            const supabase = createServerClient();
            await supabase
              .from('leads')
              .update({
                assigned_dialer_type: DIALER_TYPE_PITCH_BPO,
                dialer_selection_method: routingData?.weighted_routing_enabled ? 'weighted' : 'single'
              })
              .eq('id', leadData[0].id);
          } catch (attrErr) {
            console.warn('Non-fatal: failed to attribute dialer at write-time (Pitch BPO):', attrErr);
          }
          console.log('✅ Pitch BPO dialer approved - routing lead to Pitch BPO (dialer_type=2)');
          return await forwardToPitchBPO({
            data: leadData,
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
        
        // If this is the Convoso (IBP BPO) dialer type, route to Convoso instead of internal dialer
        if (dialerType === DIALER_TYPE_CONVOSO) {
          // WRITE-TIME ATTRIBUTION: set assigned_dialer_type and selection method
          try {
            const supabase = createServerClient();
            await supabase
              .from('leads')
              .update({
                assigned_dialer_type: DIALER_TYPE_CONVOSO,
                dialer_selection_method: routingData?.weighted_routing_enabled ? 'weighted' : 'single'
              })
              .eq('id', leadData[0].id);
          } catch (attrErr) {
            console.warn('Non-fatal: failed to attribute dialer at write-time (Convoso):', attrErr);
          }
          console.log('✅ Convoso dialer approved - routing lead to Convoso (IBP BPO) (dialer_type=3)');
          return await forwardToConvoso({
            data: leadData,
            listId,
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
        
        // For internal dialer (dialer_type=1), also check approval
        if (dialerType === DIALER_TYPE_INTERNAL) {
          console.log('✅ Internal dialer approved - routing lead to internal dialer (dialer_type=1)');
          // WRITE-TIME ATTRIBUTION for Internal
          try {
            const supabase = createServerClient();
            await supabase
              .from('leads')
              .update({
                assigned_dialer_type: DIALER_TYPE_INTERNAL,
                dialer_selection_method: routingData?.weighted_routing_enabled ? 'weighted' : 'single'
              })
              .eq('id', leadData[0].id);
          } catch (attrErr) {
            console.warn('Non-fatal: failed to attribute dialer at write-time (Internal):', attrErr);
          }
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
            compliance_lead_id: leadData[0].id // Add compliance_lead_id to custom fields
          },
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          compliance_lead_id: leadData[0].id
        };
        
        // The dialer API expects listId and token as URL parameters, not just in the JSON payload
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
              .eq('id', leadData[0].id);
            
            console.log('Successfully associated dialer compliance_lead_id with lead record');
          } catch (updateError) {
            console.error('Error updating lead with compliance_lead_id:', updateError);
          }
        }
        
        // Include the dialer response in our API response
        const responseObj: any = {
          success: true,
          lead_id: leadData[0].id,
          data: leadData[0],
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
          lead_id: leadData[0].id, // Explicitly return the lead ID
          data: leadData[0],
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
      lead_id: leadData[0].id, // Explicitly return the lead ID
      data: leadData[0],
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
    
    // State validation will be performed after routing data is loaded to support dynamic dialer types
    
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
    let bid = 0.00; // Default bid value - will be updated from routing data
    
    console.log('Initial values:', { campaignId: effectiveCampaignId, cadenceId: effectiveCadenceId });
    
    // Normalize the list ID to ensure consistent matching
    const normalizedListId = listId.trim().toLowerCase();
    
    // Query list_routings to get routing data including the bid
    // CRITICAL FIX: Remove campaign_id filtering to avoid ID mismatches
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
    
    console.log('Health insurance lead passed all compliance checks');
    
    // Get the dialer type from routing data (default to internal dialer if not specified)
    const dialerType = routingResults?.dialer_type || DIALER_TYPE_INTERNAL;
      
    if (routingResults) {
      routingData = routingResults;
      bid = routingResults.bid || 0.00; // Set bid from routing data
      console.log(`Found list routing for ${listId}:`, routingData);
      console.log(`Health insurance lead using dialer type: ${dialerType === DIALER_TYPE_INTERNAL ? 'Internal Dialer' : dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : dialerType === DIALER_TYPE_CONVOSO ? 'Convoso (IBP BPO)' : 'Unknown'}`);
      
      // STEP 1: Validate state based on dialer type (existing validation)
      const normalizedState = state.toUpperCase();
      const allowedStates = dialerType === DIALER_TYPE_PITCH_BPO ? PITCH_BPO_ALLOWED_STATES : dialerType === DIALER_TYPE_CONVOSO ? CONVOSO_ALLOWED_STATES : INTERNAL_DIALER_ALLOWED_STATES;
      const dialerName = dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : dialerType === DIALER_TYPE_CONVOSO ? 'Convoso (IBP BPO)' : 'Internal Dialer';
      
      if (!allowedStates.includes(normalizedState)) {
        console.log(`[STATE VALIDATION - DIALER] Rejecting health insurance lead with non-allowed state: ${state} for ${dialerName}`);
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
      
      console.log(`[STATE VALIDATION - DIALER] State ${state} is allowed for health insurance lead (${dialerName})`);
      
      // STEP 2: Validate state based on vertical configuration (additional check)
      const vertical = routingData?.vertical || 'ACA';
      console.log(`[STATE VALIDATION - VERTICAL] Checking state ${normalizedState} for vertical: ${vertical} (health insurance)`);
      
      const isVerticalStateAllowed = await isStateAllowedForVertical(vertical, normalizedState);
      
      if (!isVerticalStateAllowed) {
        const verticalAllowedStates = await getAllowedStatesForVertical(vertical);
        console.log(`[STATE VALIDATION - VERTICAL] Rejecting health insurance lead: state ${state} not approved for ${vertical} vertical`);
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: `State ${state} not approved for ${vertical} vertical`,
            details: {
              state: state,
              vertical: vertical,
              dialerType: dialerName,
              verticalAllowedStates: verticalAllowedStates,
              reason: 'State not approved in vertical configuration'
            }
          },
          { status: 400 }
        );
      }
      
      console.log(`[STATE VALIDATION - VERTICAL] State ${state} is approved for ${vertical} vertical (health insurance)`);
      
      // STEP 1: TrustedForm Certificate Claiming (BEFORE compliance checks)
      // This must happen first - if claiming fails, reject the lead
      const trustedFormUrl = body.TrustedForm;
      if (routingData?.auto_claim_trusted_form && trustedFormUrl) {
        console.log('[TrustedForm Pre-Claim] Starting BLOCKING auto-claim process for health insurance certificate:', trustedFormUrl);
        
        try {
          const claimResult = await TrustedFormService.retainCertificate(
            trustedFormUrl,
            {
              email: email,
              phone: phone,
              firstName: firstName,
              lastName: lastName,
            },
            {
              reference: 'pre-claim-validation-health',
              vendor: 'compliance-system',
            }
          );
          
          if (!claimResult.success) {
            console.error('[TrustedForm Pre-Claim] BLOCKING HEALTH LEAD: Failed to claim certificate:', {
              error: claimResult.error,
              certificateUrl: trustedFormUrl,
              status: claimResult.status
            });
            
            return NextResponse.json(
              {
                success: false,
                bid: 0.00,
                error: `TrustedForm certificate claiming failed: ${claimResult.error}`,
                details: {
                  certificateUrl: trustedFormUrl,
                  claimStatus: claimResult.status,
                  source: 'trustedform-pre-claim-health'
                }
              },
              { status: 400 }
            );
          }
          
          console.log('[TrustedForm Pre-Claim] Health insurance certificate claimed successfully:', {
            certificateId: claimResult.certificateId,
            status: claimResult.status
          });
          
        } catch (claimError: any) {
          console.error('[TrustedForm Pre-Claim] BLOCKING HEALTH LEAD: Unexpected error during claiming:', {
            error: claimError.message,
            certificateUrl: trustedFormUrl
          });
          
          return NextResponse.json(
            {
              success: false,
              bid: 0.00,
              error: `TrustedForm certificate claiming error: ${claimError.message}`,
              details: {
                certificateUrl: trustedFormUrl,
                source: 'trustedform-pre-claim-exception-health'
              }
            },
            { status: 500 }
          );
        }
      } else if (routingData?.auto_claim_trusted_form && !trustedFormUrl) {
        console.log('[TrustedForm Pre-Claim] BLOCKING HEALTH LEAD: Auto-claim enabled but no TrustedForm certificate URL found in lead data');
        
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: 'TrustedForm auto-claim enabled but no certificate URL provided',
            details: {
              source: 'trustedform-missing-url-health'
            }
          },
          { status: 400 }
        );
      }
      
      // Now insert the health insurance lead into the database with the calculated bid
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
            list_id: listId,
            campaign_id: body.Vertical || 'health-insurance-campaign',
            traffic_source: body.Source || (body.SubId === 'OPG4' ? 'Onpoint' : ''),
            
            // Address details
            address: contactData.Address || '',
            city: contactData.City || '',
            state: state,
            zip_code: contactData.ZipCode || contactData.zip_code || contactData.zip || '',
            
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
            bid_amount: bid, // Store historical bid amount at time of submission
            
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

      console.log('Health insurance lead inserted successfully:', data);
      
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
    
    // TrustedForm claiming now happens BEFORE compliance checks (above)
    // This section has been moved to occur immediately after routingData is loaded
    
    // Check for duplicate leads in the last 30 days - using normalized phone number for compliance
    const normalizedPhoneForComplianceCheck = phone ? phone.replace(/\D/g, '') : '';
    
    if (!isTestModeForPhoneNumber) {
      console.log(`[DUPLICATE CHECK] Checking for duplicates for health insurance phone: ${normalizedPhoneForComplianceCheck}`);
      
      let duplicateCheck;
      if (listId) {
        // Use vertical-specific duplicate check
        duplicateCheck = await checkForDuplicateLeadInVertical(normalizedPhoneForComplianceCheck, listId);
        console.log(`[DUPLICATE CHECK] Using vertical-specific check for listId: ${listId}`);
      } else {
        // Fallback to global duplicate check
        duplicateCheck = await checkForDuplicateLead(normalizedPhoneForComplianceCheck);
        console.log('[DUPLICATE CHECK] Using global check (no listId provided)');
      }
      
      if (duplicateCheck.isDuplicate) {
        const vertical = duplicateCheck.details?.vertical || 'unknown';
        const checkType = duplicateCheck.details?.checkType || 'unknown';
        console.log('[DUPLICATE CHECK] BLOCKING HEALTH INSURANCE LEAD: Duplicate phone number found:', {
          phone: normalizedPhoneForComplianceCheck,
          vertical: vertical,
          checkType: checkType,
          details: duplicateCheck.details
        });
        
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: 'Duplicate phone number found in system',
            details: {
              phone: normalizedPhoneForComplianceCheck,
              vertical: vertical,
              checkType: checkType,
              duplicateInfo: duplicateCheck.details,
              source: 'duplicate-check'
            }
          },
          { status: 400 }
        );
      }
      
      console.log('[DUPLICATE CHECK] No duplicates found for health insurance phone:', normalizedPhoneForComplianceCheck);
    } else {
      console.log(`[TEST MODE] Bypassing duplicate check for test phone number ${TEST_PHONE_NUMBER}`);
    }

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
      
      let healthInsuranceLeadData: any = null;
      
      try {
        console.log('Forwarding health insurance lead to dialer for list:', listId);
        
        // Now insert the health insurance lead into the database with the calculated bid
        const { data: insertedData, error } = await supabase
          .from('leads')
          .insert([
            {
              // Basic lead info
              first_name: firstName,
              last_name: lastName,
              email: email,
              phone: phone,
              trusted_form_cert_url: body.TrustedForm || '',
              list_id: listId,
              campaign_id: body.Vertical || 'health-insurance-campaign',
              traffic_source: body.Source || (body.SubId === 'OPG4' ? 'Onpoint' : ''),
              
              // Address details
              address: contactData.Address || '',
              city: contactData.City || '',
              state: state,
              zip_code: contactData.ZipCode || contactData.zip_code || contactData.zip || '',
              
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
              bid_amount: bid, // Store historical bid amount at time of submission
              
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

        healthInsuranceLeadData = insertedData;
        console.log('Health insurance lead inserted successfully:', healthInsuranceLeadData);
        
        // Format phone number with +1 prefix if it doesn't have it already
        const formattedPhone = phone.startsWith('+1') ? phone : `+1${phone.replace(/\D/g, '')}`;        
        
        // *** DIALER APPROVAL ENFORCEMENT FOR HEALTH INSURANCE ***
        // Check if the target dialer is approved for this list ID
        const isApproved = await isDialerApproved(listId, dialerType);
        if (!isApproved) {
          console.error(`❌ COMPLIANCE BLOCK: Dialer type ${dialerType} is DENIED for listId: ${listId}. Health insurance lead routing blocked.`);
          return NextResponse.json({
            success: false,
            error: 'COMPLIANCE_VIOLATION',
            message: `Dialer type ${dialerType} is not approved for this list ID. Contact compliance team.`,
            details: {
              listId: listId,
              dialer_type: dialerType,
              phone: phone,
              lead_type: 'health_insurance',
              reason: 'Dialer approval denied by compliance team'
            }
          }, { status: 403 }); // 403 Forbidden
        }
        
        // Route health insurance lead based on dialer type
        if (dialerType === DIALER_TYPE_PITCH_BPO) {
          console.log('✅ Pitch BPO dialer approved - routing health insurance lead to Pitch BPO dialer');
          return await forwardToPitchBPO({
            data: healthInsuranceLeadData,
            listId,
            phone,
            firstName,
            lastName,
            email,
            zipCode: contactData.ZipCode || contactData.zip_code || contactData.zip || '',
            state,
            bidValue: bid,
            routingData
          });
        } else if (dialerType === DIALER_TYPE_CONVOSO) {
          console.log('✅ Convoso dialer approved - routing health insurance lead to Convoso (IBP BPO) dialer');
          return await forwardToConvoso({
            data: healthInsuranceLeadData,
            listId,
            phone,
            firstName,
            lastName,
            email,
            zipCode: contactData.ZipCode || contactData.zip_code || contactData.zip || '',
            state,
            bidValue: bid,
            routingData
          });
        }
        
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
        }
        
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
          zip_code: contactData.ZipCode || contactData.zip_code || contactData.zip || '',
          source: 'Health Insurance API',
          trusted_form_cert_url: body.TrustedForm || '',
          transaction_id: '',
          
          // Important compliance and demographic fields
          income_bracket: incomeBracket,
          dob: dob || '',
          homeowner_status: homeownerStatus,
          
          // Custom fields passed through as a nested object
          custom_fields: {
            compliance_lead_id: healthInsuranceLeadData[0].id // Add compliance_lead_id to custom fields
          },
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          compliance_lead_id: healthInsuranceLeadData[0].id
        };
        
        // The dialer API expects listId and token as URL parameters, not just in the JSON payload
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
    } else {
      // No routing data found, but still validate state and route based on dialer type
      console.log(`No routing data found for list ${listId}, using default dialer: ${dialerType === DIALER_TYPE_INTERNAL ? 'Internal Dialer' : dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : dialerType === DIALER_TYPE_CONVOSO ? 'Convoso (IBP BPO)' : 'Unknown'}`);
      
      // STEP 1: Validate state based on dialer type
      const normalizedState = state.toUpperCase();
      const allowedStates = dialerType === DIALER_TYPE_PITCH_BPO ? PITCH_BPO_ALLOWED_STATES : dialerType === DIALER_TYPE_CONVOSO ? CONVOSO_ALLOWED_STATES : INTERNAL_DIALER_ALLOWED_STATES;
      const dialerName = dialerType === DIALER_TYPE_PITCH_BPO ? 'Pitch BPO' : dialerType === DIALER_TYPE_CONVOSO ? 'Convoso (IBP BPO)' : 'Internal Dialer';
      
      if (!allowedStates.includes(normalizedState)) {
        console.log(`[STATE VALIDATION - DIALER] Rejecting health insurance lead with non-allowed state: ${state} for ${dialerName}`);
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
      
      console.log(`[STATE VALIDATION - DIALER] State ${state} is allowed for health insurance lead (${dialerName})`);
      
      // STEP 2: Validate state based on vertical configuration (defaults to ACA)
      const vertical = 'ACA'; // Default vertical when no routing data
      console.log(`[STATE VALIDATION - VERTICAL] Checking state ${normalizedState} for vertical: ${vertical} (health insurance, no routing)`);
      
      const isVerticalStateAllowed = await isStateAllowedForVertical(vertical, normalizedState);
      
      if (!isVerticalStateAllowed) {
        const verticalAllowedStates = await getAllowedStatesForVertical(vertical);
        console.log(`[STATE VALIDATION - VERTICAL] Rejecting health insurance lead: state ${state} not approved for ${vertical} vertical`);
        return NextResponse.json(
          {
            success: false,
            bid: 0.00,
            error: `State ${state} not approved for ${vertical} vertical`,
            details: {
              state: state,
              vertical: vertical,
              dialerType: dialerName,
              verticalAllowedStates: verticalAllowedStates,
              reason: 'State not approved in vertical configuration'
            }
          },
          { status: 400 }
        );
      }
      
      console.log(`[STATE VALIDATION - VERTICAL] State ${state} is approved for ${vertical} vertical (health insurance, no routing)`);
    }

    // Include bid, lead_id, and dialer response in the API response
    const responseObj: any = {
      success: true, 
      lead_id: healthInsuranceLeadData[0].id, // Explicitly return the lead ID
      data: healthInsuranceLeadData[0],
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
