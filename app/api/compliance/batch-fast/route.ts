import { NextRequest, NextResponse } from 'next/server';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker';

export const dynamic = 'force-dynamic';

interface FastComplianceResult {
  record: any;
  isCompliant: boolean;
  failureReasons: string[];
  checks: {
    internalDNC?: boolean;
    synergyDNC?: boolean;
  };
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const record: any = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function recordToCSV(records: any[]): string {
  if (records.length === 0) return '';
  
  const headers = Object.keys(records[0]);
  const csvLines = [headers.join(',')];
  
  records.forEach(record => {
    const values = headers.map(header => {
      const value = record[header] || '';
      return `"${value.toString().replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(','));
  });
  
  return csvLines.join('\n');
}

async function checkRecordFastCompliance(record: any): Promise<FastComplianceResult> {
  const result: FastComplianceResult = {
    record,
    isCompliant: true,
    failureReasons: [],
    checks: {}
  };

  try {
    // Extract phone number from various possible field names
    const phone = record.phone || record.Phone || record.phone_number || record.PhoneNumber || record.primary_phone || record.PrimaryPhone || record.phone_home || '';
    
    if (!phone) {
      result.isCompliant = false;
      result.failureReasons.push('Missing phone number');
      return result;
    }

    // Initialize checkers
    const internalDNCChecker = new InternalDNCChecker();
    const synergyDNCChecker = new SynergyDNCChecker();

    // Check Internal DNC with retry logic
    try {
      console.log(`Checking Internal DNC for: ${phone}`);
      const internalDNCResult = await withRetry(async () => {
        return await internalDNCChecker.checkNumber(phone);
      }, 3, 1000);
      
      result.checks.internalDNC = internalDNCResult.isCompliant;
      
      if (!internalDNCResult.isCompliant) {
        result.isCompliant = false;
        const reasons = internalDNCResult.reasons || ['Found in Internal DNC list'];
        result.failureReasons.push(...reasons);
      }
    } catch (internalDNCError) {
      console.error('Internal DNC check error - FAILING CLOSED:', internalDNCError);
      result.checks.internalDNC = false; // FAIL CLOSED on error
      result.isCompliant = false;
      result.failureReasons.push('Internal DNC check failed - blocked for safety');
    }

    // Check Synergy DNC with retry logic
    try {
      console.log(`Checking Synergy DNC for: ${phone}`);
      const synergyDNCResult = await withRetry(async () => {
        return await synergyDNCChecker.checkNumber(phone);
      }, 3, 1000);
      
      result.checks.synergyDNC = synergyDNCResult.isCompliant;
      
      if (!synergyDNCResult.isCompliant) {
        result.isCompliant = false;
        const reasons = synergyDNCResult.reasons || ['Found in Synergy DNC list'];
        result.failureReasons.push(...reasons);
      }
    } catch (synergyDNCError) {
      console.error('Synergy DNC check error - FAILING CLOSED:', synergyDNCError);
      result.checks.synergyDNC = false; // FAIL CLOSED on error
      result.isCompliant = false;
      result.failureReasons.push('Synergy DNC check failed - blocked for safety');
    }

  } catch (error) {
    console.error('Error checking record compliance:', error);
    result.isCompliant = false;
    result.failureReasons.push('Error during compliance check');
  }

  return result;
}

// Process records with controlled concurrency and retry logic to avoid timeouts
async function processWithConcurrencyControl<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  concurrency: number = 5, // Max 5 parallel requests to avoid overwhelming APIs
  chunkSize: number = 100  // Smaller chunks for better progress tracking
): Promise<R[]> {
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / chunkSize);
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkNumber = Math.floor(i / chunkSize) + 1;
    
    console.log(`Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} records) - ${results.length}/${items.length} completed`);
    
    // Process chunk with controlled concurrency
    const chunkResults = await processChunkWithConcurrency(chunk, processor, concurrency);
    results.push(...chunkResults);
    
    // Longer pause between chunks for large files to prevent API overload
    const pauseDuration = items.length > 10000 ? 2000 : 500; // 2s for large files, 500ms for smaller ones
    if (i + chunkSize < items.length) {
      console.log(`Pausing ${pauseDuration}ms before next chunk to prevent API overload...`);
      await new Promise(resolve => setTimeout(resolve, pauseDuration));
    }
  }
  
  return results;
}

// Process a chunk with controlled concurrency (not all at once)
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
    
    // Small delay between individual requests
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Wait for all remaining promises to complete
  await Promise.all(executing);
  
  return results;
}

// Retry wrapper for API calls with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 1000): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        console.error(`Final attempt failed after ${maxRetries} retries:`, error);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const records = parseCSV(csvText);
    
    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No records found in CSV' },
        { status: 400 }
      );
    }

    console.log(`Starting fast compliance check for ${records.length} records...`);
    const startTime = Date.now();

    // Process records with controlled concurrency to avoid timeouts
    // For large files (50k records), use very conservative settings
    const concurrency = records.length > 25000 ? 3 : 5; // Lower concurrency for large files
    const chunkSize = records.length > 25000 ? 50 : 100; // Smaller chunks for large files
    
    console.log(`Processing ${records.length} records with concurrency=${concurrency}, chunkSize=${chunkSize}`);
    const results = await processWithConcurrencyControl(records, checkRecordFastCompliance, concurrency, chunkSize);

    const endTime = Date.now();
    const processingTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);

    // Separate compliant and non-compliant records
    const compliantRecords = results.filter(r => r.isCompliant).map(r => r.record);
    const nonCompliantRecords = results.filter(r => !r.isCompliant);

    // Generate summary statistics
    const summary = {
      totalRecords: records.length,
      compliantRecords: compliantRecords.length,
      nonCompliantRecords: nonCompliantRecords.length,
      complianceRate: ((compliantRecords.length / records.length) * 100).toFixed(1),
      processingTimeSeconds,
      failureReasons: {} as Record<string, number>
    };

    // Count failure reasons
    nonCompliantRecords.forEach((result: FastComplianceResult) => {
      result.failureReasons.forEach((reason: string) => {
        if (!summary.failureReasons[reason]) {
          summary.failureReasons[reason] = 0;
        }
        summary.failureReasons[reason]++;
      });
    });

    // Generate CSV of compliant records
    const compliantCSV = recordToCSV(compliantRecords);

    console.log(`Fast compliance check completed in ${processingTimeSeconds}s: ${compliantRecords.length}/${records.length} compliant (${summary.complianceRate}%)`);

    const response = {
      success: true,
      summary,
      compliantRecords,
      nonCompliantDetails: nonCompliantRecords.map((r: FastComplianceResult) => ({
        record: r.record,
        failureReasons: r.failureReasons,
        checks: r.checks
      })),
      compliantCSV
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing fast batch compliance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process CSV file' },
      { status: 500 }
    );
  }
}
