// Simple test script to directly check the RealPhoneValidation API
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'fs';

// Load environment variables
config({ path: '.env.local' });

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPhoneValidation() {
  try {
    // Simulate the API directly
    const phoneToTest = "5105927935"; // Google Voice number
    
    console.log(`Testing phone validation for: ${phoneToTest}`);
    
    // Build the API URL manually
    const API_KEY = process.env.REAL_PHONE_VALIDATION_API_KEY || '2699AA84-6478-493F-BF14-299F89BA9719';
    const API_URL = 'https://api.realvalidation.com/rpvWebService/Turbo.php';
    
    // Format the phone number (remove non-digits)
    const formattedPhone = phoneToTest.replace(/\D/g, '');
    
    // Prepare the params
    const params = new URLSearchParams({
      token: API_KEY,
      phone: formattedPhone,
      output: 'json' // This should be 'output' not 'format' according to the docs
    });
    
    // Construct the request URL
    const requestUrl = `${API_URL}?${params.toString()}`;
    console.log(`Validation URL: ${requestUrl}`);
    
    // Make the API request directly
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // Check response
    if (!response.ok) {
      console.error(`HTTP error! Status: ${response.status}`);
      return;
    }
    
    // Parse response
    const responseText = await response.text();
    console.log('Raw API Response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('Parsed API Response:', JSON.stringify(data, null, 2));
      
      // Check if we received a phone_type
      console.log(`\nPhone Type Checking:`);
      console.log(`- phone_type value: "${data.phone_type || 'NOT FOUND'}"`);
      console.log(`- Is VoIP based on API: ${data.phone_type?.toLowerCase() === 'voip' ? 'YES' : 'NO'}`);
      
      // Additional checks for specific indicators
      if (data.phone_type) {
        console.log(`- Contains "voip": ${data.phone_type.toLowerCase().includes('voip') ? 'YES' : 'NO'}`);
        console.log(`- Contains "google": ${data.phone_type.toLowerCase().includes('google') ? 'YES' : 'NO'}`);
        console.log(`- Contains "voice": ${data.phone_type.toLowerCase().includes('voice') ? 'YES' : 'NO'}`);
      }
      
      // Check raw response for carrier details
      console.log(`\nCarrier Checking:`);
      console.log(`- Contains "bandwidth.com": ${responseText.toLowerCase().includes('bandwidth.com') ? 'YES' : 'NO'}`);
      console.log(`- Contains "google": ${responseText.toLowerCase().includes('google') ? 'YES' : 'NO'}`);
      console.log(`- Contains "twilio": ${responseText.toLowerCase().includes('twilio') ? 'YES' : 'NO'}`);
      
    } catch (error) {
      console.error('Error parsing JSON response:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test as an IIFE in ES modules
(async () => {
  await testPhoneValidation();
})();
