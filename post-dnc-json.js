// Script to post DNC entry using fetch API with JSON
import fetch from 'node-fetch';

const postDNC = async () => {
  try {
    const response = await fetch('https://compliance.juicedmedia.io/api/dialer/dnc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify({
        "api_key": "test_key_123",
        "phone_number": "1234567890",
        "reason": "Customer requested opt-out",
        "source": "dialer_system"
      })
    });

    const status = response.status;
    console.log('Response status:', status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    return { status, data };
  } catch (error) {
    console.error('Error posting DNC entry:', error);
    return { error: error.message };
  }
};

// Run the function
postDNC();
