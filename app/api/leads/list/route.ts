import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Generate mock lead data as a fallback
function getMockLeads(count = 10) {
  return Array.from({ length: count }, (_, i) => {
    // Include a mix of policy statuses, including some with no policy status
    const policyStatuses = [null, 'pending', 'issued', 'paid', 'cancelled', 'rejected'];
    const randomPolicyIndex = Math.floor(Math.random() * policyStatuses.length);
    
    return {
      id: `lead-${i + 1}`,
      first_name: `Test${i + 1}`,
      last_name: `User${i + 1}`,
      phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      email: `test${i + 1}@example.com`,
      status: ['new', 'success', 'error'][Math.floor(Math.random() * 3)],
      list_id: `test-list-${Math.floor(Math.random() * 3) + 1}`,
      campaign_id: `test-campaign-${Math.floor(Math.random() * 3) + 1}`,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      trusted_form_cert_url: `https://cert.trustedform.com/example${i + 1}`,
      policy_status: policyStatuses[randomPolicyIndex],
      custom_fields: { subid: `mock-subid-${i + 1}` }
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching leads list with Supabase...');
    const supabase = createServerClient();
    
    // Get query parameters for filtering
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const search = url.searchParams.get('search') || '';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const status = url.searchParams.get('status');
    
    // Calculate pagination values
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // Start building the query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Apply filters if provided
    if (search) {
      // If the search term looks like a UUID, search for exact match on ID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
      
      if (isUuid) {
        // Search by exact lead ID
        query = query.eq('id', search);
      } else {
        // Search by other fields
        query = query.or(
          `first_name.ilike.%${search}%,` +
          `last_name.ilike.%${search}%,` +
          `email.ilike.%${search}%,` +
          `phone.ilike.%${search}%`
        );
      }
    }
    
    if (startDate && endDate) {
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Apply pagination
    query = query.range(from, to);
    
    // Execute the query
    const { data: leads, error, count } = await query;
      
    if (error) {
      console.error('Error fetching from leads table:', error);
      console.log('Falling back to mock leads data');
      return NextResponse.json({
        success: false,
        error: error.message,
        data: getMockLeads(pageSize)
      });
    }
    
    // Process leads to ensure custom_fields is properly JSON parsed
    const processedLeads = leads.map(lead => ({
      ...lead,
      custom_fields: lead.custom_fields ? 
        (typeof lead.custom_fields === 'string' ? 
          JSON.parse(lead.custom_fields) : lead.custom_fields) : 
        null
    }));
    
    console.log(`Successfully fetched ${leads?.length || 0} leads (total: ${count || 'unknown'})`);
    // Return in a format that's compatible with the home page expectations
    return NextResponse.json({
      success: true,
      data: processedLeads || [],
      leads: processedLeads || [], // For backward compatibility
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: count ? Math.ceil(count / pageSize) : 0
      }
    });
  } catch (error: any) {
    console.error('Error in leads API:', error);
    // Return error with mock data to maintain UI functionality
    return NextResponse.json({
      success: false, 
      error: error.message,
      data: getMockLeads(10)
    }, { status: 500 });
  }
}
