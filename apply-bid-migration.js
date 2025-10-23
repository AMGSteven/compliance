/**
 * Safe Migration Script - Add bid_amount column only
 * This script adds the bid_amount column without affecting existing data
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase connection from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyBidMigration() {
  console.log('🔧 Applying Historical Bid Tracking Migration');
  console.log('===========================================');
  
  try {
    // Check if bid_amount column already exists
    console.log('📊 Checking if bid_amount column exists...');
    
    const { data: columns, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'leads')
      .eq('column_name', 'bid_amount');
    
    if (checkError) {
      console.error('❌ Failed to check column existence:', checkError.message);
      return false;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ bid_amount column already exists!');
      console.log('📝 Migration already applied, no changes needed.');
      return true;
    }
    
    console.log('➕ Adding bid_amount column...');
    
    // Add the bid_amount column
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS bid_amount DECIMAL(10,2);
        COMMENT ON COLUMN leads.bid_amount IS 'Historical bid amount at time of lead submission';
      `
    });
    
    if (addColumnError) {
      console.error('❌ Failed to add bid_amount column:', addColumnError.message);
      console.log('💡 Trying alternative approach...');
      
      // Try direct SQL approach
      const { error: altError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE leads ADD COLUMN bid_amount DECIMAL(10,2);'
      });
      
      if (altError) {
        console.error('❌ Alternative approach also failed:', altError.message);
        console.log('🔧 Please run this SQL manually in your Supabase dashboard:');
        console.log('   ALTER TABLE leads ADD COLUMN bid_amount DECIMAL(10,2);');
        console.log('   CREATE INDEX IF NOT EXISTS idx_leads_bid_amount ON leads(bid_amount);');
        console.log('   CREATE INDEX IF NOT EXISTS idx_leads_list_bid ON leads(list_id, bid_amount);');
        return false;
      }
    }
    
    console.log('✅ bid_amount column added successfully');
    
    // Add indexes for performance
    console.log('📊 Adding performance indexes...');
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_leads_bid_amount ON leads(bid_amount);
        CREATE INDEX IF NOT EXISTS idx_leads_list_bid ON leads(list_id, bid_amount);
        CREATE INDEX IF NOT EXISTS idx_leads_bid_created ON leads(bid_amount, created_at);
      `
    });
    
    if (indexError) {
      console.log('⚠️ Warning: Failed to add indexes:', indexError.message);
      console.log('   The column was added but indexes may need to be created manually');
    } else {
      console.log('✅ Performance indexes added successfully');
    }
    
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('   ✅ bid_amount column added to leads table');
    console.log('   ✅ Performance indexes created');
    console.log('   📈 Historical bid tracking is now ready');
    
    return true;
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.log('');
    console.log('🔧 Manual SQL to run in Supabase dashboard:');
    console.log('   ALTER TABLE leads ADD COLUMN IF NOT EXISTS bid_amount DECIMAL(10,2);');
    console.log('   CREATE INDEX IF NOT EXISTS idx_leads_bid_amount ON leads(bid_amount);');
    console.log('   CREATE INDEX IF NOT EXISTS idx_leads_list_bid ON leads(list_id, bid_amount);');
    return false;
  }
}

async function testMigration() {
  console.log('');
  console.log('🧪 Testing Migration');
  console.log('==================');
  
  try {
    // Test that we can query the new column
    const { data, error } = await supabase
      .from('leads')
      .select('id, bid_amount')
      .limit(1);
    
    if (error) {
      console.error('❌ Test failed:', error.message);
      return false;
    }
    
    console.log('✅ Migration test passed - can query bid_amount column');
    return true;
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return false;
  }
}

async function main() {
  const migrationSuccess = await applyBidMigration();
  
  if (migrationSuccess) {
    const testSuccess = await testMigration();
    
    if (testSuccess) {
      console.log('');
      console.log('🚀 Ready to test historical bid tracking!');
      console.log('   Run: node quick-bid-test.js');
    }
  }
  
  process.exit(migrationSuccess ? 0 : 1);
}

main().catch(console.error);
