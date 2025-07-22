import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Generate mock lead data as a fallback (kept for backward compatibility)
function getMockLeads(count = 10) {
  return Array.from({ length: count }, (_, i) => {
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

/**
 * Enterprise-grade unified leads API with consistent EST timezone handling
 * 
 * Key improvements:
 * - Pure SQL implementation (no JavaScript filtering)
 * - Consistent EST timezone throughout
 * - Mathematically guaranteed: weekday_count + weekend_count = total_count
 * - Optimized performance with proper indexing
 * - Unified architecture for all lead counting operations
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Unified leads API with EST timezone consistency');
    const supabase = createServerClient();
    
    // Extract and validate query parameters
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')));
    const search = url.searchParams.get('search') || null;
    const startDate = url.searchParams.get('startDate') || null;
    const endDate = url.searchParams.get('endDate') || null;
    const status = url.searchParams.get('status') || null;
    const listId = url.searchParams.get('list_id') || null;
    const policyStatus = url.searchParams.get('policy_status') || null;
    const weekendOnly = url.searchParams.get('weekend_only') === 'true';
    const usePostbackDate = url.searchParams.get('use_postback_date') === 'true';
    const transferStatus = url.searchParams.get('transfer_status') === 'true' ? true : 
                          url.searchParams.get('transfer_status') === 'false' ? false : null;

    console.log(`📊 Query parameters: listId=${listId}, dateRange=${startDate}-${endDate}, weekendOnly=${weekendOnly}, usePostbackDate=${usePostbackDate}`);

    // Validate date parameters
    let parsedStartDate = null;
    let parsedEndDate = null;
    
    if (startDate && endDate) {
      try {
        parsedStartDate = new Date(startDate + 'T00:00:00-05:00');
        parsedEndDate = new Date(endDate + 'T23:59:59-05:00');
        
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
          throw new Error('Invalid date format');
        }
        
        if (parsedStartDate > parsedEndDate) {
          throw new Error('Start date must be before end date');
        }
      } catch (error) {
        console.error('Date validation error:', error);
        return NextResponse.json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format.',
          data: []
        }, { status: 400 });
      }
    }

    // Call the unified SQL function with consistent EST timezone handling
    const { data: results, error } = await supabase.rpc('get_lead_counts_unified', {
      p_list_id: listId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_use_postback_date: usePostbackDate,
      p_policy_status: policyStatus,
      p_transfer_status: transferStatus,
      p_status: status,
      p_search: search,
      p_weekend_only: weekendOnly,
      p_page: page,
      p_page_size: pageSize
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        data: getMockLeads(pageSize)
      }, { status: 500 });
    }

    if (!results || results.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        leads: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        },
        metadata: {
          totalCount: 0,
          weekendCount: 0,
          weekdayCount: 0,
          timezone: 'America/New_York (EST)',
          dateField: usePostbackDate ? 'policy_postback_date' : 'created_at'
        }
      });
    }

    const result = results[0];
    const leadsData = result.leads_data || [];
    const pagination = result.pagination || {};

    // Process leads to ensure custom_fields is properly JSON parsed
    const processedLeads = Array.isArray(leadsData) ? leadsData.map(lead => ({
      ...lead,
      custom_fields: lead.custom_fields ? 
        (typeof lead.custom_fields === 'string' ? 
          JSON.parse(lead.custom_fields) : lead.custom_fields) : 
        null
    })) : [];

    // Build comprehensive response
    const response = {
      success: true,
      data: processedLeads,
      leads: processedLeads, // Backward compatibility
      pagination: {
        page: parseInt(pagination.page) || page,
        pageSize: parseInt(pagination.pageSize) || pageSize,
        total: parseInt(pagination.total) || 0,
        totalPages: parseInt(pagination.totalPages) || 0
      },
      metadata: {
        totalCount: parseInt(result.total_count) || 0,
        weekendCount: parseInt(result.weekend_count) || 0,
        weekdayCount: parseInt(result.weekday_count) || 0,
        timezone: 'America/New_York (EST)',
        dateField: usePostbackDate ? 'policy_postback_date' : 'created_at',
        mathematicalConsistency: (parseInt(result.weekday_count) + parseInt(result.weekend_count)) === parseInt(result.total_count),
        queryPerformance: 'Optimized SQL with EST timezone indexes'
      }
    };

    console.log(`✅ Query successful: ${response.metadata.totalCount} total, ${response.metadata.weekendCount} weekend, ${response.metadata.weekdayCount} weekday (consistent: ${response.metadata.mathematicalConsistency})`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('🚨 Unified API error:', error);
    
    // Return structured error with fallback data
    return NextResponse.json({
      success: false, 
      error: error.message || 'Internal server error',
      data: getMockLeads(10),
      metadata: {
        fallbackMode: true,
        originalError: error.message
      }
    }, { status: 500 });
  }
}
