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

// Smart column mapping system for CSV headers to database columns
interface ColumnMapping {
  dbColumn: string;
  variations: string[];
  priority: number; // Higher = more specific match
}

const COLUMN_MAPPINGS: ColumnMapping[] = [
  // Core lead information
  { dbColumn: 'first_name', variations: ['first_name', 'firstname', 'first name', 'fname', 'f_name', 'given_name', 'givenname'], priority: 10 },
  { dbColumn: 'last_name', variations: ['last_name', 'lastname', 'last name', 'lname', 'l_name', 'surname', 'family_name', 'familyname'], priority: 10 },
  { dbColumn: 'email', variations: ['email', 'email_address', 'emailaddress', 'e_mail', 'e-mail', 'mail'], priority: 10 },
  { dbColumn: 'phone', variations: ['phone', 'phone_number', 'phonenumber', 'primary_phone', 'mobile', 'cell', 'telephone', 'tel', 'phone_home', 'home_phone'], priority: 10 },
  
  // Address information
  { dbColumn: 'address', variations: ['address', 'street_address', 'streetaddress', 'street', 'addr', 'address1', 'address_1'], priority: 8 },
  { dbColumn: 'city', variations: ['city', 'town', 'municipality'], priority: 8 },
  { dbColumn: 'state', variations: ['state', 'province', 'region', 'st'], priority: 8 },
  { dbColumn: 'zip_code', variations: ['zip', 'zip_code', 'zipcode', 'postal_code', 'postalcode', 'postcode'], priority: 8 },
  
  // Campaign/routing information
  { dbColumn: 'campaign_id', variations: ['campaign_id', 'campaignid', 'campaign', 'camp_id'], priority: 6 },
  { dbColumn: 'cadence_id', variations: ['cadence_id', 'cadenceid', 'cadence', 'sequence_id'], priority: 6 },
  { dbColumn: 'list_id', variations: ['list_id', 'listid', 'list', 'source_list'], priority: 6 },
  
  // Additional lead data
  { dbColumn: 'age_range', variations: ['age_range', 'agerange', 'age', 'age_group'], priority: 4 },
  { dbColumn: 'birth_date', variations: ['birth_date', 'birthdate', 'dob', 'date_of_birth', 'birthday'], priority: 4 },
  { dbColumn: 'homeowner_status', variations: ['homeowner_status', 'homeowner', 'home_owner', 'owns_home'], priority: 4 },
  { dbColumn: 'income_bracket', variations: ['income_bracket', 'income', 'salary', 'annual_income'], priority: 4 },
  { dbColumn: 'trusted_form_cert_url', variations: ['trusted_form_cert_url', 'trustedform', 'cert_url', 'certificate_url'], priority: 4 },
  
  // Source/tracking
  { dbColumn: 'source', variations: ['source', 'traffic_source', 'lead_source', 'origin'], priority: 4 },
  { dbColumn: 'status', variations: ['status', 'lead_status', 'state'], priority: 4 }
];

function smartColumnMapping(headers: string[]): { mappedHeaders: Record<string, string>, mappingReport: string[] } {
  const mappedHeaders: Record<string, string> = {};
  const mappingReport: string[] = [];
  const usedDbColumns = new Set<string>();
  
  // Normalize headers for comparison
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  
  // First pass: exact matches
  headers.forEach((originalHeader, index) => {
    const normalized = normalizedHeaders[index];
    
    for (const mapping of COLUMN_MAPPINGS) {
      if (usedDbColumns.has(mapping.dbColumn)) continue;
      
      const exactMatch = mapping.variations.find(variation => 
        variation.toLowerCase().replace(/[^a-z0-9]/g, '_') === normalized
      );
      
      if (exactMatch) {
        mappedHeaders[originalHeader] = mapping.dbColumn;
        usedDbColumns.add(mapping.dbColumn);
        mappingReport.push(`✅ Exact match: "${originalHeader}" → ${mapping.dbColumn}`);
        break;
      }
    }
  });
  
  // Second pass: partial matches for unmapped headers
  headers.forEach((originalHeader, index) => {
    if (mappedHeaders[originalHeader]) return; // Already mapped
    
    const normalized = normalizedHeaders[index];
    let bestMatch: { mapping: ColumnMapping, score: number } | null = null;
    
    for (const mapping of COLUMN_MAPPINGS) {
      if (usedDbColumns.has(mapping.dbColumn)) continue;
      
      for (const variation of mapping.variations) {
        const normalizedVariation = variation.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Calculate similarity score
        let score = 0;
        if (normalized.includes(normalizedVariation) || normalizedVariation.includes(normalized)) {
          score = mapping.priority * (Math.min(normalized.length, normalizedVariation.length) / Math.max(normalized.length, normalizedVariation.length));
        }
        
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { mapping, score };
        }
      }
    }
    
    if (bestMatch && bestMatch.score > 2) { // Minimum threshold
      mappedHeaders[originalHeader] = bestMatch.mapping.dbColumn;
      usedDbColumns.add(bestMatch.mapping.dbColumn);
      mappingReport.push(`🔍 Partial match: "${originalHeader}" → ${bestMatch.mapping.dbColumn} (score: ${bestMatch.score.toFixed(1)})`);
    } else {
      // Keep original header for unmapped columns
      mappedHeaders[originalHeader] = originalHeader;
      mappingReport.push(`⚠️  No mapping found: "${originalHeader}" → kept as-is`);
    }
  });
  
  return { mappedHeaders, mappingReport };
}

