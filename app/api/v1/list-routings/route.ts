import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching list routings...');
    const supabase = createServerClient();
    
    const { data: listRoutings, error: routingsError } = await supabase
      .from('list_routings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (routingsError) {
      console.error('Error fetching list routings:', routingsError);
      return NextResponse.json({
        success: false,
        error: routingsError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: listRoutings
    });
  } catch (error: any) {
    console.error('Error in list routings API:', error);
    return NextResponse.json({
      success: false, 
      error: error.message
    }, { status: 500 });
  }
}
