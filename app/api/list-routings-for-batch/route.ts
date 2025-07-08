import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing Supabase config - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/list-routings-for-batch
 * Returns simplified list of active list routings for batch upload selection
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Fetching list routings for batch selection...');
    
    // Create Supabase client
    const supabase = createServerClient();
    
    // Fetch active list routings with essential fields for batch selection
    const { data: routings, error } = await supabase
      .from('list_routings')
      .select(`
        id,
        list_id,
        campaign_id,
        cadence_id,
        description,
        bid,
        dialer_type,
        token
      `)
      .eq('active', true)
      .order('description', { ascending: true });
    
    if (error) {
      console.error('Error fetching list routings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch list routings' },
        { status: 500 }
      );
    }
    
    // Transform the data for batch selection dropdown
    const routingOptions = routings?.map(routing => ({
      id: routing.id,
      list_id: routing.list_id,
      campaign_id: routing.campaign_id,
      cadence_id: routing.cadence_id,
      description: routing.description || `List ${routing.list_id.substring(0, 8)}...`,
      bid: routing.bid || 0.00,
      dialer_type: routing.dialer_type || 1,
      dialer_name: routing.dialer_type === 2 ? 'Pitch BPO' : 'Internal Dialer',
      token: routing.token,
      // Create display label for dropdown
      display_label: `${routing.description || `List ${routing.list_id.substring(0, 8)}...`} (${routing.dialer_type === 2 ? 'Pitch BPO' : 'Internal'} - $${routing.bid || '0.00'})`
    })) || [];
    
    console.log(`Found ${routingOptions.length} active list routings for batch selection`);
    
    return NextResponse.json({
      success: true,
      data: routingOptions,
      count: routingOptions.length
    });
    
  } catch (error) {
    console.error('Error in list-routings-for-batch API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
