// Test script for RealPhoneValidation Scrub API Integration
const apiKey = '2699AA84-6478-493F-BF14-299F89BA9719'; // Your provided API key
const apiUrl = 'https://api.realvalidation.com/rpvWebService/RealPhoneValidationScrub.php';

// Test multiple phone number formats
const testNumbers = [
  { raw: '4083109269', formatted: '4083109269', description: 'Known good number (per client)' },
  { raw: '(408) 310-9269', formatted: '4083109269', description: 'Formatted good number' },
  { raw: '9317167522', formatted: '9317167522', description: 'Number from Synergy test' },
  { raw: '1234567890', formatted: '1234567890', description: 'Invalid number' },
  { raw: '0000000000', formatted: '0000000000', description: 'Zeroes (should fail)' },
  { raw: '8005551212', formatted: '8005551212', description: 'Common test number' }
];

// Simple XML to JSON parser for this specific API response
function parseXML(xmlString) {
  // Extract values from simple XML format like <tag>value</tag>
  const getTagValue = (tag) => {
    const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's');
    const match = xmlString.match(regex);
    return match ? match[1] : null;
  };

  return {
    status: getTagValue('status') || '',
    error_text: getTagValue('error_text') || '',
    iscell: getTagValue('iscell') || '',
    carrier: getTagValue('carrier') || '',
  };
}

// Format phone number to just digits
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  // Remove all non-digit characters
  return phoneNumber.replace(/\D/g, '');
  // Handle country code if needed (e.g., remove leading '1' for US numbers)
  // .replace(/^1(\d{10})$/, '$1');
}

// Interpret the validation result for compliance purposes
function interpretResult(data) {
  // List of statuses to reject - ONLY these are rejected
  const rejectedStatuses = [
    'disconnected',
    'disconnected-70',
    'unreachable',
    'invalid phone',
    'restricted',
    'ERROR',
    'ERROR bad phone number',
    'ERROR missing token',
    'unauthorized',
    'invalid-format',
    'invalid-phone',
    'bad-zip-code',
    'busy' // Adding busy to rejected list per user's request
  ];
  
  // List of statuses to explicitly accept
  const acceptedStatuses = [
    'connected',
    'connected-75',
    'pending'
    // 'busy' - removed from accepted list per user's request
  ];
  
  // Check if status is in the rejected list (case-insensitive)
  const isRejected = rejectedStatuses.some(status => 
    data.status.toLowerCase() === status.toLowerCase() || 
    (data.error_text && data.error_text.toLowerCase().includes(status.toLowerCase()))
  );
  
  const result = {
    // Valid if status is NOT in rejected list
    isValid: !isRejected,
    rawStatus: data.status || '',
    isCell: data.iscell === 'Y',
    isLandline: data.iscell === 'N',
    carrier: data.carrier || 'Unknown',
    error: data.error_text || '',
  };
  
  // Note when a status is explicitly accepted
  const isExplicitlyAccepted = acceptedStatuses.some(status => 
    data.status.toLowerCase() === status.toLowerCase()
  );
  
  // Additional compliance information
  result.complianceStatus = result.isValid ? 'VALID' : 'INVALID';
  result.riskLevel = result.isValid ? 'LOW' : 'HIGH';
  result.rejectReason = isRejected ? `Rejected status: ${data.status}` : '';
  result.acceptedStatus = isExplicitlyAccepted ? true : false;
  
  return result;
}

// Check a single phone number against the API
async function checkPhoneNumber(phoneObj) {
  const { raw, formatted, description } = phoneObj;
  console.log(`\n\n========================================`);
  console.log(`Testing number: ${raw} (${description})`);
  console.log(`Formatted as: ${formatted}`);
  console.log(`========================================`);
  
  // Build the URL with query parameters
  const url = new URL(apiUrl);
  url.searchParams.append('phone', formatted);
  url.searchParams.append('token', apiKey);
  
  try {
    const response = await fetch(url.toString(), { method: 'GET' });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const responseText = await response.text();
    console.log('API Raw Response:');
    console.log(responseText);
    
    // Parse the XML response
    const data = parseXML(responseText);
    console.log('\nParsed Response:');
    console.log(data);
    
    // Interpret the compliance result
    const result = interpretResult(data);
    console.log('\nCompliance Assessment:');
    console.log(JSON.stringify(result, null, 2));
    
    // Display human-readable result
    if (result.isValid) {
      console.log(`\n✅ RESULT: Phone number IS VALID and CONNECTED`);
      console.log(`Phone Type: ${result.isCell ? 'Cell Phone' : (result.isLandline ? 'Landline' : 'Unknown')}`);
      console.log(`Carrier: ${result.carrier}`);
      console.log(`Compliance Status: ${result.complianceStatus}`);
      console.log(`Risk Level: ${result.riskLevel}`);
    } else {
      console.log(`\n❌ RESULT: Phone number is INVALID or NOT CONNECTED`);
      console.log(`Error: ${result.error}`);
      console.log(`Compliance Status: ${result.complianceStatus}`);
      console.log(`Risk Level: ${result.riskLevel}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error checking phone number:', error);
    return { isValid: false, error: error.message, complianceStatus: 'ERROR', riskLevel: 'HIGH' };
  }
}

// Run tests on all phone numbers
async function testRealPhoneValidationApi() {
  console.log('========================================');
  console.log('RealPhoneValidation Scrub API Integration Test');
  console.log('API Key:', apiKey.substring(0, 8) + '...');
  console.log('========================================');
  
  const results = [];
  
  for (const phoneObj of testNumbers) {
    // Make sure phone number is properly formatted
    phoneObj.formatted = formatPhoneNumber(phoneObj.raw);
    
    // Check this number
    const result = await checkPhoneNumber(phoneObj);
    results.push({ 
      phoneNumber: phoneObj.raw,
      result 
    });
  }
  
  // Summary of all results
  console.log('\n\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  results.forEach(item => {
    console.log(`${item.phoneNumber}: ${item.result.complianceStatus} (${item.result.isValid ? 'Connected' : 'Not Connected'})`);
  });
  
  return results;
}

// Run the test
testRealPhoneValidationApi()
  .then(results => {
    console.log('\nTest completed successfully.');
    console.log('\nIntegration notes:');
    console.log('- This API can be integrated as a compliance check for phone validation');
    console.log('- It should be added to the compliance pipeline after existing DNC checks');
    console.log('- Use the carrier and connection status to enhance lead quality assessment');
  })
  .catch(error => {
    console.error('Test failed with error:', error);
  });

/* 
 * Integration Example for Compliance System:
 *
 * // Example function for integrating with your compliance system
 * async function checkPhoneValidationCompliance(phoneNumber) {
 *   // Format the phone number
 *   const formattedNumber = formatPhoneNumber(phoneNumber);
 *   
 *   // Create API URL
 *   const url = new URL('https://api.realvalidation.com/rpvWebService/RealPhoneValidationScrub.php');
 *   url.searchParams.append('phone', formattedNumber);
 *   url.searchParams.append('token', '2699AA84-6478-493F-BF14-299F89BA9719');
 *   
 *   // Call the API
 *   const response = await fetch(url.toString(), { method: 'GET' });
 *   const responseText = await response.text();
 *   
 *   // Parse and interpret the result
 *   const data = parseXML(responseText);
 *   return interpretResult(data);
 * }
 */
