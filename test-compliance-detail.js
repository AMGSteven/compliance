// Test compliance check details for phone number 7723615271
import fetch from 'node-fetch';

async function main() {
  const phoneNumber = '7723615271';
  console.log(`Testing compliance checks for phone number: ${phoneNumber}`);
  
  // Include all possible fields to ensure we get past any field validation
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
    "traffic_source": "compliance_test",
    "ip_address": "127.0.0.1",
    "landing_page": "https://compliance.juicedmedia.io",
    "tc_agreed": true,
    // Adding a special flag to get detailed compliance check info
    "debug_compliance": true
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
      console.log('✅ Lead accepted! ID:', data.lead_id);
      console.log('Dialer info:', {
        type: data.dialer?.type,
        forwarded: data.dialer?.forwarded,
        status: data.dialer?.status
      });
    } else {
      console.log('❌ Lead rejected!');
      console.log('Error:', data.error);
      
      // Check for compliance details
      if (data.details) {
        console.log('\nCompliance Check Details:');
        
        // Check for blacklist alliance rejection
        if (data.details.blacklistAlliance || data.details.bla) {
          console.log('✓ FAILED: Blacklist Alliance check');
        }
        
        // Check for TCPA violation
        if (data.details.tcpaViolation || data.details.tcpa) {
          console.log('✓ FAILED: TCPA check');
        }
        
        // Check for WebRecon rejection
        if (data.details.webRecon || data.details.webrecon) {
          console.log('✓ FAILED: WebRecon check');
        }
        
        // Check for DNC rejection
        if (data.details.dnc || data.details.doNotCall) {
          console.log('✓ FAILED: Do Not Call check');
        }
        
        // Check for internal DNC
        if (data.details.internalDnc) {
          console.log('✓ FAILED: Internal DNC check');
        }
        
        // If we have a compliance object with detailed results
        if (data.details.compliance) {
          console.log('\nDetailed Compliance Results:');
          console.log(JSON.stringify(data.details.compliance, null, 2));
        }
        
        // Fall back to showing raw details if specific fields not found
        if (!data.details.blacklistAlliance && 
            !data.details.tcpaViolation && 
            !data.details.webRecon && 
            !data.details.dnc && 
            !data.details.compliance) {
          console.log('\nRaw Details:');
          console.log(JSON.stringify(data.details, null, 2).substring(0, 2000));
          if (JSON.stringify(data.details).length > 2000) {
            console.log('... [truncated]');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