function parseCSV(csvText: string): { records: any[], mappingReport: string[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { records: [], mappingReport: [] };
  
  const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const { mappedHeaders, mappingReport } = smartColumnMapping(originalHeaders);
  
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const record: any = {};
    
    originalHeaders.forEach((originalHeader, index) => {
      const dbColumn = mappedHeaders[originalHeader];
      record[dbColumn] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return { records, mappingReport };
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

// Create shared checker instances outside the per-record function to avoid repeated initialization
let sharedInternalDNCChecker: InternalDNCChecker | null = null;
let sharedSynergyDNCChecker: SynergyDNCChecker | null = null;

// High-performance bulk compliance checking
async function bulkCheckCompliance(records: any[]): Promise<FastComplianceResult[]> {
  console.log(`Starting high-performance bulk compliance check for ${records.length} records...`);
  const startTime = Date.now();
  
  // Extract all phone numbers upfront
  const recordsWithPhones: { record: any; phone: string; index: number }[] = [];
  const resultsMap = new Map<number, FastComplianceResult>();
  
  records.forEach((record, index) => {
    const phone = record.phone || record.Phone || record.phone_number || record.PhoneNumber || record.primary_phone || record.PrimaryPhone || record.phone_home || '';
    
    if (!phone) {
      resultsMap.set(index, {
        record,
        isCompliant: false,
        failureReasons: ['Missing phone number'],
        checks: {}
      });
    } else {
      recordsWithPhones.push({ record, phone, index });
    }
  });
  
  console.log(`Found ${recordsWithPhones.length} records with valid phone numbers`);
  
  if (recordsWithPhones.length === 0) {
    return Array.from(resultsMap.values());
  }
  
  // Step 1: Bulk check Internal DNC (single database query)
  console.log('Step 1: Bulk checking Internal DNC...');
  const allPhones = recordsWithPhones.map(r => r.phone);
  const internalDNCResults = await sharedInternalDNCChecker!.bulkCheckNumbers(allPhones);
  
  // Step 2: Filter out numbers already blocked by Internal DNC
  const phonesNeedingSynergyCheck: { record: any; phone: string; index: number }[] = [];
  
  recordsWithPhones.forEach(({ record, phone, index }) => {
    const internalResult = internalDNCResults.get(phone);
    
    if (!internalResult) {
      // Shouldn't happen, but fail closed
      resultsMap.set(index, {
        record,
        isCompliant: false,
        failureReasons: ['Internal DNC check failed'],
        checks: { internalDNC: false }
      });
      return;
    }
    
    if (!internalResult.isCompliant) {
      // Already blocked by Internal DNC, no need to check Synergy
      resultsMap.set(index, {
        record,
        isCompliant: false,
        failureReasons: [...internalResult.reasons],
        checks: { internalDNC: false, synergyDNC: true } // Assume Synergy would pass
      });
    } else {
      // Need to check Synergy DNC
      phonesNeedingSynergyCheck.push({ record, phone, index });
    }
  });
  
  console.log(`${phonesNeedingSynergyCheck.length} numbers need Synergy DNC check`);
  
  // Step 3: High-concurrency Synergy DNC checks
  if (phonesNeedingSynergyCheck.length > 0) {
    console.log('Step 3: High-concurrency Synergy DNC checking...');
    
    // Use very high concurrency for external API calls (no artificial limits)
    const concurrency = Math.min(phonesNeedingSynergyCheck.length, 50); // Up to 50 concurrent requests
    const synergyResults = await processWithHighConcurrency(
      phonesNeedingSynergyCheck,
      async ({ record, phone, index }) => {
        try {
          const synergyResult = await sharedSynergyDNCChecker!.checkNumber(phone);
          const internalResult = internalDNCResults.get(phone)!;
          
          const isCompliant = internalResult.isCompliant && synergyResult.isCompliant;
          const failureReasons = [
            ...internalResult.reasons,
            ...synergyResult.reasons
          ];
          
          return {
            record,
            isCompliant,
            failureReasons,
            checks: {
              internalDNC: internalResult.isCompliant,
              synergyDNC: synergyResult.isCompliant
            },
            index
          };
        } catch (error) {
          console.error(`Synergy check failed for ${phone}, failing closed:`, error);
          const internalResult = internalDNCResults.get(phone)!;
          return {
            record,
            isCompliant: false,
            failureReasons: [...internalResult.reasons, 'Synergy DNC check failed - blocked for safety'],
            checks: {
              internalDNC: internalResult.isCompliant,
              synergyDNC: false
            },
            index
          };
        }
      },
      concurrency
    );
    
    // Add Synergy results to the results map
    synergyResults.forEach(result => {
      resultsMap.set(result.index, {
        record: result.record,
        isCompliant: result.isCompliant,
        failureReasons: result.failureReasons,
        checks: result.checks
      });
    });
  }
  
  const endTime = Date.now();
  const processingTimeMs = endTime - startTime;
  console.log(`Bulk compliance check completed in ${processingTimeMs}ms (${(processingTimeMs/1000).toFixed(1)}s)`);
  
  // Return results in original order
  const finalResults: FastComplianceResult[] = [];
  for (let i = 0; i < records.length; i++) {
    const result = resultsMap.get(i);
    if (result) {
      finalResults.push(result);
    } else {
      // Shouldn't happen, but fail closed
      finalResults.push({
        record: records[i],
        isCompliant: false,
        failureReasons: ['Unexpected error in compliance check'],
        checks: {}
      });
    }
  }
  
  return finalResults;
}

// High-performance concurrent processing without artificial delays
async function processWithHighConcurrency<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  concurrency: number = 20  // High concurrency for maximum speed
): Promise<R[]> {
  const results: R[] = [];
  const semaphore = new Array(concurrency).fill(null);
  
  // Process all items concurrently using a semaphore pattern
  const promises = items.map(async (item, index) => {
    // Wait for an available slot
    while (semaphore.filter(slot => slot === null).length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // Claim a slot
    const slotIndex = semaphore.findIndex(slot => slot === null);
    semaphore[slotIndex] = index;
    
    try {
      const result = await processor(item);
      return { result, index };
    } finally {
      // Release the slot
      semaphore[slotIndex] = null;
    }
  });
  
  const processedResults = await Promise.all(promises);
  
  // Sort results by original index and extract values
  return processedResults
    .sort((a, b) => a.index - b.index)
    .map(pr => pr.result);
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
    const { records, mappingReport } = parseCSV(csvText);
    
    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No records found in CSV' },
        { status: 400 }
      );
    }

    console.log(`Starting fast compliance check for ${records.length} records...`);
    console.log('Column mapping applied:');
    mappingReport.forEach(report => console.log(`  ${report}`));
    
    // Initialize shared checker instances at the start of each batch job
    console.log('Initializing shared DNC checkers...');
    sharedInternalDNCChecker = new InternalDNCChecker();
    sharedSynergyDNCChecker = new SynergyDNCChecker();
    
    const startTime = Date.now();

    // Use high-performance bulk processing for maximum speed
    console.log(`Processing ${records.length} records with high-performance bulk processing...`);
    const results = await bulkCheckCompliance(records);

    const endTime = Date.now();
    const processingTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);
    
    // Clean up shared checker instances after batch processing
    sharedInternalDNCChecker = null;
    sharedSynergyDNCChecker = null;

    // Separate compliant and non-compliant records
    const compliantRecords = results.filter((r: FastComplianceResult) => r.isCompliant).map((r: FastComplianceResult) => r.record);
    const nonCompliantRecords = results.filter((r: FastComplianceResult) => !r.isCompliant);

    // Generate summary statistics
    const summary = {
      totalRecords: records.length,
      compliantRecords: compliantRecords.length,
      nonCompliantRecords: nonCompliantRecords.length,
      complianceRate: ((compliantRecords.length / records.length) * 100).toFixed(1),
      processingTimeSeconds,
      failureReasons: {} as Record<string, number>,
      columnMappings: mappingReport
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
