import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const LIST_ID = '1b759535-2a5e-421e-9371-3bde7f855c60';

async function checkActualLeadCount() {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    console.log(`Checking ALL leads for list ID: ${LIST_ID} with NO filters`);
    
    // Count ALL leads for this list ID without any filters
    const { count: totalCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', LIST_ID);
    
    if (countError) {
      console.error('Error counting leads:', countError);
      return;
    }
    
    // Count by status
    const statuses = ['success', 'pending', 'failed', 'rejected'];
    for (const status of statuses) {
      const { count, error } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', LIST_ID)
        .eq('status', status);
        
      if (error) {
        console.error(`Error counting ${status} leads:`, error);
        continue;
      }
      
      console.log(`${status}: ${count} leads`);
    }
    
    // Get bid amount for this list ID
    const { data: routingData, error: routingError } = await supabase
      .from('list_routings')
      .select('bid')
      .eq('list_id', LIST_ID)
      .single();
    
    if (routingError) {
      console.error('Error fetching bid amount:', routingError);
    } else {
      const bid = routingData?.bid || 0;
      
      // Get actual count of success leads
      const { count: successCount, error: successError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', LIST_ID)
        .eq('status', 'success');
      
      if (successError) {
        console.error('Error counting success leads:', successError);
      } else {
        console.log('\n=== REVENUE SUMMARY ===');
        console.log(`Total leads: ${totalCount}`);
        console.log(`Successful leads: ${successCount}`);
        console.log(`Bid amount: $${bid}`);
        console.log(`Total potential revenue: $${(totalCount * bid).toFixed(2)}`);
        console.log(`Actual revenue from successful leads: $${(successCount * bid).toFixed(2)}`);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkActualLeadCount();
