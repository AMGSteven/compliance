// Direct test for dialer approval enforcement
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test function to check dialer approval directly
async function testDialerApproval(listId, dialerType) {
  try {
    console.log(`\n🔍 Testing dialer approval for list_id: ${listId}, dialer_type: ${dialerType}`);
    
    const { data, error } = await supabase
      .from('dialer_approvals')
      .select('approved, reason, approved_by')
      .eq('list_id', listId)
      .eq('dialer_type', dialerType)
      .single();

    if (error) {
      console.log(`⚠️  No approval record found - Error: ${error.message}`);
      console.log(`✅ Result: APPROVED (default - backward compatibility)`);
      return true;
    }

    const isApproved = data.approved === true;
    const dialerName = dialerType === 1 ? 'Internal' : dialerType === 2 ? 'Pitch BPO' : dialerType === 3 ? 'Convoso' : 'Unknown';
    
    console.log(`📋 Approval Record Found:`, {
      list_id: listId,
      dialer_type: dialerType,
      dialer_name: dialerName,
      approved: data.approved,
      reason: data.reason || 'N/A',
      approved_by: data.approved_by || 'N/A',
      decision: isApproved ? '✅ ALLOW ROUTING' : '❌ BLOCK ROUTING'
    });

    return isApproved;
  } catch (error) {
    console.error(`❌ Error checking approval:`, error);
    console.log(`✅ Result: APPROVED (error fallback)`);
    return true;
  }
}

// Test function to check routing configuration
async function testRoutingConfig(listId) {
  try {
    console.log(`\n🔧 Testing routing config for list_id: ${listId}`);
    
    const { data, error } = await supabase
      .from('list_routings')
      .select('list_id, dialer_type, active, description')
      .eq('list_id', listId)
      .eq('active', true);

    if (error) {
      console.error(`❌ Error fetching routing config:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`⚠️  No active routing configuration found for ${listId}`);
      return null;
    }

    console.log(`📋 Routing Configuration:`, data[0]);
    return data[0];
  } catch (error) {
    console.error(`❌ Error checking routing config:`, error);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 DIALER APPROVAL ENFORCEMENT TEST');
  console.log('=====================================');
  
  const testListIds = [
    'pitch-bpo-list-1753912373079',
    'cd86b81c-1c76-4639-b287-d482bb215dfe'
  ];
  
  const dialerTypes = [1, 2, 3]; // Internal, Pitch BPO, Convoso
  
  for (const listId of testListIds) {
    console.log(`\n🎯 TESTING LIST ID: ${listId}`);
    console.log('='.repeat(50));
    
    // First check if routing config exists
    const routingConfig = await testRoutingConfig(listId);
    
    if (routingConfig) {
      console.log(`\n🔍 Testing approval for configured dialer type: ${routingConfig.dialer_type}`);
      await testDialerApproval(listId, routingConfig.dialer_type);
    }
    
    // Test all dialer types for completeness
    for (const dialerType of dialerTypes) {
      await testDialerApproval(listId, dialerType);
    }
  }
  
  console.log('\n✅ Test completed!');
  process.exit(0);
}

// Run the tests
runTests().catch(console.error);
