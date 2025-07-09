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
  originalData: Record<string, any>; // Preserve original CSV row data
}

interface BulkClaimSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  processingTimeSeconds: number;
  failureReasons: Record<string, number>;
  successfulRecords: BulkClaimResult[]; // For CSV export
}

interface TrustedFormDetectionResult {
  totalRows: number;
  detectedCertificates: number;
  trustedFormColumn: string | null;
  sampleData: Array<{
    row: number;
    certificateUrl: string;
    extractedId: string;
    phone?: string;
    email?: string;
  }>;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

// Enhanced TrustedForm column detection with comprehensive variations
const TRUSTEDFORM_COLUMN_VARIATIONS = [
  // Primary variations (exact matches)
  'trusted_form_cert_url', 'trustedform', 'cert_url', 'certificate_url',
  // Extended variations for business use
  'tf_cert', 'tf_certificate', 'tf_url', 'trusted_form_url',
  'certificate', 'cert', 'trustedform_cert', 'trustedform_certificate',
  'trusted_form_certificate_url', 'tf_cert_url', 'tfcert',
  'form_cert', 'form_certificate', 'form_url',
  // Case and formatting variations
  'TrustedForm', 'TRUSTEDFORM', 'Certificate_URL', 'CERTIFICATE_URL',
  'Trusted_Form_Cert_URL', 'TF_Cert', 'TF_Certificate'
];

// Extract TrustedForm certificate ID from URL or direct ID
function extractTrustedFormId(value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Handle full URLs: https://cert.trustedform.com/abc123def456
  if (trimmed.includes('cert.trustedform.com/')) {
    const parts = trimmed.split('/');
    const id = parts[parts.length - 1];
    return id && id.length >= 12 ? id : null;
  }
  
  // Handle direct IDs: must be alphanumeric and at least 12 characters
  if (/^[a-zA-Z0-9]{12,}$/.test(trimmed)) {
    return trimmed;
  }
  
  return null;
}

// Smart detection of TrustedForm certificate column
function detectTrustedFormColumn(headers: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  const normalizedVariations = TRUSTEDFORM_COLUMN_VARIATIONS.map(v => v.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  
  // Find exact match first
  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (normalizedVariations.includes(normalizedHeaders[i])) {
      return headers[i]; // Return original header name
    }
  }
  
  // Find partial match
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    if (header.includes('trusted') || header.includes('cert') || header.includes('tf')) {
      return headers[i];
    }
  }
  
  return null;
}

// Proper type definition for record with index
interface RecordWithIndex {
  record: Record<string, any>;
  index: number;
}

