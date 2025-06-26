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

    // Check Internal DNC
    try {
      console.log(`Checking Internal DNC for: ${phone}`);
      const internalDNCResult = await internalDNCChecker.checkNumber(phone);
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

    // Check Synergy DNC
    try {
      console.log(`Checking Synergy DNC for: ${phone}`);
      const synergyDNCResult = await synergyDNCChecker.checkNumber(phone);
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

// Process records in chunks to avoid memory issues
async function processInChunks<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  chunkSize: number = 1000
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(items.length / chunkSize)} (${chunk.length} records)`);
    
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
    
    // Brief pause between chunks to prevent overwhelming the system
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
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

    // Process records in chunks for better performance and memory management
    const results = await processInChunks(records, checkRecordFastCompliance, 1000);

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
    nonCompliantRecords.forEach(result => {
      result.failureReasons.forEach(reason => {
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
      nonCompliantDetails: nonCompliantRecords.map(r => ({
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
