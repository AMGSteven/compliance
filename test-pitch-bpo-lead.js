// Test script to send a lead to Pitch BPO dialer
import fetch from 'node-fetch';

async function sendTestLeadToPitchBPO() {
  // Test lead data with the specified phone number
  const leadData = {
    first_name: "TestFirstName",
    last_name: "TestLastName",
    email: "test@example.com",
    phone: "6507769592", // The requested phone number
    state: "CA",
    city: "San Francisco",
    zip: "94107",
    traffic_source: "compliance_test",
    ip_address: "127.0.0.1",
    landing_page: "https://test.compliance.com",
    tc_agreed: true,
    custom1: "TestCustom1",
    dialer_type: 2, // 2 is for Pitch BPO
    test_mode: true // Flag it as a test lead
  };

  try {
    console.log('Sending test lead to Pitch BPO:', leadData);
    
    const response = await fetch('http://localhost:3030/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test_key_123' // Use your actual API key here
      },
      body: JSON.stringify(leadData)
    });

    const result = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    try {
      const jsonResult = JSON.parse(result);
      console.log('Parsed JSON response:', jsonResult);
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
    
    if (response.ok) {
      console.log('Successfully sent test lead to Pitch BPO');
    } else {
      console.error('Failed to send test lead');
    }
  } catch (error) {
    console.error('Error sending test lead:', error);
  }
}

// Run the function
sendTestLeadToPitchBPO();
