// Script to remove leads with blacklisted phone numbers
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize the Supabase client with the service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// The phone number to remove
const phoneToRemove = process.argv[2] || '9042262687';

async function main() {
  try {
    console.log(`Looking for leads with phone number: ${phoneToRemove}`);
    
    // First, get the leads to be deleted/updated
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, status, created_at')
      .eq('phone', phoneToRemove);
    
    if (fetchError) {
      throw new Error(`Error fetching leads: ${fetchError.message}`);
    }
    
    if (!leads || leads.length === 0) {
      console.log('No leads found with the specified phone number.');
      return;
    }
    
    console.log(`Found ${leads.length} leads with the blacklisted phone number:`);
    leads.forEach(lead => {
      console.log(`ID: ${lead.id} | Name: ${lead.first_name} ${lead.last_name} | Created: ${lead.created_at}`);
    });
    
    console.log('\nUpdating leads status to "removed"...');
    
    // Choose to update the status instead of hard deleting to maintain an audit trail
    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({ status: 'removed' })
      .eq('phone', phoneToRemove)
      .select();
    
    if (updateError) {
      throw new Error(`Error updating leads: ${updateError.message}`);
    }
    
    console.log(`Successfully marked ${updated.length} leads as "removed".`);
    
    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('leads')
      .select('id, status')
      .eq('phone', phoneToRemove);
    
    if (verifyError) {
      throw new Error(`Error verifying update: ${verifyError.message}`);
    }
    
    console.log('\nVerified leads now have "removed" status:');
    verifyData.forEach(lead => {
      console.log(`ID: ${lead.id} | Status: ${lead.status}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
