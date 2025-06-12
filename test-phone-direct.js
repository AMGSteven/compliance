// Direct test of phone validation to debug the issue
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
config({ path: '.env.local' });

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPhoneDirectly() {
  try {
    // Google Voice number that should be detected as VoIP
    const phoneNumber = "5105927935";
    
    console.log(`Testing direct phone validation for Google Voice number: ${phoneNumber}`);
    
    // API configuration - directly from the code
    const API_KEY = process.env.REAL_PHONE_VALIDATION_API_KEY || '2699AA84-6478-493F-BF14-299F89BA9719';
    const API_URL = 'https://api.realvalidation.com/rpvWebService/Turbo.php';
    
    // Prepare the API request
    const params = new URLSearchParams({
      token: API_KEY,
      phone: phoneNumber,
      output: 'json' // Use 'output' parameter per API docs
    });
    
    // Make the direct API request
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    // Get the response text and parse
    const responseText = await response.text();
    console.log(`\nRaw API Response: ${responseText}`);
    
    const data = JSON.parse(responseText);
    console.log(`\nParsed Response: ${JSON.stringify(data, null, 2)}`);
    
    // Specifically check for phone_type and VoIP
    console.log(`\nPhone Type Check:`);
    console.log(`- phone_type: "${data.phone_type || 'NOT PROVIDED'}"`);
    console.log(`- Is this VoIP? ${data.phone_type?.toLowerCase() === 'voip' ? 'YES' : 'NO'}`);
    
    // Check the data and manually determine if this should be blocked
    const shouldBlock = data.phone_type?.toLowerCase() === 'voip' || 
                       data.status?.toLowerCase() === 'disconnected' ||
                       data.status?.toLowerCase() === 'busy';
                       
    console.log(`\nCompliance Decision: ${shouldBlock ? 'BLOCK' : 'ALLOW'}`);
    
    // Next steps for implementing the fix based on this test
    console.log(`\nRecommended Implementation:`);
    if (shouldBlock) {
      console.log(`- This number should be BLOCKED as ${data.phone_type}`);
      console.log(`- The validation API is correctly identifying it as ${data.phone_type}`);
      console.log(`- We need to ensure our code properly blocks this type`);
    } else {
      console.log(`- This number might need manual review`);
      console.log(`- Detected as ${data.phone_type} with status ${data.status}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
(async () => {
  await testPhoneDirectly();
})();
