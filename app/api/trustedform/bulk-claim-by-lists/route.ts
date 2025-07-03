import { NextRequest, NextResponse } from 'next/server';
import { TrustedFormService } from '@/lib/services/trusted-form';
import { PrismaClient } from '@prisma/client';

interface BulkClaimByListsResult {
  row: number;
  listId: string;
  leadId: string;
  certificateUrl: string;
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  success: boolean;
  error?: string;
  claimStatus?: string;
}

interface BulkClaimByListsResponse {
  success: boolean;
  totalLeads: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  results: BulkClaimByListsResult[];
  processingTime: string;
  error?: string;
}

// Process certificates with controlled concurrency and early termination on repeated failures
async function processWithConcurrencyControlAndFailsafe<T, R extends { success: boolean; error?: string }>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  maxConsecutiveFailures = 10
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  let consecutiveFailures = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const promise = processor(item).then(result => {
      results.push(result);
      
      // Track consecutive failures
      if (!result.success) {
        consecutiveFailures++;
        console.log(`Consecutive failures: ${consecutiveFailures}/${maxConsecutiveFailures}`);
      } else {
        consecutiveFailures = 0; // Reset on success
      }
    });
    
    executing.push(promise);
    
    // If we've reached the concurrency limit, wait for one to complete
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      for (let j = executing.length - 1; j >= 0; j--) {
        if (await Promise.allSettled([executing[j]]).then((r: PromiseSettledResult<void>[]) => r[0].status === 'fulfilled')) {
          executing.splice(j, 1);
        }
      }
    }
    
    // Check if we should stop due to consecutive failures
    if (consecutiveFailures >= maxConsecutiveFailures) {
      console.log(`Stopping bulk claim due to ${maxConsecutiveFailures} consecutive failures. Processed ${i + 1}/${items.length} items.`);
      break;
    }
    
    // Delay between individual requests to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms between requests for faster processing
  }
  
  // Wait for all remaining promises to complete
  await Promise.all(executing);
  
  return results;
}

async function processLeadCertificateClaim(lead: any, rowIndex: number): Promise<BulkClaimByListsResult> {
  const result: BulkClaimByListsResult = {
    row: rowIndex,
    listId: lead.list_id || lead.listId || '',
    leadId: lead.id || lead.lead_id || '',
    certificateUrl: lead.trusted_form_url || lead.trustedform_url || lead.TrustedForm || lead.certificate_url || '',
    phone: lead.phone || lead.Phone || lead.phone_number || lead.PhoneNumber || '',
    email: lead.email || lead.Email || lead.EmailAddress || '',
    firstName: lead.first_name || lead.firstName || lead.FirstName || '',
    lastName: lead.last_name || lead.lastName || lead.LastName || '',
    success: false
  };

  try {
    // Validate required fields
    if (!result.certificateUrl) {
      result.error = 'No TrustedForm certificate URL found';
      return result;
    }

    // Prepare lead data for TrustedForm matching
    const leadData = {
      email: result.email,
      phone: result.phone,
      firstName: result.firstName,
      lastName: result.lastName
    };

    // Call TrustedForm retain API
    const claimResult = await TrustedFormService.retainCertificate(
      result.certificateUrl,
      leadData,
      {
        reference: 'bulk-claim-historical-lists',
        vendor: 'compliance-system-historical'
      }
    );

    result.success = claimResult.success;
    result.claimStatus = claimResult.status?.toString();
    
    if (!claimResult.success) {
      result.error = claimResult.error || 'Unknown error from TrustedForm API';
    }

  } catch (error: any) {
    result.error = `Exception during claim: ${error.message}`;
    console.error(`Error claiming certificate for lead ${result.leadId}:`, error);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listIds } = body;

    if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'listIds array is required'
      }, { status: 400 });
    }

    console.log(`Starting bulk TrustedForm claim for ${listIds.length} list IDs:`, listIds);

    const prisma = new PrismaClient();

    let leads: any[] = [];
    
    try {
      // Query leads table for the specified list IDs with TrustedForm certificates
      leads = await prisma.$queryRaw`
        SELECT id, list_id, phone, email, first_name, last_name, 
               trusted_form_cert_url, created_at
        FROM leads 
        WHERE list_id = ANY(${listIds})
          AND trusted_form_cert_url IS NOT NULL 
          AND trusted_form_cert_url != ''
        ORDER BY created_at ASC
      `;
      
      console.log(`Found ${leads.length} leads with TrustedForm certificates for list IDs:`, listIds);
      
    } catch (dbError: any) {
      console.error('Database query error:', dbError);
      return NextResponse.json({
        success: false,
        error: `Database error: ${dbError.message}`,
        totalLeads: 0,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        processingTime: '0.0s'
      }, { status: 500 });
    }

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        totalLeads: 0,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        processingTime: '0.0s',
        message: 'No leads found with TrustedForm certificates for the specified list IDs'
      });
    }

    const startTime = Date.now();

    // Process certificates with controlled concurrency and early termination on repeated failures
    const concurrency = leads.length > 10000 ? 5 : leads.length > 1000 ? 8 : 3;
    
    console.log(`Processing ${leads.length} historical lead certificates with concurrency=${concurrency}`);
    const results = await processWithConcurrencyControlAndFailsafe(
      leads,
      (lead: any) => processLeadCertificateClaim(lead, leads.indexOf(lead)),
      concurrency,
      10 // Stop after 10 consecutive failures
    );

    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(1);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Bulk TrustedForm claiming completed in ${processingTime}s - ${successCount} successful, ${failureCount} failed`);

    const response: BulkClaimByListsResponse = {
      success: true,
      totalLeads: leads.length,
      processedCount: results.length,
      successCount,
      failureCount,
      results,
      processingTime: `${processingTime}s`
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Bulk TrustedForm claim by lists error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      totalLeads: 0,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      processingTime: '0.0s'
    }, { status: 500 });
  }
}
