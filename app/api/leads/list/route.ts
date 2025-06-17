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
    const list_id = url.searchParams.get('list_id'); // Add list_id filter for efficient revenue tracking
    const policy_status = url.searchParams.get('policy_status'); // Add policy_status filter for synergy payout tracking
    const weekend_only = url.searchParams.get('weekend_only') === 'true'; // Add weekend_only filter for exact weekend counts
    
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
      // Convert date strings to full day ranges in EST timezone
      // startDate: beginning of day in EST (e.g., 2025-06-16 00:00:00 EST)
      // endDate: end of day in EST (e.g., 2025-06-16 23:59:59 EST)
      
      // Create start timestamp: YYYY-MM-DD 00:00:00 EST
      const startTimestamp = `${startDate}T00:00:00-05:00`; // EST is UTC-5 (or UTC-4 during DST)
      
      // Create end timestamp: YYYY-MM-DD 23:59:59 EST  
      const endTimestamp = `${endDate}T23:59:59-05:00`;
      
      console.log(`Date filtering: ${startTimestamp} to ${endTimestamp}`);
      
      query = query.gte('created_at', startTimestamp).lte('created_at', endTimestamp);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (list_id) {
      query = query.eq('list_id', list_id);
    }
    
    if (policy_status) {
      query = query.eq('policy_status', policy_status);
    }
    
    if (weekend_only) {
      // For weekend_only requests, we need to filter leads by day of week
      // Since Supabase doesn't easily support complex date functions in filters,
      // we'll fetch leads and filter them in the application
      
      // Create a separate query to get ALL matching leads
      // Don't use pagination limits - we need ALL matching leads for accurate weekend count
      let weekendQuery = supabase
        .from('leads')
        .select('created_at, id', { count: 'exact' }) // Only select what we need for efficiency
        .order('created_at', { ascending: false });
      
      // Apply the SAME filters as the main query (except pagination)
      if (search) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
        
        if (isUuid) {
          weekendQuery = weekendQuery.eq('id', search);
        } else {
          weekendQuery = weekendQuery.or(
            `first_name.ilike.%${search}%,` +
            `last_name.ilike.%${search}%,` +
            `email.ilike.%${search}%,` +
            `phone.ilike.%${search}%`
          );
        }
      }
      
      if (startDate && endDate) {
        const startTimestamp = `${startDate}T00:00:00-05:00`;
        const endTimestamp = `${endDate}T23:59:59-05:00`;
        console.log(`Weekend detection - Date filtering: ${startTimestamp} to ${endTimestamp}`);
        weekendQuery = weekendQuery.gte('created_at', startTimestamp).lte('created_at', endTimestamp);
      }
      
      if (status) {
        weekendQuery = weekendQuery.eq('status', status);
      }
      
      if (list_id) {
        weekendQuery = weekendQuery.eq('list_id', list_id);
      }
      
      if (policy_status) {
        weekendQuery = weekendQuery.eq('policy_status', policy_status);
      }
      
      // Fetch all pages of results
      const allResults = [];
      let offset = 0;
      while (true) {
        const { data, error } = await weekendQuery.range(offset, offset + 999);
        if (error) {
          console.error('Error fetching leads for weekend filtering:', error);
          return NextResponse.json({
            success: false,
            error: error.message,
            data: []
          });
        }
        allResults.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
      }
      
      // Filter leads to only weekends (Saturday = 6, Sunday = 0)
      const weekendLeads = allResults.filter(lead => {
        // Use timezone-aware date parsing to ensure consistent day-of-week calculation
        const leadDate = new Date(lead.created_at);
        // Get day of week in UTC to avoid timezone issues
        const dayOfWeek = leadDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      });
      
      console.log(`Weekend filtering for list_id=${list_id}, startDate=${startDate}, endDate=${endDate}: Found ${weekendLeads.length} weekend leads out of ${allResults.length} total leads`);
      
      // For weekend_only requests, we typically only need the count
      // Return the weekend leads but slice to pageSize for consistency
      const paginatedWeekendLeads = weekendLeads.slice(from, from + pageSize);
      
      return NextResponse.json({
        success: true,
        data: paginatedWeekendLeads,
        leads: paginatedWeekendLeads,
        pagination: {
          page,
          pageSize,
          total: weekendLeads.length, // This is the key - the total count of weekend leads
          totalPages: Math.ceil(weekendLeads.length / pageSize)
        }
      });
    }
    
    // Fetch all pages of results
    const allResults = [];
    let offset = 0;
    while (true) {
      const { data, error, count } = await query.range(offset, offset + 999);
      if (error) {
        console.error('Error fetching from leads table:', error);
        console.log('Falling back to mock leads data');
        return NextResponse.json({
          success: false,
          error: error.message,
          data: getMockLeads(pageSize)
        });
      }
      allResults.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }
    
    // Process leads to ensure custom_fields is properly JSON parsed
    const processedLeads = allResults.map(lead => ({
      ...lead,
      custom_fields: lead.custom_fields ? 
        (typeof lead.custom_fields === 'string' ? 
          JSON.parse(lead.custom_fields) : lead.custom_fields) : 
        null
    }));
    
    console.log(`Successfully fetched ${processedLeads.length} leads (total: ${processedLeads.length})`);
    // Return in a format that's compatible with the home page expectations
    return NextResponse.json({
      success: true,
      data: processedLeads.slice(from, from + pageSize),
      leads: processedLeads.slice(from, from + pageSize), // For backward compatibility
      pagination: {
        page,
        pageSize,
        total: processedLeads.length,
        totalPages: Math.ceil(processedLeads.length / pageSize)
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
