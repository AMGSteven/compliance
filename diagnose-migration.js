/**
 * Diagnostic Script for Historical Bid Tracking
 * Checks current database state and identifies issues
 */

const baseUrl = 'http://localhost:3001';

async function diagnoseMigration() {
  console.log('🔍 Diagnosing Historical Bid Tracking Setup');
  console.log('===========================================');
  
  // Test 1: Check if API is running
  console.log('1. Testing API connection...');
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET'
    });
    
    if (response.ok) {
      console.log('   ✅ API is running');
    } else {
      console.log('   ⚠️  API returned status:', response.status);
    }
  } catch (error) {
    console.log('   ❌ API connection failed:', error.message);
    console.log('   💡 Make sure "npm run dev" is running');
    return false;
  }
  
  // Test 2: Try a minimal lead submission to see the exact error
  console.log('2. Testing minimal lead submission...');
  
  const minimalLead = {
    firstName: 'Test',
    lastName: 'User', 
    email: 'test@example.com',
    phone: '6507769592', // Test phone that bypasses compliance
    state: 'CA',
    zipCode: '90210',
    listId: '1b759535-c36a-4b05-9b72-9e123456789a',
    campaignId: 'test-campaign',
    incomeBracket: '$50,000-$75,000',
    homeownerStatus: 'Own',
    ageRange: '35-44'
  };
  
  try {
    const response = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalLead)
    });
    
    const result = await response.json();
    
    console.log('   Response status:', response.status);
    console.log('   Response body:', JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.log('   🔍 Error analysis:');
      
      if (result.error.includes('bid_amount')) {
        console.log('   ❌ ISSUE: bid_amount column missing from database');
        console.log('   💡 SOLUTION: Run the manual SQL migration in Supabase dashboard');
        return false;
      } else if (result.error.includes('Failed to insert lead')) {
        console.log('   ❌ ISSUE: Database insertion failed (likely schema issue)');
        console.log('   💡 SOLUTION: Check database schema and apply migration');
        return false;
      } else if (result.error.includes('compliance')) {
        console.log('   ❌ ISSUE: Compliance check failed');
        console.log('   💡 Phone number might be in DNC list despite being test number');
        return false;
      }
    } else if (result.success) {
      console.log('   ✅ Lead submission successful!');
      console.log('   📊 Bid amount returned:', result.bid || 'N/A');
      return true;
    }
    
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
    return false;
  }
  
  return false;
}

async function suggestSolutions() {
  console.log('');
  console.log('🔧 Recommended Solutions');
  console.log('=======================');
  console.log('');
  console.log('1. 📊 Apply Database Migration:');
  console.log('   • Go to your Supabase Dashboard');
  console.log('   • Navigate to SQL Editor');
  console.log('   • Run this SQL:');
  console.log('     ALTER TABLE leads ADD COLUMN IF NOT EXISTS bid_amount DECIMAL(10,2);');
  console.log('     CREATE INDEX IF NOT EXISTS idx_leads_bid_amount ON leads(bid_amount);');
  console.log('');
  console.log('2. ✅ Verify Migration:');
  console.log('   • In Supabase, check leads table schema');
  console.log('   • Confirm bid_amount column exists');
  console.log('');
  console.log('3. 🧪 Test Again:');
  console.log('   • Run: node quick-bid-test.js');
  console.log('   • Should see successful lead submission with bid amount');
  console.log('');
  console.log('4. 📋 Next Steps After Migration:');
  console.log('   • Run comprehensive tests: node test-historical-bid-tracking.js');
  console.log('   • Update revenue dashboard to use stored bid_amount');
  console.log('   • Update returns export calculations');
}

// Run diagnostics
diagnoseMigration().then(success => {
  if (!success) {
    suggestSolutions();
  } else {
    console.log('');
    console.log('🎉 All tests passed! Historical bid tracking is working.');
    console.log('💡 Next: Run comprehensive tests with different bid amounts');
  }
}).catch(console.error);
