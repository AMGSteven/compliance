/**
 * Test Script to Send a Lead with Custom Fields
 * 
 * This script sends a test lead to the leads API endpoint
 * with custom fields to verify proper handling.
 */

import https from 'https';
import http from 'http';

// Lead data with custom fields
const testLead = {
  // Standard lead fields
  first_name: "Test",
  last_name: "CustomFields",
  email: "test.custom@example.com",
  phone: "+17705551234",
  list_id: "lb799935-2a5c-421e-9371-3bde7f865c60",
  campaign_id: "health-insurance-campaign",
  token: "1291bc7e6c2bee7421953f892c25c03",
  income_bracket: "50000-75000",
  state: "CA",
  homeowner_status: "Own",
  dob: "1985-06-15",
  
  // Optional standard fields
  address: "123 Test Street",
  city: "Los Angeles",
  zip_code: "90210",
  trusted_form_cert_url: "https://cert.trustedform.com/test-certificate",
  
  // Custom fields
  custom_fields: {
    // Tracking parameters
    click_id: "click_abc123xyz789",
    visitor_id: "vis_45678",
    sub_id: "sub_partner_12345",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "health_insurance_2025",
    
    // Additional customer information
    age_bracket: "35-44",
    preferred_contact_method: "email",
    insurance_type_interest: "health",
    annual_income: "65000",
    has_existing_policy: "yes",
    
    // Consent information
    consent_timestamp: new Date().toISOString(),
    consent_ip: "192.168.1.100",
    opt_in_email: "yes",
    opt_in_sms: "yes",
    opt_in_call: "yes"
  }
};

// Convert lead data to JSON string
const postData = JSON.stringify(testLead);

// Define request options
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Sending test lead with custom fields...');
console.log(JSON.stringify(testLead, null, 2));

// Make the request
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\nRESPONSE BODY:');
    try {
      // Try to parse and pretty print the JSON response
      const parsedResponse = JSON.parse(responseData);
      console.log(JSON.stringify(parsedResponse, null, 2));
      
      if (parsedResponse.success) {
        console.log('\n✅ SUCCESS: Lead with custom fields was successfully submitted!');
        
        // Extract the lead ID for reference
        const leadId = parsedResponse.data?.id;
        if (leadId) {
          console.log(`\nThe lead was stored with ID: ${leadId}`);
          console.log(`You can view the lead details at: http://localhost:3000/dashboard/leads`);
        }
      } else {
        console.log('\n❌ ERROR: Lead submission failed.');
        console.log(`Error message: ${parsedResponse.error || 'Unknown error'}`);
      }
    } catch (e) {
      // Fallback to printing raw response if it's not valid JSON
      console.log(responseData);
      console.log('\n❌ ERROR: Could not parse response as JSON.');
    }
  });
});

req.on('error', (e) => {
  console.error(`\n❌ ERROR: Request failed: ${e.message}`);
});

// Send the data
req.write(postData);
req.end();

console.log('Test lead request sent. Waiting for response...');
