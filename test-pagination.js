import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPagination() {
  const testListId = 'pitch-bpo-list-1750372500892';
  console.log('Testing pagination for list:', testListId);
  
  // First get the total count
  const { count, error: countError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', testListId);
  
  if (countError) {
    console.error('Count error:', countError);
    return;
  }
  
  console.log('Total leads in database for this list:', count);
  
  // Test pagination (same logic as the API)
  const allLeads = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    console.log(`Fetching batch starting from ${from}...`);
    
    const { data: batchLeads, error } = await supabase
      .from('leads')
      .select('id, list_id, created_at')
      .eq('list_id', testListId)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);
      
    if (error) {
      console.error('Batch error:', error);
      break;
    }
    
    if (batchLeads && batchLeads.length > 0) {
      allLeads.push(...batchLeads);
      console.log(`Got ${batchLeads.length} leads, total so far: ${allLeads.length}`);
      
      hasMore = batchLeads.length === batchSize;
      from += batchSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`Final result: ${allLeads.length} leads fetched via pagination`);
  console.log(`Expected: ${count}, Got: ${allLeads.length}, Match: ${allLeads.length === count}`);
}

testPagination();
