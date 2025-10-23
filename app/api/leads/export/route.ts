import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ExportParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  listId?: string;
  format?: 'csv' | 'json';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const url = new URL(request.url);
    
    // Extract query parameters
    const params: ExportParams = {
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      status: url.searchParams.get('status') || 'success', // Default to accepted leads
      listId: url.searchParams.get('listId') || undefined,
      format: (url.searchParams.get('format') as 'csv' | 'json') || 'csv'
    };

    console.log('📊 Lead Export Request:', params);

    // Build the query - select only basic columns that should exist
    let query = supabase
      .from('leads')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        zip_code,
        trusted_form_cert_url,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params.listId) {
      query = query.eq('list_id', params.listId);
    }

    if (params.startDate) {
      query = query.gte('created_at', params.startDate);
    }

    if (params.endDate) {
      // Add 23:59:59 to end date to include the entire day
      const endDateTime = new Date(params.endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateTime.toISOString());
    }

    // Execute query
    const { data: leads, error } = await query;

    if (error) {
      console.error('❌ Export query error:', error);
      return NextResponse.json({ error: 'Failed to fetch leads', details: error.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      console.log('📝 No leads found for export criteria');
      return NextResponse.json({ 
        message: 'No leads found for the specified criteria',
        count: 0,
        filters: params
      }, { status: 200 });
    }

    console.log(`✅ Found ${leads.length} leads for export`);

    // Return JSON format if requested
    if (params.format === 'json') {
      return NextResponse.json({
        leads,
        count: leads.length,
        filters: params,
        exportedAt: new Date().toISOString()
      });
    }

    // Generate CSV
    const csvData = convertToCSV(leads);
    const filename = generateFilename(params);

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Total-Count': leads.length.toString(),
        'X-Export-Filters': JSON.stringify(params)
      },
    });

  } catch (error) {
    console.error('❌ Unexpected export error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during export', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function convertToCSV(leads: any[]): string {
  if (leads.length === 0) return '';

  // Define CSV headers in a logical order
  const headers = [
    'id',
    'created_at',
    'status',
    'first_name',
    'last_name',
    'email',
    'phone',
    'address',
    'city',
    'state',
    'zip_code',
    'age',
    'gender',
    'income_bracket',
    'homeowner_status',
    'age_range',
    'list_id',
    'campaign_id',
    'cadence_id',
    'dialer_type',
    'bid',
    'policy_status',
    'policy_updated_at',
    'trusted_form_cert_url',
    'ip_address',
    'user_agent',
    'landing_page_url',
    'updated_at'
  ];

  // Create CSV content
  let csvContent = headers.join(',') + '\n';

  leads.forEach(lead => {
    const row = headers.map(header => {
      let value = lead[header];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return '';
      }
      
      // Handle objects (like custom_fields)
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // Convert to string and escape quotes
      value = String(value);
      
      // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      
      return value;
    });
    
    csvContent += row.join(',') + '\n';
  });

  return csvContent;
}

function generateFilename(params: ExportParams): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  let filename = `leads_export_${timestamp}`;

  if (params.status && params.status !== 'success') {
    filename += `_${params.status}`;
  }

  if (params.listId) {
    filename += `_${params.listId.substring(0, 8)}`;
  }

  if (params.startDate && params.endDate) {
    filename += `_${params.startDate}_to_${params.endDate}`;
  } else if (params.startDate) {
    filename += `_from_${params.startDate}`;
  } else if (params.endDate) {
    filename += `_until_${params.endDate}`;
  }

  return `${filename}.csv`;
}

// POST endpoint for bulk export with more complex filters
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      dateRange, 
      listIds = [], 
      statuses = ['success'], 
      includeFields = [], 
      format = 'csv',
      publisherName = ''
    } = body;

    console.log('📊 Bulk Lead Export Request:', { dateRange, listIds, statuses, format });

    const supabase = createServerClient();
    
    // Build query with multiple filters
    let query = supabase.from('leads').select('*');

    // Date range filter
    if (dateRange?.startDate) {
      query = query.gte('created_at', dateRange.startDate);
    }
    if (dateRange?.endDate) {
      const endDateTime = new Date(dateRange.endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateTime.toISOString());
    }

    // Status filter
    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }

    // List IDs filter
    if (listIds.length > 0) {
      query = query.in('list_id', listIds);
    }

    query = query.order('created_at', { ascending: false });

    const { data: leads, error } = await query;

    if (error) {
      console.error('❌ Bulk export error:', error);
      return NextResponse.json({ error: 'Failed to fetch leads', details: error.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ 
        message: 'No leads found for the specified criteria',
        count: 0,
        filters: body
      }, { status: 200 });
    }

    // Filter fields if specified
    let filteredLeads = leads;
    if (includeFields.length > 0) {
      filteredLeads = leads.map(lead => {
        const filtered: any = {};
        includeFields.forEach((field: string) => {
          if (lead[field] !== undefined) {
            filtered[field] = lead[field];
          }
        });
        return filtered;
      });
    }

    if (format === 'json') {
      return NextResponse.json({
        leads: filteredLeads,
        count: filteredLeads.length,
        filters: body,
        exportedAt: new Date().toISOString()
      });
    }

    // Generate CSV with custom filename
    const csvData = convertToCSV(filteredLeads);
    let filename = `leads_export_${new Date().toISOString().split('T')[0]}`;
    
    if (publisherName) {
      filename = `${publisherName}_leads_${new Date().toISOString().split('T')[0]}`;
    }
    
    if (dateRange?.startDate && dateRange?.endDate) {
      filename += `_${dateRange.startDate}_to_${dateRange.endDate}`;
    }
    
    filename += '.csv';

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Total-Count': filteredLeads.length.toString()
      },
    });

  } catch (error) {
    console.error('❌ Bulk export error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during bulk export', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
