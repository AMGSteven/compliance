import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type') || 'certificate'; // certificate, email, phone

    console.log(`[TF Duplicates] Analyzing ${type} duplicates`, { startDate, endDate });

    // Get Supabase client
    const supabase = createServerClient();
    
    let baseQuery = supabase
      .from('trusted_form_certificates')
      .select('*')
      .ilike('metadata->>reference', 'bulk_claim_%');

    // Apply date filter if provided
    if (startDate) {
      baseQuery = baseQuery.gte('created_at', startDate);
    }
    if (endDate) {
      baseQuery = baseQuery.lte('created_at', endDate);
    }

    const { data: allClaims, error } = await baseQuery;

    if (error) {
      console.error('[TF Duplicates] Query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    const claims = allClaims || [];
    console.log(`[TF Duplicates] Analyzing ${claims.length} claims for ${type} duplicates`);

    // Group by the specified field
    const groups = new Map<string, any[]>();
    
    claims.forEach(claim => {
      let key: string;
      
      switch (type) {
        case 'certificate':
          key = claim.certificate_url || '';
          break;
        case 'email':
          key = (claim.metadata?.lead_data?.email || claim.metadata?.email || '').toLowerCase().trim();
          break;
        case 'phone':
          key = (claim.metadata?.lead_data?.phone || claim.metadata?.phone || '').replace(/\D/g, '');
          break;
        default:
          key = claim.certificate_url || '';
      }

      if (key) {
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(claim);
      }
    });

    // Find duplicates
    const duplicates: any[] = [];
    const duplicateGroups: any[] = [];
    let totalExcessClaims = 0;

    groups.forEach((groupClaims, key) => {
      if (groupClaims.length > 1) {
        const excess = groupClaims.length - 1;
        totalExcessClaims += excess;
        
        duplicateGroups.push({
          [type]: key,
          claimCount: groupClaims.length,
          excessClaims: excess,
          firstClaimed: groupClaims.reduce((earliest, claim) => 
            claim.created_at < earliest ? claim.created_at : earliest, 
            groupClaims[0].created_at
          ),
          lastClaimed: groupClaims.reduce((latest, claim) => 
            claim.created_at > latest ? claim.created_at : latest, 
            groupClaims[0].created_at
          ),
          claims: groupClaims.map(claim => ({
            id: claim.id,
            certificateUrl: claim.certificate_url,
            createdAt: claim.created_at,
            reference: claim.metadata?.reference,
            status: claim.status
          }))
        });

        // Add individual duplicate records (excluding the first occurrence)
        groupClaims.slice(1).forEach(claim => {
          duplicates.push({
            id: claim.id,
            certificateUrl: claim.certificate_url,
            [type]: key,
            createdAt: claim.created_at,
            reference: claim.metadata?.reference,
            status: claim.status,
            originalData: {
              email: claim.metadata?.lead_data?.email || claim.metadata?.email,
              phone: claim.metadata?.lead_data?.phone || claim.metadata?.phone,
              firstName: claim.metadata?.lead_data?.firstName || claim.metadata?.first_name,
              lastName: claim.metadata?.lead_data?.lastName || claim.metadata?.last_name
            }
          });
        });
      }
    });

    // Sort by claim count descending
    duplicateGroups.sort((a, b) => b.claimCount - a.claimCount);
    duplicates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
      analysisType: type,
      totalClaims: claims.length,
      uniqueItems: groups.size,
      duplicateItems: duplicateGroups.length,
      totalDuplicates: duplicates.length,
      excessClaims: totalExcessClaims,
      duplicatePercentage: groups.size > 0 ? Number(((duplicateGroups.length / groups.size) * 100).toFixed(2)) : 0,
      dateRange: {
        start: startDate || 'all-time',
        end: endDate || 'now'
      }
    };

    console.log(`[TF Duplicates] Analysis complete:`, summary);

    return NextResponse.json({
      success: true,
      summary,
      duplicateGroups: duplicateGroups.slice(0, 100), // Limit to top 100 for performance
      duplicates: duplicates.slice(0, 1000) // Limit individual duplicates
    });

  } catch (error) {
    console.error('[TF Duplicates] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze duplicates',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
