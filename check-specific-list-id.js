import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const LIST_ID = '1b759535-2a5e-421e-9371-3bde7f855c60';

async function checkListIdData() {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    console.log(`Checking data for list ID: ${LIST_ID}`);
    
    // 1. Get the bid amount for this list ID
    const { data: routingData, error: routingError } = await supabase
      .from('list_routings')
      .select('*')
      .eq('list_id', LIST_ID);
    
    if (routingError) {
      console.error('Error fetching routing data:', routingError);
      return;
    }
    
    console.log('\n=== LIST ROUTING DATA ===');
    if (routingData.length === 0) {
      console.log('No list routing found for this list ID.');
    } else {
      routingData.forEach(routing => {
        console.log(`- List ID: ${routing.list_id}`);
        console.log(`- Campaign ID: ${routing.campaign_id}`);
        console.log(`- Description: ${routing.description}`);
        console.log(`- Bid Amount: $${routing.bid}`);
        console.log(`- Active: ${routing.active}`);
        console.log(`- Created At: ${routing.created_at}`);
        console.log('---');
      });
    }
    
    // 2. Get all leads for this list ID (regardless of status)
    const { data: allLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, status')
      .eq('list_id', LIST_ID);
    
    if (leadsError) {
      console.error('Error fetching leads data:', leadsError);
      return;
    }
    
    // 3. Get successful leads for this list ID
    const { data: successLeads, error: successError } = await supabase
      .from('leads')
      .select('id, status')
      .eq('list_id', LIST_ID)
      .eq('status', 'success');
    
    if (successError) {
      console.error('Error fetching successful leads data:', successError);
      return;
    }
    
    console.log('\n=== LEADS SUMMARY ===');
    console.log(`Total leads from this list ID: ${allLeads.length}`);
    console.log(`Successful leads from this list ID: ${successLeads.length}`);
    
    // 4. Calculate revenue based on successful leads and bid amount
    let totalRevenue = 0;
    if (routingData.length > 0 && routingData[0].bid) {
      totalRevenue = successLeads.length * routingData[0].bid;
      console.log(`\nTotal revenue from this list ID: $${totalRevenue.toFixed(2)}`);
      console.log(`Based on ${successLeads.length} successful leads at $${routingData[0].bid} per lead`);
    } else {
      console.log('\nCannot calculate revenue - no bid amount found for this list ID');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkListIdData();
