// Debug script to check DNC export data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugDNCExport() {
  console.log('🔍 DEBUGGING DNC EXPORT DATA');
  console.log('=====================================');
  
  // The list ID provided by user
  const listId = 'pitch-bpo-list-1750372488308';
  const startDate = '2025-07-01';
  const endDate = '2025-07-31';
  
  console.log(`📋 List ID: ${listId}`);
  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log('');
  
  // 1. Check if this list ID exists in any table
  console.log('1. Checking if list ID exists in leads table...');
  
  // Get COUNT of all leads for this list ID
  const { count: totalLeadsCount, error: countError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);
    
  if (countError) {
    console.error('❌ Error getting count:', countError);
  } else {
    console.log(`📊 TOTAL leads for this list ID (any date): ${totalLeadsCount || 0}`);
  }
  
  // Get a few sample leads
  const { data: allLeadsForList, error: allLeadsError } = await supabase
    .from('leads')
    .select('id, phone, created_at, list_id')
    .eq('list_id', listId)
    .limit(5);
    
  if (allLeadsError) {
    console.error('❌ Error checking leads:', allLeadsError);
  } else {
    console.log(`📊 Total leads for this list ID (any date): ${allLeadsForList?.length || 0}`);
    if (allLeadsForList && allLeadsForList.length > 0) {
      console.log('📱 Sample leads:', allLeadsForList.slice(0, 3).map(l => ({
        id: l.id.substring(0, 8) + '...',
        phone: l.phone,
        created_at: l.created_at
      })));
    }
  }
  console.log('');
  
  // 2. Check leads for this list ID in July 2025
  console.log('2. Checking leads for this list ID in July 2025...');
  
  // Get COUNT of July leads for this list ID
  const { count: julyLeadsCount, error: julyCountError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59.999Z');
    
  if (julyCountError) {
    console.error('❌ Error getting July count:', julyCountError);
  } else {
    console.log(`📊 TOTAL leads for this list ID in July 2025: ${julyLeadsCount || 0}`);
  }
  
  // Get a few sample July leads
  const { data: julyLeads, error: julyError } = await supabase
    .from('leads')
    .select('id, phone, created_at, list_id')
    .eq('list_id', listId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59.999Z')
    .limit(5);
    
  if (julyError) {
    console.error('❌ Error checking July leads:', julyError);
  } else {
    console.log(`📊 Leads for this list ID in July 2025: ${julyLeads?.length || 0}`);
    if (julyLeads && julyLeads.length > 0) {
      console.log('📱 Sample July leads:', julyLeads.slice(0, 3).map(l => ({
        id: l.id.substring(0, 8) + '...',
        phone: l.phone,
        created_at: l.created_at
      })));
    }
  }
  console.log('');
  
  // 3. Check any leads in July 2025 (any list ID)
  console.log('3. Checking ANY leads in July 2025...');
  const { data: anyJulyLeads, error: anyJulyError } = await supabase
    .from('leads')
    .select('id, phone, created_at, list_id')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59.999Z')
    .limit(5);
    
  if (anyJulyError) {
    console.error('❌ Error checking any July leads:', anyJulyError);
  } else {
    console.log(`📊 ANY leads in July 2025: ${anyJulyLeads?.length || 0}`);
    if (anyJulyLeads && anyJulyLeads.length > 0) {
      console.log('📱 Sample July leads (any list):', anyJulyLeads.slice(0, 3).map(l => ({
        id: l.id.substring(0, 8) + '...',
        phone: l.phone,
        created_at: l.created_at,
        list_id: l.list_id.substring(0, 8) + '...'
      })));
    }
  }
  console.log('');
  
  // 4. Check recent leads (to see what dates we actually have)
  console.log('4. Checking most recent leads (any list ID)...');
  const { data: recentLeads, error: recentError } = await supabase
    .from('leads')
    .select('id, phone, created_at, list_id')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (recentError) {
    console.error('❌ Error checking recent leads:', recentError);
  } else {
    console.log(`📊 Most recent leads: ${recentLeads?.length || 0}`);
    if (recentLeads && recentLeads.length > 0) {
      console.log('📱 Recent leads:', recentLeads.map(l => ({
        id: l.id.substring(0, 8) + '...',
        phone: l.phone,
        created_at: l.created_at,
        list_id: l.list_id.substring(0, 8) + '...'
      })));
    }
  }
  console.log('');
  
  // 5. Check list_routings table to see if this list ID is valid
  console.log('5. Checking if list ID exists in list_routings...');
  const { data: routings, error: routingsError } = await supabase
    .from('list_routings')
    .select('list_id, campaign, partner, bid, active')
    .eq('list_id', listId);
    
  if (routingsError) {
    console.error('❌ Error checking list_routings:', routingsError);
  } else {
    console.log(`📊 List routing entries: ${routings?.length || 0}`);
    if (routings && routings.length > 0) {
      console.log('⚙️ Routing config:', routings[0]);
    }
  }
  
  console.log('');
  console.log('🏁 DEBUG COMPLETE');
}

debugDNCExport().catch(console.error);
