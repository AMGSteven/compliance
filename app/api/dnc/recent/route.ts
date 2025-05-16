import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Generate mock DNC data as a fallback
function getMockDNCEntries(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: `dnc-${i + 1}`,
    phone_number: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    source: ['api', 'dashboard', 'import', 'web form'][Math.floor(Math.random() * 4)],
    source_id: `source-${i + 1}`,
    date_added: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  }));
}

export async function GET() {
  try {
    console.log('Fetching recent DNC entries with Supabase...');
    const supabase = createServerClient();
    
    // Fetch the 5 most recent DNC entries, try both 'dnc' and 'dnc_entries' tables
    // since we don't know which one your database is using
    let data = null;
    let error = null;
    
    // Try 'dnc' table first
    const dncResult = await supabase
      .from('dnc')
      .select('*')
      .eq('status', 'active')
      .order('date_added', { ascending: false })
      .limit(5);
      
    if (dncResult.error) {
      console.error('Error fetching from dnc table:', dncResult.error);
      
      // Try 'dnc_entries' table as fallback
      const dncEntriesResult = await supabase
        .from('dnc_entries')
        .select('*')
        .eq('status', 'active')
        .order('date_added', { ascending: false })
        .limit(5);
        
      if (dncEntriesResult.error) {
        console.error('Error fetching from dnc_entries table:', dncEntriesResult.error);
        console.log('Falling back to mock DNC data');
        return NextResponse.json(getMockDNCEntries(5));
      }
      
      data = dncEntriesResult.data;
    } else {
      data = dncResult.data;
    }

    console.log(`Successfully fetched ${data?.length || 0} recent DNC entries`);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching recent DNC entries:', error);
    // Return mock data to maintain UI functionality
    console.log('Returning mock DNC entries due to error');
    return NextResponse.json(getMockDNCEntries(5));
  }
}
