// Script to post an OnPoint lead to compliance.juicedmedia.io
import fetch from 'node-fetch';

const postOnpointLead = async () => {
  try {
    // OnPoint lead format with all required fields
    const leadData = {
      // Required core fields
      first_name: "John",
      last_name: "Test",
      email: "johntest@example.com",
      phone: "16622997523", // The requested phone number
      
      // Required routing fields
      list_id: "1b759535-2a5e-421e-9371-3bde7f855c60", // OnPoint list ID
      campaign_id: "b6c14a66-b159-4e57-bb15-a1595686d26c", // Standard campaign ID
      
      // Required compliance fields
      income_bracket: "$50,000-$75,000",
      state: "CA",
      homeowner_status: "Rent",
      dob: "1980-01-01",
      
      // Additional metadata
      source: "Onpoint",
      zip_code: "90210",
      address: "123 Test St",
      city: "Los Angeles",
      trusted_form_cert_url: "https://cert.trustedform.com/example",
      
      // API key
      api_key: "test_key_123"
    };

    console.log('Posting OnPoint lead with phone number:', leadData.phone);
    
    const response = await fetch('https://compliance.juicedmedia.io/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(leadData)
    });

    const status = response.status;
    console.log('Response status:', status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    return { status, data };
  } catch (error) {
    console.error('Error posting OnPoint lead:', error);
    return { error: error.message };
  }
};

// Run the function
postOnpointLead();
