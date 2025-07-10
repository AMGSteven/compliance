import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    console.log('Getting accurate lead counts using SQL function...');
    
    // Call the SQL function that does aggregation in the database
    const { data, error } = await supabase.rpc('get_lead_counts_by_list_id');
    
    if (error) {
      console.error('Function call failed:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        note: "You need to create the SQL function first. Run the SQL in create_lead_count_function.sql in your Supabase dashboard."
      });
    }
    
    const totalLeads = data.reduce((sum: number, row: any) => sum + parseInt(row.lead_count), 0);
    
    return NextResponse.json({
      success: true,
      total_leads: totalLeads,
      unique_list_ids: data.length,
      counts_by_list_id: data.map((row: any) => ({
        list_id: row.list_id,
        count: parseInt(row.lead_count)
      }))
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}
