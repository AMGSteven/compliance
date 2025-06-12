// Simple test for phone number 7723615271
import fetch from 'node-fetch';

async function main() {
  const phoneNumber = '7723615271';
  console.log(`Testing phone number: ${phoneNumber}`);
  
  const lead = {
    "first_name": "TestPhone",
    "last_name": "Number5271",
    "email": "test.772@example.com",
    "phone": phoneNumber,
    "state": "TX",
    "list_id": "pitch-bpo-list-1749233817305",
    "campaign_id": "pitch-bpo-campaign-1749233817305",
    "cadence_id": "pitch-bpo-cadence-1749233817305"
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(lead)
    });
    
    console.log('Status Code:', response.status);
    const data = await response.json();
    
    if (data.success === true) {
      console.log('Lead accepted! ID:', data.lead_id);
      console.log('Dialer info:', {
        type: data.dialer?.type,
        forwarded: data.dialer?.forwarded,
        status: data.dialer?.status
      });
      
      if (data.dialer?.response) {
        console.log('Dialer response:', data.dialer.response);
      }
    } else {
      console.log('Lead rejected!');
      console.log('Error:', data.error);
      
      if (data.details) {
        if (typeof data.details === 'object' && Object.keys(data.details).length <= 3) {
          console.log('Details:', data.details);
        } else {
          console.log('Details available but too large to display');
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
