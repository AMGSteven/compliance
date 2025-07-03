import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface LeadExportResult {
  id: string;
  list_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  zip_code: string;
  trusted_form_cert_url: string;
  status: string;
  campaign_id?: string;
  traffic_source?: string;
  age_range?: string;
  income_bracket?: string;
  homeowner_status?: string;
  created_at: Date;
  updated_at: Date;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listIds, format = 'csv' } = body;

    if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Please provide at least one list ID'
      }, { status: 400 });
    }

    // Clean and validate list IDs
    const cleanListIds = listIds
      .map((id: any) => String(id).trim())
      .filter(id => id.length > 0);

    if (cleanListIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Please provide valid list IDs'
      }, { status: 400 });
    }

    console.log(`Exporting leads for list IDs: ${cleanListIds.join(', ')}`);
    
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      console.log('Querying leads from Supabase...');
      
      // Fetch ALL leads by paginating (Supabase has max 1000 limit even with .limit())
      const allLeads = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`Fetching batch starting from ${from}...`);
        
        const { data: batchLeads, error } = await supabase
          .from('leads')
          .select('id, list_id, first_name, last_name, email, phone, zip_code, trusted_form_cert_url, status, campaign_id, traffic_source, age_range, income_bracket, homeowner_status, created_at, updated_at')
          .in('list_id', cleanListIds)
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);
          
        if (error) {
          console.error('Supabase query error:', error);
          throw new Error(`Database query failed: ${error.message}`);
        }
        
        if (batchLeads && batchLeads.length > 0) {
          allLeads.push(...batchLeads);
          console.log(`Got ${batchLeads.length} leads, total so far: ${allLeads.length}`);
          
          // Continue if we got a full batch
          hasMore = batchLeads.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }
      
      const leads = allLeads;
      console.log(`Finished fetching all leads. Total: ${leads.length}`);
      
      if (!leads || leads.length === 0) {
        console.log('No leads found for the specified list IDs');
        return NextResponse.json({
          success: false,
          error: `No leads found for the specified list IDs: ${cleanListIds.join(', ')}`
        }, { status: 404 });
      }
      
      console.log(`Found ${leads.length} leads for the specified list IDs`);

      if (false) {
        return NextResponse.json({
          success: false,
          error: `No leads found for the specified list IDs: ${cleanListIds.join(', ')}`
        }, { status: 404 });
      }

      // Group leads by list_id for summary
      const leadsByListId: Record<string, number> = {};
      leads.forEach(lead => {
        const listId = lead.list_id || 'unknown';
        leadsByListId[listId] = (leadsByListId[listId] || 0) + 1;
      });

      if (format === 'json') {
        return NextResponse.json({
          success: true,
          totalLeads: leads.length,
          leadsByListId,
          leads: leads.map(lead => ({
            ...lead,
            created_at: lead.created_at.toISOString(),
            updated_at: lead.updated_at.toISOString()
          }))
        });
      }

      // Generate CSV content
      const csvHeaders = [
        'ID',
        'List ID',
        'First Name', 
        'Last Name',
        'Email',
        'Phone',
        'Zip Code',
        'TrustedForm URL',
        'Status',
        'Campaign ID',
        'Traffic Source',
        'Age Range',
        'Income Bracket',
        'Homeowner Status',
        'Created At',
        'Updated At'
      ];

      const csvRows = leads.map(lead => [
        lead.id,
        lead.list_id || '',
        lead.first_name || '',
        lead.last_name || '',
        lead.email || '',
        lead.phone || '',
        lead.zip_code || '',
        lead.trusted_form_cert_url || '',
        lead.status || '',
        lead.campaign_id || '',
        lead.traffic_source || '',
        lead.age_range || '',
        lead.income_bracket || '',
        lead.homeowner_status || '',
        lead.created_at || '',
        lead.updated_at || ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => 
          row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      const filename = `leads_export_${cleanListIds.join('_')}_${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Export-Summary': JSON.stringify({
            totalLeads: leads.length,
            leadsByListId,
            exportedAt: new Date().toISOString()
          })
        }
      });

    } catch (exportError) {
      console.error('Export processing error:', exportError);
      throw exportError;
    }

  } catch (error) {
    console.error('Lead export error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to export leads: ' + (error as Error).message
    }, { status: 500 });
  }
}
