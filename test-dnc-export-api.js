// Test script to directly call the DNC export API
import fetch from 'node-fetch';

const listId = 'pitch-bpo-list-1750372488308';
const startDate = '2025-07-01';
const endDate = '2025-07-31';

async function testDNCExportAPI() {
  console.log('🧪 TESTING DNC EXPORT API DIRECTLY');
  console.log('=====================================');
  console.log(`📋 List ID: ${listId}`);
  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log('');

  const url = `http://localhost:3000/api/dnc/export?list_id=${listId}&start_date=${startDate}&end_date=${endDate}&page=1&limit=10`;
  
  console.log(`🌐 Calling: ${url}`);
  console.log('');

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`📈 Total Count: ${data.metadata?.total_count || 'N/A'}`);
    console.log(`📋 Returned Count: ${data.metadata?.returned_count || 'N/A'}`);
    console.log(`📝 Message: ${data.metadata?.message || 'N/A'}`);
    console.log('');
    
    if (data.data && data.data.length > 0) {
      console.log('📱 Sample DNC matches:');
      data.data.slice(0, 3).forEach((match, i) => {
        console.log(`  ${i + 1}. Phone: ${match.phone_number}`);
        console.log(`     DNC Date: ${match.dnc_date_added}`);
        console.log(`     DNC Reason: ${match.dnc_reason}`);
        console.log(`     Lead Date: ${match.lead_created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No DNC matches found in response');
    }
    
    console.log('🔍 Full metadata:', JSON.stringify(data.metadata, null, 2));
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
  
  console.log('');
  console.log('🏁 API TEST COMPLETE');
}

testDNCExportAPI().catch(console.error);
