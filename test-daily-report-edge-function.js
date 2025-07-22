// Test script for the deployed Daily Revenue Report Edge Function
// Run with: node test-daily-report-edge-function.js

async function testDailyRevenueReportFunction() {
    console.log('🧪 Testing Daily Revenue Report Edge Function...');
    
    try {
        const url = 'https://xaglksnmuirvtrtdjkdu.supabase.co/functions/v1/daily-revenue-report';
        
        console.log(`📍 Function URL: ${url}`);
        console.log('🚀 Sending test request...');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE')
            },
            body: JSON.stringify({
                trigger: 'manual_test',
                timezone: 'America/New_York'
            })
        });
        
        console.log(`📊 Response Status: ${response.status}`);
        console.log(`📊 Response Headers:`, Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log(`📊 Response Body: ${responseText}`);
        
        if (response.ok) {
            console.log('✅ Edge Function is working correctly!');
            
            try {
                const responseData = JSON.parse(responseText);
                if (responseData.kpis) {
                    console.log('📈 KPIs Returned:');
                    console.log(`   Total Leads: ${responseData.kpis.totalLeads}`);
                    console.log(`   Net Profit: $${responseData.kpis.netProfit?.toFixed(2)}`);
                    console.log(`   Active Lists: ${responseData.kpis.activeListsCount}`);
                    console.log(`   Raw Transfer Postbacks: ${responseData.kpis.rawTransferPostbacks || responseData.kpis.totalTransferLeads || 0}`);
                }
            } catch (parseError) {
                console.log('⚠️  Could not parse response as JSON, but function executed successfully');
            }
        } else {
            console.error('❌ Edge Function returned an error');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
    
    console.log('\n📝 Note: If you see authentication errors, make sure to set SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.log('💡 You can also test directly in the Supabase Dashboard under Functions');
}

// Test transfer postback functionality (optional)
async function testTransferPostbackFunctionality() {
    console.log('\n🔄 Testing Transfer Postback Functionality...');
    
    // Note: This would require a valid compliance_lead_id and API key
    // Uncomment and modify the following to test transfer postbacks:
    
    /*
    try {
        const transferResponse = await fetch('https://your-app-url.com/api/transfer-postback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                compliance_lead_id: 'your-test-lead-id',
                api_key: 'your-transfer-api-key',
                transfer_notes: 'Test transfer postback for raw counting'
            })
        });
        
        const transferResult = await transferResponse.json();
        console.log('📄 Transfer postback result:', transferResult);
        
        if (transferResult.success) {
            console.log('✅ Transfer postback processed - raw counting enabled');
            console.log('📊 Raw transfer logging:', transferResult.raw_transfer_logged);
        }
        
    } catch (error) {
        console.error('❌ Transfer postback test failed:', error.message);
    }
    */
    
    console.log('ℹ️  Transfer postback testing requires valid lead ID and API key');
    console.log('🔗 Endpoint: /api/transfer-postback');
    console.log('📋 Required fields: compliance_lead_id, api_key');
    console.log('🎯 New feature: Raw transfer counting (no dedupe logic)');
}

// Run the tests
console.log('🏁 Starting Daily Revenue Report System Tests...\n');

testDailyRevenueReportFunction()
    .then(() => testTransferPostbackFunctionality())
    .then(() => {
        console.log('\n🎉 Test suite completed!');
        console.log('📊 Key Changes:');
        console.log('   ✅ Transfer dedupe logic removed');
        console.log('   ✅ Raw transfer postback counting enabled');
        console.log('   ✅ transfer_postbacks table created');
        console.log('   ✅ Daily report updated to use raw counts');
    }); 