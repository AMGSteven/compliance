import { NextRequest, NextResponse } from 'next/server';

const IEXECUTE_LIST_ID = 'pitch-bpo-list-1750720674171';
const REVENUE_PER_LEAD = 120; // $120 per policy to match main dashboard

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const timeframe = searchParams.get('timeframe') || 'today';

    // Validate password
    if (password !== 'iexecute1234') {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    }

    console.log(`Fetching iExecute revenue data for timeframe: ${timeframe}`);

    // Use the EXACT same logic as the main revenue tracking dashboard
    // Build URL for /api/leads/list with exact same parameters
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://your-domain.com'; // Update with your production domain
    
    const issuedUrl = new URL('/api/leads/list', baseUrl);
    issuedUrl.searchParams.append('pageSize', '1'); // We only need the pagination total
    issuedUrl.searchParams.append('list_id', IEXECUTE_LIST_ID);
    issuedUrl.searchParams.append('policy_status', 'issued');
    issuedUrl.searchParams.append('use_postback_date', 'true'); // Use postback date for revenue attribution

    // Apply date filtering with EXACT same logic as main dashboard
    let startDate, endDate;
    switch (timeframe) {
      case 'today':
        // Use dayjs logic to match main dashboard exactly
        const today = new Date();
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        break;
      case 'this-week':
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate = weekStart;
        endDate = now;
        break;
      case 'this-month':
        const currentDate = new Date();
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = currentDate;
        break;
      case 'all-time':
        // No date filtering for all time
        break;
      default:
        // Default to today
        const defaultDate = new Date();
        startDate = new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate());
        endDate = new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate() + 1);
    }

    if (startDate && endDate) {
      issuedUrl.searchParams.append('startDate', startDate.toISOString().split('T')[0]);
      issuedUrl.searchParams.append('endDate', endDate.toISOString().split('T')[0]);
    }

    console.log('Calling leads API with URL:', issuedUrl.toString());

    const response = await fetch(issuedUrl.toString(), {
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
    });

    const result = await response.json();

    if (result.success && result.pagination) {
      // Use pagination.total for exact count of issued leads (EXACT same as main dashboard)
      const issuedCount = result.pagination.total;
      const totalRevenue = issuedCount * REVENUE_PER_LEAD;
      
      console.log(`iExecute Revenue: ${issuedCount} issued leads × $${REVENUE_PER_LEAD} = $${totalRevenue}`);

      // Get first and last lead dates from the data if available
      const firstLeadDate = result.data && result.data.length > 0 ? result.data[0].created_at : null;
      const lastLeadDate = result.data && result.data.length > 0 ? result.data[result.data.length - 1].created_at : null;

      return NextResponse.json({
        success: true,
        data: {
          list_id: IEXECUTE_LIST_ID,
          timeframe: timeframe,
          issued_leads_count: issuedCount,
          revenue_per_lead: REVENUE_PER_LEAD,
          total_revenue: totalRevenue,
          first_lead_date: firstLeadDate,
          last_lead_date: lastLeadDate,
          query_method: 'leads_api_call'
        }
      });
    } else {
      console.error('Failed to fetch issued leads:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch issued leads data'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error fetching iExecute revenue data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch revenue data'
    }, { status: 500 });
  }
}
