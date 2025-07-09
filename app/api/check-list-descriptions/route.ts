import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const targetListIds = [
      'a38881ab-93b2-4750-9f9c-92ae6cd10b7e',
      'lb799935-2a5c-421e-9371-3bde7f865c60'
    ];
    
    console.log('Checking descriptions for list IDs:', targetListIds);
    
    // Get list routing info for these specific list IDs
    const { data: routings, error } = await supabase
      .from('list_routings')
      .select('*')
      .in('list_id', targetListIds);
    
    if (error) {
      console.error('Error fetching list routings:', error);
      return NextResponse.json({ success: false, error: error.message });
    }
    
    return NextResponse.json({
      success: true,
      target_list_ids: targetListIds,
      found_routings: routings,
      count: routings?.length || 0
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}
