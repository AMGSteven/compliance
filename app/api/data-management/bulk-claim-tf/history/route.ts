import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    
    console.log('[TF History] Fetching historical TrustedForm claim results...');
    console.log('[TF History] Date filter:', dateFilter);
    
    // Get Supabase client
    const supabase = createServerClient();
    
    // Build query
    let query = supabase
      .from('trusted_form_certificates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);
    
    // Apply date filter if provided
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Execute query
    const { data: trustedFormClaims, error: queryError } = await query;
    
    if (queryError) {
      console.error('[TF History] Query error:', queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }
    
    const claims = trustedFormClaims || [];
    console.log(`[TF History] Found ${claims.length} historical claims`);
    
    // Transform to match BulkClaimResult format
    const results = claims.map((claim: any, index: number) => {
      const isSuccess = claim.status === 'verified' && claim.metadata?.outcome === 'success';
      const leadData = claim.metadata?.lead_data || {};
      const retainData = claim.metadata?.retain || {};
      const error = claim.metadata?.reason || (isSuccess ? '' : 'Verification failed');
      
      return {
        row: index + 1,
        certificateUrl: claim.certificate_url || '',
        success: isSuccess,
        error: error || undefined,
        claimedAt: claim.verified_at || claim.created_at,
        originalData: {
          certificate_url: claim.certificate_url || '',
          email: leadData.email || '',
          phone: leadData.phone || '',
          first_name: leadData.firstName || '',
          last_name: leadData.lastName || '',
          success: isSuccess ? 'Yes' : 'No',
          error: error || '',
          claimed_at: claim.verified_at || claim.created_at || '',
          status: claim.status || '',
          expires_at: retainData.results?.expires_at || ''
        }
      };
    });
    
    // Calculate summary statistics
    const summary = {
      totalProcessed: results.length,
      successful: results.filter((r: any) => r.success).length,
      failed: results.filter((r: any) => !r.success).length,
      dateRange: {
        start: startDate || 'all-time',
        end: endDate || 'now'
      }
    };
    
    console.log('[TF History] Summary:', summary);
    
    return NextResponse.json({
      success: true,
      results,
      summary
    });
    
  } catch (error) {
    console.error('[TF History] Error fetching historical results:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch historical results',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
