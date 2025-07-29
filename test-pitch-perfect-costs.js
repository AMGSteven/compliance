const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (same as frontend)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPitchPerfectCosts() {
  console.log('🧪 Testing Pitch Perfect Costs Calculation...');
  
  // Test 2-day range: July 27-28, 2025
  const startDate = '2025-07-27';
  const endDate = '2025-07-28';
  
  try {
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    
    // Replicate the exact query from fetchPitchPerfectCosts
    let query = supabase
      .from('pitch_perfect_costs')
      .select('billable_cost, created_at, billable_status')
      .eq('billable_status', 'billable');

    // Add date filtering (same logic as frontend)
    const startDateTime = new Date(startDate + 'T00:00:00-05:00').toISOString();
    const endDateTime = new Date(endDate + 'T23:59:59-05:00').toISOString();
    
    query = query
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    console.log(`🔍 Query range: ${startDateTime} to ${endDateTime}`);

    const { data, error } = await query;

    if (error) {
      console.error('❌ Query Error:', error);
      return;
    }

    console.log(`📊 Records Found: ${data?.length || 0}`);
    
    if (data && data.length > 0) {
      // Show individual costs
      console.log('💰 Individual Costs:');
      data.slice(0, 10).forEach((record, i) => {
        console.log(`  ${i+1}. $${record.billable_cost} (${record.created_at})`);
      });
      
      // Calculate total (same as frontend)
      const totalCosts = data.reduce((sum, record) => sum + (record.billable_cost || 0), 0);
      
      console.log(`\n🎯 RESULTS:`);
      console.log(`   Total Records: ${data.length}`);
      console.log(`   Total Cost: $${totalCosts.toFixed(2)}`);
      console.log(`   Average Cost per Record: $${(totalCosts / data.length).toFixed(2)}`);
      
      // Check for suspicious patterns
      const uniqueCosts = [...new Set(data.map(r => r.billable_cost))];
      console.log(`   Unique Cost Values: ${uniqueCosts.length} different values`);
      
      if (uniqueCosts.length === 1 && data.length > 1) {
        console.log('⚠️  SUSPICIOUS: All records have identical cost!');
        console.log(`   Repeated Value: $${uniqueCosts[0]}`);
      }
      
      if (totalCosts > 15000) {
        console.log('⚠️  SUSPICIOUS: Total cost very high for 2 days!');
      }
      
    } else {
      console.log('ℹ️  No billable Pitch Perfect costs found for this date range');
    }
    
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

testPitchPerfectCosts();
