// Test Script for phone number 7723615271 with all required fields
import fetch from 'node-fetch';

const phoneNumber = '7723615271';
const lead = {
  "first_name": "TestPhone",
  "last_name": "Number5271",
  "email": "test.772@example.com",
  "phone": phoneNumber,
  "state": "TX",
  "list_id": "pitch-bpo-list-1749233817305",
  "campaign_id": "pitch-bpo-campaign-1749233817305",
  "cadence_id": "pitch-bpo-cadence-1749233817305",
  "city": "Austin",
  "zip": "78701",
  "income_bracket": "100000-150000",
  "homeowner_status": "Yes",
  "age_range": "35-44",
  "traffic_source": "phone_test",
  "ip_address": "127.0.0.1",
  "landing_page": "https://compliance.juicedmedia.io",
  "tc_agreed": true
};

console.log(`Testing phone number: ${phoneNumber}`);

fetch('http://localhost:3000/api/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'test_key_123'
  },
  body: JSON.stringify(lead)
})
.then(response => {
  console.log('Status Code:', response.status);
  return response.json();
})
.then(data => {
  console.log('Success:', data.success);
  
  if (data.success) {
    console.log('Lead ID:', data.lead_id);
    if (data.dialer) {
      console.log('Dialer Type:', data.dialer.type);
      console.log('Forwarded:', data.dialer.forwarded);
      console.log('Status:', data.dialer.status);
      console.log('Response:', data.dialer.response);
    }
  } else {
    console.log('Error:', data.error);
    if (data.details) console.log('Details:', JSON.stringify(data.details, null, 2));
  }
})
.catch(error => console.error('Error:', error));
