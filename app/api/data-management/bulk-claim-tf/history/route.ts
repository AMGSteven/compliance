import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    
    // Query TrustedForm claims from database
    const trustedFormClaims = await prisma.trusted_form_certificates.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { 
          created_at: dateFilter 
        })
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10000 // Limit to prevent memory issues
    });
    
    console.log(`[TF History] Found ${trustedFormClaims.length} historical claims`);
    
    // Transform to match BulkClaimResult format
    const results = trustedFormClaims.map((claim: any, index: number) => ({
      row: index + 1,
      certificateUrl: claim.certificate_url || claim.url || '',
      success: claim.status === 'success' || claim.success === true,
      error: claim.error || claim.message || undefined,
      claimedAt: claim.created_at || claim.timestamp,
      originalData: {
        certificate_url: claim.certificate_url || claim.url || '',
        email: claim.email || '',
        phone: claim.phone || '',
        first_name: claim.first_name || '',
        last_name: claim.last_name || '',
        success: (claim.status === 'success' || claim.success === true) ? 'Yes' : 'No',
        error: claim.error || claim.message || '',
        claimed_at: claim.created_at || claim.timestamp || ''
      }
    }));
    
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