// Process records with controlled concurrency and retry logic
async function processWithConcurrencyControl<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  concurrency: number = 3
): Promise<R[]> {
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / 50);
  
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const chunkNumber = Math.floor(i / 50) + 1;
    
    console.log(`[TF Bulk Claim] Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} records)`);
    
    const chunkResults = await processChunkWithConcurrency(chunk, processor, concurrency);
    results.push(...chunkResults);
    
    // Pause between chunks to prevent API overload
    if (i + 50 < items.length) {
      console.log(`[TF Bulk Claim] Pausing 1s before next chunk...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

async function processChunkWithConcurrency<T, R>(
  chunk: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < chunk.length; i += concurrency) {
    const batch = chunk.slice(i, i + concurrency);
    const batchPromises = batch.map(processor);
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches within chunk
    if (i + concurrency < chunk.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// Process individual certificate claim
async function processCertificateClaim(
  record: Record<string, any>, 
  rowIndex: number, 
  trustedFormColumn: string
): Promise<BulkClaimResult> {
  const certificateUrl = record[trustedFormColumn];
  const extractedId = extractTrustedFormId(certificateUrl);
  
  if (!extractedId) {
    return {
      row: rowIndex + 1,
      certificateUrl: certificateUrl || '',
      success: false,
      error: 'Invalid or missing TrustedForm certificate URL/ID',
      originalData: record
    };
  }
  
  // Build full URL if only ID was provided
  const fullUrl = certificateUrl.includes('cert.trustedform.com') 
    ? certificateUrl 
    : `https://cert.trustedform.com/${extractedId}`;
  
  try {
    const leadData = {
      email: record.email || record.Email || record.EMAIL,
      phone: record.phone || record.Phone || record.PHONE || record.phone_number,
      firstName: record.first_name || record.firstName || record.FirstName || record.fname,
      lastName: record.last_name || record.lastName || record.LastName || record.lname
    };
    
    const result = await TrustedFormService.retainCertificate(
      fullUrl,
      leadData,
      {
        reference: `bulk_claim_${Date.now()}`,
        vendor: 'compliance_system'
      }
    );
    
    return {
      row: rowIndex + 1,
      certificateUrl: fullUrl,
      phone: leadData.phone,
      email: leadData.email,
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      success: result.success,
      error: result.success ? undefined : result.error,
      status: result.status,
      claimedAt: result.success ? new Date().toISOString() : undefined,
      originalData: record
    };
  } catch (error) {
    console.error(`[TF Bulk Claim] Error processing row ${rowIndex + 1}:`, error);
    return {
      row: rowIndex + 1,
      certificateUrl: fullUrl,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error',
      originalData: record
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, csvData, headers, startClaiming } = await request.json();
    
    if (action === 'detect') {
      // Detection phase: analyze CSV and find TrustedForm certificates
      console.log(`[TF Bulk Claim] Detection phase - analyzing ${csvData.length} rows`);
      
      const trustedFormColumn = detectTrustedFormColumn(headers);
      if (!trustedFormColumn) {
        return NextResponse.json({
          success: false,
          error: 'No TrustedForm certificate column detected. Expected columns like: certificate_url, trustedform, tf_cert, etc.'
        }, { status: 400 });
      }
      
      console.log(`[TF Bulk Claim] Detected TF column: "${trustedFormColumn}"`);
      
      const detectionResult: TrustedFormDetectionResult = {
        totalRows: csvData.length,
        detectedCertificates: 0,
        trustedFormColumn,
        sampleData: [],
        errors: []
      };
      
      // Analyze first 100 rows for preview
      const previewRows = csvData.slice(0, 100);
      
      previewRows.forEach((row: Record<string, any>, index: number) => {
        const certificateUrl = row[trustedFormColumn];
        const extractedId = extractTrustedFormId(certificateUrl);
        
        if (extractedId) {
          detectionResult.detectedCertificates++;
          if (detectionResult.sampleData.length < 10) {
            detectionResult.sampleData.push({
              row: index + 1,
              certificateUrl,
              extractedId,
              phone: row.phone || row.Phone || row.phone_number,
              email: row.email || row.Email
            });
          }
        } else if (certificateUrl) {
          detectionResult.errors.push({
            row: index + 1,
            error: `Invalid TrustedForm format: "${certificateUrl}"`
          });
        }
      });
      
      // Count remaining valid certificates in full dataset
      if (csvData.length > 100) {
        const remainingRows = csvData.slice(100);
        remainingRows.forEach((row: Record<string, any>) => {
          const certificateUrl = row[trustedFormColumn];
          if (extractTrustedFormId(certificateUrl)) {
            detectionResult.detectedCertificates++;
          }
        });
      }
      
      console.log(`[TF Bulk Claim] Detection complete: ${detectionResult.detectedCertificates}/${detectionResult.totalRows} valid certificates`);
      
      return NextResponse.json({
        success: true,
        data: detectionResult
      });
    }
    
    if (action === 'claim' && startClaiming) {
      // Claiming phase: process all certificates
      console.log(`[TF Bulk Claim] Claiming phase - processing ${csvData.length} rows`);
      
      const trustedFormColumn = detectTrustedFormColumn(headers);
      if (!trustedFormColumn) {
        return NextResponse.json({
          success: false,
          error: 'TrustedForm column not found'
        }, { status: 400 });
      }
      
      const startTime = Date.now();
      
      // Filter records that have valid TrustedForm certificates
      const validRecords: RecordWithIndex[] = csvData
        .map((record: Record<string, any>, index: number) => ({ record, index }))
        .filter(({ record }: RecordWithIndex) => {
          const certificateUrl = record[trustedFormColumn];
          return extractTrustedFormId(certificateUrl) !== null;
        });
      
      console.log(`[TF Bulk Claim] Processing ${validRecords.length} valid certificates out of ${csvData.length} total rows`);
      
      // Process certificates with concurrency control
      const results = await processWithConcurrencyControl<RecordWithIndex, BulkClaimResult>(
        validRecords,
        async ({ record, index }: RecordWithIndex) => processCertificateClaim(record, index, trustedFormColumn),
        3 // Conservative concurrency for TrustedForm API
      );
      
      const endTime = Date.now();
      const processingTimeSeconds = Math.round((endTime - startTime) / 1000);
      
      // Generate summary statistics
      const successful = results.filter((r: BulkClaimResult) => r.success).length;
      const failed = results.filter((r: BulkClaimResult) => !r.success).length;
      
      const failureReasons: Record<string, number> = {};
      results.forEach((result: BulkClaimResult) => {
        if (!result.success && result.error) {
          failureReasons[result.error] = (failureReasons[result.error] || 0) + 1;
        }
      });
      
      const summary: BulkClaimSummary = {
        totalProcessed: results.length,
        successful,
        failed,
        processingTimeSeconds,
        failureReasons,
        successfulRecords: results.filter((r: BulkClaimResult) => r.success)
      };
      
      console.log(`[TF Bulk Claim] Complete: ${successful}/${results.length} successful in ${processingTimeSeconds}s`);
      
      return NextResponse.json({
        success: true,
        data: {
          summary,
          results,
          originalHeaders: headers // Preserve original column order for CSV export
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "detect" or "claim".'
    }, { status: 400 });
    
  } catch (error) {
    console.error('[TF Bulk Claim] API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown server error'
    }, { status: 500 });
  }
}
