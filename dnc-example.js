/**
 * Example DNC Submission Format
 * 
 * This file shows the proper format for submitting DNC entries to the compliance system.
 * 
 * POST to: https://compliance.juicedmedia.io/api/dialer/dnc
 * Headers:
 *   - Content-Type: application/json
 *   - X-API-Key: test_key_123 (or your actual API key)
 * 
 * You can test with curl or implement in your system using the example below.
 */

// Example request payload
const examplePayload = {
  // API key can be provided in the body or as X-API-Key header
  "api_key": "test_key_123",
  
  // Phone number to add to DNC (required)
  // Will be normalized to E.164 format internally
  "phone_number": "1234567890",
  
  // Reason for adding to DNC (optional but recommended)
  "reason": "Customer opted out via SMS",
  
  // Source of the opt-out (optional)
  "source": "sms_campaign"
};

// Example curl command (for reference)
const curlExample = `
curl -X POST https://compliance.juicedmedia.io/api/dialer/dnc \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: test_key_123" \\
  -d '{
    "phone_number": "1234567890",
    "reason": "Customer opted out via SMS",
    "source": "sms_campaign"
  }'
`;

// Expected successful response
const expectedResponse = {
  "success": true,
  "message": "Number added to DNC",
  "phone_number": "1234567890"
};

console.log("DNC Submission Example");
console.log("=====================");
console.log("\nPayload:");
console.log(JSON.stringify(examplePayload, null, 2));
console.log("\nCurl Example:");
console.log(curlExample);
console.log("\nExpected Response:");
console.log(JSON.stringify(expectedResponse, null, 2));

// For bulk submissions, you can use the bulk endpoint
const bulkExample = {
  "api_key": "test_key_123",
  "entries": [
    {
      "phone_number": "1234567890",
      "reason": "Customer opted out via SMS",
      "source": "sms_campaign"
    },
    {
      "phone_number": "9876543210",
      "reason": "Do not call request",
      "source": "call_center"
    }
  ]
};

console.log("\nBulk Submission Example (POST to /api/dialer/dnc/bulk):");
console.log(JSON.stringify(bulkExample, null, 2));
