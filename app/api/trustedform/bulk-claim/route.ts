import { NextRequest, NextResponse } from 'next/server';
import { TrustedFormService } from '@/lib/services/trusted-form';

export const dynamic = 'force-dynamic';

interface BulkClaimResult {
  row: number;
  certificateUrl: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  success: boolean;
  error?: string;
  status?: number;
  claimedAt?: string;
}

interface BulkClaimSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  processingTimeSeconds: number;
  failureReasons: Record<string, number>;
}

// Process records with controlled concurrency and retry logic to avoid timeouts
async function processWithConcurrencyControl<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  concurrency: number = 3 // Conservative concurrency for TrustedForm API
): Promise<R[]> {
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / 50); // Process in small chunks
  
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const chunkNumber = Math.floor(i / 50) + 1;
    
    console.log(`Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} records) - ${results.length}/${items.length} completed`);
    
    // Process chunk with controlled concurrency
    const chunkResults = await processChunkWithConcurrency(chunk, processor, concurrency);
    results.push(...chunkResults);
    
    // Pause between chunks to prevent API overload
    if (i + 50 < items.length) {
      console.log(`Pausing 1s before next chunk to prevent TrustedForm API overload...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Process a chunk with controlled concurrency
async function processChunkWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });
    
    executing.push(promise);
    
    // If we've reached the concurrency limit, wait for one to complete
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        if (await Promise.allSettled([executing[i]]).then((r: PromiseSettledResult<void>[]) => r[0].status === 'fulfilled')) {
          executing.splice(i, 1);
        }
      }
    }
    
    // Delay between individual requests to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms between requests for faster processing
  }
  
  // Wait for all remaining promises to complete
  await Promise.all(executing);
  
  return results;
}

// Failsafe version that stops after consecutive failures
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
      // Simple cleanup: remove one promise since at least one completed
      executing.shift();
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

// Retry wrapper for TrustedForm API calls
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 1000): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        console.error(`TrustedForm API call failed after ${maxRetries} retries:`, error);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`TrustedForm API attempt ${attempt} failed, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

async function processCertificateClaim(record: any, rowIndex: number): Promise<BulkClaimResult> {
  const result: BulkClaimResult = {
    row: rowIndex,
    certificateUrl: record.certificate_url || record.certificateUrl || record.Certificate_URL || record.trustedform_url || record.TrustedForm || '',
    phone: record.phone || record.Phone || record.phone_number || record.PhoneNumber || record.match_lead || '',
    email: record.email || record.Email || record.EmailAddress || '',
    firstName: record.first_name || record.firstName || record.FirstName || '',
    lastName: record.last_name || record.lastName || record.LastName || '',
    success: false
  };

  try {
    // Validate required fields
    if (!result.certificateUrl) {
      result.error = 'Missing certificate URL';
      return result;
    }

    // Attempt to claim the TrustedForm certificate with retry logic
    const claimResult = await withRetry(async () => {
      return await TrustedFormService.retainCertificate(
        result.certificateUrl,
        {
          email: result.email,
          phone: result.phone,
          firstName: result.firstName,
          lastName: result.lastName,
        },
        {
          reference: 'bulk-claim-csv',
          vendor: 'compliance-system-bulk'
        }
      );
    }, 3, 1000);

    if (claimResult.success) {
      result.success = true;
      result.status = claimResult.status;
      result.claimedAt = new Date().toISOString();
    } else {
      result.error = claimResult.error || 'Certificate claim failed';
      result.status = claimResult.status;
    }

  } catch (error) {
    console.error(`Error claiming certificate for row ${rowIndex}:`, error);
    result.error = error instanceof Error ? error.message : 'Unknown error during certificate claim';
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData } = body;

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CSV data. Expected an array of records.' },
        { status: 400 }
      );
    }

    console.log(`Starting bulk TrustedForm certificate claiming for ${csvData.length} records...`);
    const startTime = Date.now();

    // Process certificates with controlled concurrency and early termination on repeated failures
    const concurrency = csvData.length > 10000 ? 5 : csvData.length > 1000 ? 8 : 3; // Higher concurrency for large batches
    
    console.log(`Processing ${csvData.length} certificates with concurrency=${concurrency}`);
    const results = await processWithConcurrencyControlAndFailsafe(
      csvData.map((record, index) => ({ record, index: index + 1 })),
      async ({ record, index }) => await processCertificateClaim(record, index),
      concurrency
    );

    const endTime = Date.now();
    const processingTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);

    // Generate summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const summary: BulkClaimSummary = {
      totalProcessed: results.length,
      successful: successful.length,
      failed: failed.length,
      processingTimeSeconds: parseFloat(processingTimeSeconds),
      failureReasons: {}
    };

    // Count failure reasons
    failed.forEach((result: BulkClaimResult) => {
      const reason = result.error || 'Unknown error';
      if (!summary.failureReasons[reason]) {
        summary.failureReasons[reason] = 0;
      }
      summary.failureReasons[reason]++;
    });

    console.log(`Bulk TrustedForm claiming completed in ${processingTimeSeconds}s - ${successful.length} successful, ${failed.length} failed`);

    console.log('Sending API response to frontend...');
    const response = {
      success: true,
      summary,
      successfulClaims: successful,
      failedClaims: failed.map((r: BulkClaimResult) => ({
        row: r.row,
        certificateUrl: r.certificateUrl,
        phone: r.phone,
        email: r.email,
        error: r.error,
        status: r.status
      })),
      processingTime: `${processingTimeSeconds} seconds`
    };
    
    console.log('Response object created, returning to frontend');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Bulk TrustedForm claiming error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process bulk TrustedForm claiming: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
