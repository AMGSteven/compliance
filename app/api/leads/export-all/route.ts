import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get total count first
    const { count: totalCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Starting export of ${totalCount || 0} leads...`);
    
    // Create CSV headers
    const headers = [
      'id',
      'first_name',
      'last_name',
      'email',
      'phone',
      'zip_code',
      'state',
      'city',
      'address',
      'status',
      'created_at',
      'list_id',
      'campaign_id',
      'traffic_source',
      'source',
      'vertical',
      'sub_id'
    ];
    
    // Start CSV response with streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Write headers
          controller.enqueue(encoder.encode(headers.join(',') + '\n'));
          
          let lastId = '';
          let exportedCount = 0;
          const batchSize = 5000;
          
          while (true) {
            // Query leads with cursor-based pagination (no JOIN for performance)
            let query = supabase
              .from('leads')
              .select(`
                id,
                first_name,
                last_name,
                email,
                phone,
                zip_code,
                state,
                city,
                address,
                status,
                created_at,
                list_id,
                campaign_id,
                traffic_source,
                source,
                vertical,
                sub_id
              `)
              .order('id', { ascending: true })
              .limit(batchSize);
            
            if (lastId) {
              query = query.gt('id', lastId);
            }
            
            const { data: leads, error } = await query;
            
            if (error) {
              console.error('Error fetching leads:', error);
              throw error;
            }
            
            if (!leads || leads.length === 0) {
              break;
            }
            
            // Process and write batch
            for (const lead of leads as any) {
              const row = [
                lead.id || '',
                escapeCSV(lead.first_name || ''),
                escapeCSV(lead.last_name || ''),
                escapeCSV(lead.email || ''),
                escapeCSV(lead.phone || ''),
                escapeCSV(lead.zip_code || ''),
                escapeCSV(lead.state || ''),
                escapeCSV(lead.city || ''),
                escapeCSV(lead.address || ''),
                escapeCSV(lead.status || ''),
                lead.created_at || '',
                escapeCSV(lead.list_id || ''),
                escapeCSV(lead.campaign_id || ''),
                escapeCSV(lead.traffic_source || ''),
                escapeCSV(lead.source || ''),
                escapeCSV(lead.vertical || ''),
                escapeCSV(lead.sub_id || '')
              ];
              
              controller.enqueue(encoder.encode(row.join(',') + '\n'));
              exportedCount++;
              lastId = lead.id;
            }
            
            console.log(`Exported ${exportedCount}/${totalCount || 0} leads...`);
            
            // If we got fewer than batchSize, we're done
            if (leads.length < batchSize) {
              break;
            }
          }
          
          console.log(`Export complete: ${exportedCount} leads exported`);
          controller.close();
          
        } catch (error) {
          console.error('Error during export:', error);
          controller.error(error);
        }
      }
    });
    
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('Error in export endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to export leads', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function escapeCSV(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
