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
    
    // Fetch all records using pagination to avoid Supabase limits
    let allClaims: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`[TF History] Fetching batch from ${from} to ${from + batchSize - 1}`);
      
      let query = supabase
        .from('trusted_form_certificates')
        .select('*')
        .ilike('metadata->>reference', 'bulk_claim_%')
        .order('created_at', { ascending: false })
        .range(from, from + batchSize - 1);
      
      // Apply date filter if provided
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      
      const { data: batchData, error: queryError } = await query;
      
      if (queryError) {
        console.error('[TF History] Query error:', queryError);
        throw new Error(`Database query failed: ${queryError.message}`);
      }
      
      if (batchData && batchData.length > 0) {
        allClaims = allClaims.concat(batchData);
        from += batchSize;
        hasMore = batchData.length === batchSize; // Continue if we got a full batch
      } else {
        hasMore = false;
      }
      
      // Safety check to prevent infinite loops
      if (allClaims.length > 100000) {
        console.log('[TF History] Safety limit reached - stopping at 100k records');
        break;
      }
    }
    
    const trustedFormClaims = allClaims;
    
    const claims = trustedFormClaims || [];
    console.log(`[TF History] Found ${claims.length} historical claims`);
    
    // Deduplicate by certificate_url - keep the latest occurrence of each certificate
    const uniqueClaims = new Map<string, any>();
    claims.forEach(claim => {
      const certUrl = claim.certificate_url;
      if (!uniqueClaims.has(certUrl) || 
          new Date(claim.created_at) > new Date(uniqueClaims.get(certUrl).created_at)) {
        uniqueClaims.set(certUrl, claim);
      }
    });
    
    const deduplicatedClaims = Array.from(uniqueClaims.values());
    console.log(`[TF History] After deduplication: ${deduplicatedClaims.length} unique certificates (removed ${claims.length - deduplicatedClaims.length} duplicates)`);
    
    // Transform to match BulkClaimResult format
    const results = deduplicatedClaims.map((claim: any, index: number) => {
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
    const successfulCount = results.filter((r: any) => r.success).length;
    const failedCount = results.filter((r: any) => !r.success).length;
    const summary = {
      totalProcessed: results.length,
      successful: successfulCount,
      failed: failedCount,
      originalTotal: claims.length,
      duplicatesRemoved: claims.length - deduplicatedClaims.length,
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
