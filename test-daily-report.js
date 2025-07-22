#!/usr/bin/env node

/**
 * Test script for the Daily Revenue Report Edge Function
 * Tests the enterprise-grade reporting system
 */

const SUPABASE_URL = 'https://znkqdfnzhtdoktkuczjr.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/daily-revenue-report`;

// You'll need to set this environment variable
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key_here';

async function testDailyRevenueReport() {
  console.log('🚀 Testing Daily Revenue Report Edge Function...');
  console.log(`📡 Endpoint: ${EDGE_FUNCTION_URL}`);
  
  try {
    const startTime = Date.now();
    
    // Test the edge function
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger: 'manual_test',
        timezone: 'America/New_York'
      })
    });
    
    const executionTime = Date.now() - startTime;
    
    console.log(`⏱️  Response time: ${executionTime}ms`);
    console.log(`📊 HTTP Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error: ${response.status} - ${errorText}`);
      return;
    }
    
    const result = await response.json();
    
    console.log('\n📈 Response Data:');
    console.log('================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📅 Report Date: ${result.reportDate}`);
    console.log(`⚡ Execution Time: ${result.executionTime}`);
    
    if (result.success && result.kpis) {
      console.log('\n💰 Key Performance Indicators:');
      console.log('==============================');
      console.log(`📊 Total Leads: ${result.kpis.totalLeads.toLocaleString()}`);
      console.log(`💵 Total Lead Costs: $${result.kpis.totalLeadCosts.toLocaleString()}`);
      console.log(`🎯 Net Profit: $${result.kpis.netProfit.toLocaleString()}`);
      console.log(`🔧 Math Consistency: ${result.kpis.mathematicalConsistency ? '✅ Passed' : '❌ Failed'}`);
      console.log(`📋 Active Lists: ${result.kpis.activeLists}`);
      
      if (result.kpis.mathematicalConsistency) {
        console.log('\n🎉 All systems operational! Data integrity confirmed.');
      } else {
        console.log('\n⚠️  Warning: Mathematical inconsistency detected. Check logs.');
      }
    }
    
    if (result.skipped) {
      console.log('\n⏭️  Report was skipped:');
      console.log(`📅 Reason: ${result.reason}`);
      console.log(`🗓️  Day: ${result.dayOfWeek}`);
    }
    
    console.log(`\n✅ Test completed successfully!`);
    console.log(`📧 Check your Slack channel for the daily revenue report.`);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n🔧 Troubleshooting tips:');
      console.log('- Ensure the edge function is deployed: supabase functions deploy daily-revenue-report');
      console.log('- Check your SUPABASE_SERVICE_ROLE_KEY environment variable');
      console.log('- Verify your network connection');
    }
  }
}

// Run the test
if (require.main === module) {
  console.log('🧪 Daily Revenue Report - Test Suite');
  console.log('====================================\n');
  
  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'your_service_role_key_here') {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    console.log('💡 Usage: SUPABASE_SERVICE_ROLE_KEY=your_key node test-daily-report.js');
    process.exit(1);
  }
  
  testDailyRevenueReport()
    .then(() => {
      console.log('\n🎯 Test suite completed. Check the results above.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testDailyRevenueReport }; 