'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Download, Play, X, Shield, Clock, TrendingUp, RefreshCw, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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
  originalData: Record<string, any>;
}

interface BulkClaimSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  processingTimeSeconds: number;
  failureReasons: Record<string, number>;
  successfulRecords: BulkClaimResult[];
}

type ProcessingState = 'idle' | 'uploading' | 'detecting' | 'previewing' | 'claiming' | 'completed' | 'error';

export default function BulkClaimTFPage() {
  const [state, setState] = useState<ProcessingState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [detectionResult, setDetectionResult] = useState<TrustedFormDetectionResult | null>(null);
  const [claimResults, setClaimResults] = useState<{ summary: BulkClaimSummary; results: BulkClaimResult[]; originalHeaders?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumeFromChunk, setResumeFromChunk] = useState<number>(1);
  const [completedChunks, setCompletedChunks] = useState<number[]>([]);
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [showHistoricalResults, setShowHistoricalResults] = useState(false);
  const [historicalResults, setHistoricalResults] = useState<BulkClaimResult[]>([]);
  // Default to last 7 days to ensure we capture recent bulk claims
  const [historicalDateRange, setHistoricalDateRange] = useState({ 
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });

  // Certificate Status Checker state
  const [statusCheckFile, setStatusCheckFile] = useState<File | null>(null);
  const [statusCheckData, setStatusCheckData] = useState<any[]>([]);
  const [statusCheckHeaders, setStatusCheckHeaders] = useState<string[]>([]);
  const [statusCheckResults, setStatusCheckResults] = useState<any[]>([]);
  const [statusCheckProgress, setStatusCheckProgress] = useState(0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);
  const [statusCheckComplete, setStatusCheckComplete] = useState(false);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    // Check file size (warn if > 5MB)
    const fileSizeMB = uploadedFile.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      setError('File too large. Please upload a CSV file smaller than 50MB.');
      return;
    }

    setFile(uploadedFile);
    setState('uploading');
    setError(null);

    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV must contain at least a header row and one data row');
      }

      // Warn about very large files
      if (lines.length > 100000) {
        throw new Error('File too large. Please upload a CSV with fewer than 100,000 records.');
      }

      const csvHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const csvRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        csvHeaders.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setHeaders(csvHeaders);
      setCsvData(csvRows);
      setState('detecting');

      // Automatically detect TrustedForm certificates
      await detectCertificates(csvRows, csvHeaders);
    } catch (err) {
      console.error('File upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process CSV file');
      setState('error');
    }
  }, []);

  const detectCertificates = async (data: Record<string, string>[], csvHeaders: string[]) => {
    try {
      setProgress(25);
      
      // For large datasets, only send first 1000 records for detection to avoid 413 errors
      const detectionData = data.length > 1000 ? data.slice(0, 1000) : data;
      
      const response = await fetch('/api/data-management/bulk-claim-tf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detect',
          csvData: detectionData,
          headers: csvHeaders,
          totalRecords: data.length // Include total count for proper stats
        })
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('File too large for processing. Please upload a smaller CSV file (max 10,000 records).');
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      setProgress(50);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Backend now handles proper scaling - no need to scale again
      setDetectionResult(result.data);
      setState('previewing');
      setShowPreviewDialog(true);
      setProgress(100);
    } catch (err) {
      console.error('Detection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detect TrustedForm certificates');
      setState('error');
    }
  };

  const startBulkClaiming = async () => {
    if (!detectionResult) return;

    setState('claiming');
    setShowPreviewDialog(false);
    setProgress(0);

    try {
      // Process large datasets in chunks to avoid 413 errors
      const CHUNK_SIZE = 500; // Process 500 records at a time
      const chunks = [];
      
      for (let i = 0; i < csvData.length; i += CHUNK_SIZE) {
        chunks.push(csvData.slice(i, i + CHUNK_SIZE));
      }

      let allResults: BulkClaimResult[] = [];
      let totalProcessed = 0;
      const startTime = Date.now();

      // Set total chunks for progress tracking
      setTotalChunks(chunks.length);
      
      // Start from resume chunk if specified
      const startChunkIndex = Math.max(0, resumeFromChunk - 1);
      
      for (let i = startChunkIndex; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkProgress = Math.round(((i + 1) / chunks.length) * 100);
        setProgress(chunkProgress);
        setCurrentChunk(i + 1);

        // Process chunk with retry logic for network errors
        const chunkResult = await retryWithBackoff(async () => {
          const response = await fetch('/api/data-management/bulk-claim-tf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'claim',
              csvData: chunk,
              headers,
              startClaiming: true,
              chunkIndex: i + 1,
              totalChunks: chunks.length
            })
          });

          if (!response.ok) {
            if (response.status === 413) {
              throw new Error('Chunk too large. Please contact support.');
            }
            throw new Error(`Server error: ${response.status}`);
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error);
          }
          
          return result;
        }, 3, `Chunk ${i + 1}/${chunks.length}`);

        // Accumulate results
        allResults = [...allResults, ...chunkResult.data.results];
        totalProcessed += chunkResult.data.summary.totalProcessed;
        
        // Track completed chunks
        setCompletedChunks(prev => [...prev, i + 1]);

        // Small delay between chunks to avoid overwhelming the API
        if (i < chunks.length - 1) {
          await new Promise((resolve: (value: void) => void) => setTimeout(resolve, 100));
        }
      }

      // Compile final summary
      const processingTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      const successful = allResults.filter(r => r.success).length;
      const failed = allResults.filter(r => !r.success).length;
      
      const failureReasons: Record<string, number> = {};
      allResults.filter(r => !r.success).forEach(r => {
        const reason = r.error || 'Unknown error';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });

      const finalSummary: BulkClaimSummary = {
        totalProcessed,
        successful,
        failed,
        processingTimeSeconds,
        failureReasons,
        successfulRecords: allResults.filter(r => r.success)
      };

      setClaimResults({
        summary: finalSummary,
        results: allResults,
        originalHeaders: headers
      });
      setState('completed');
      setProgress(100);
    } catch (err) {
      console.error('Claiming error:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim certificates');
      setState('error');
    }
  };

  const downloadSuccessfulResults = () => {
    if (!claimResults?.summary.successfulRecords.length) return;

    // Preserve original column order from the uploaded CSV headers
    // Use originalHeaders from API response if available, fallback to local headers
    const originalHeaders = claimResults.originalHeaders || headers; // Perfect column order preservation
    const claimHeaders = ['tf_claim_status', 'tf_claimed_at', 'tf_certificate_url'];
    const allHeaders = [...originalHeaders, ...claimHeaders];

    const csvContent = [
      // Header row with exact original column order
      allHeaders.join(','),
      // Data rows with all original columns preserved
      ...claimResults.summary.successfulRecords.map(record => {
        // Map each original header to its value, preserving order and handling missing values
        const originalValues = originalHeaders.map((header: string) => {
          const value = record.originalData[header];
          // Handle null, undefined, and empty values properly
          const safeValue = (value === null || value === undefined) ? '' : value.toString();
          // Escape quotes for CSV format
          return `"${safeValue.replace(/"/g, '""')}"`;
        });
        
        // Add claim status columns
        const claimValues = [
          '"SUCCESS"',
          `"${record.claimedAt || ''}"`,
          `"${record.certificateUrl || ''}"`
        ];
        
        return [...originalValues, ...claimValues].join(',');
      })
    ].join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `successful_tf_claims_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); // Ensure compatibility
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetProcess = () => {
    setState('idle');
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setDetectionResult(null);
    setClaimResults(null);
    setError(null);
    setShowPreviewDialog(false);
    setProgress(0);
  };

  const getEstimatedTime = (recordCount: number) => {
    // Realistic estimate: ~0.01 seconds per record with 3x concurrency
    // Modern APIs are fast, with proper concurrency we can do 50-100/sec
    const estimatedSeconds = Math.ceil(recordCount * 0.01);
    if (estimatedSeconds < 60) return `${estimatedSeconds} seconds`;
    const minutes = Math.ceil(estimatedSeconds / 60);
    if (minutes > 60) {
      const hours = Math.ceil(minutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  // Helper function to check if error is network-related
  const isNetworkError = (error: any): boolean => {
    const errorMessage = error?.message || error?.toString() || '';
    return errorMessage.includes('Failed to fetch') || 
           errorMessage.includes('NetworkError') ||
           errorMessage.includes('ERR_NETWORK') ||
           errorMessage.includes('Connection');
  };

  // Helper function for exponential backoff delay
  const getRetryDelay = (attempt: number): number => {
    return Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
  };

  // Retry function with exponential backoff
  const retryWithBackoff = async (
    fn: () => Promise<any>,
    maxRetries: number = 3,
    context: string = 'operation'
  ): Promise<any> => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          console.error(`[${context}] Final attempt failed:`, error);
          throw error;
        }
        
        if (isNetworkError(error)) {
          const delay = getRetryDelay(attempt);
          console.log(`[${context}] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise((resolve: (value: void) => void) => setTimeout(resolve, delay));
        } else {
          // Non-network errors should not be retried
          throw error;
        }
      }
    }
    
    throw lastError;
  };

  // Fetch historical results from database
  const fetchHistoricalResults = async (startDate?: string, endDate?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/data-management/bulk-claim-tf/history?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch historical results');
      }
      
      const data = await response.json();
      setHistoricalResults(data.results || []);
      setShowHistoricalResults(true);
    } catch (error) {
      console.error('Error fetching historical results:', error);
      setError('Failed to fetch historical results');
    }
  };

  // Download combined results (current + historical)
  const downloadCombinedResults = () => {
    const currentResults = claimResults?.results || [];
    const allResults = [...historicalResults, ...currentResults];
    
    if (allResults.length === 0) {
      setError('No results to download');
      return;
    }
    
    downloadCSV(allResults, claimResults?.originalHeaders || headers);
  };

  // Utility function to download data as CSV
  const downloadCSV = (data: any[], columns?: string[]) => {
    if (!data || data.length === 0) return;
    
    // Use provided columns or extract from first data item
    const csvColumns = columns || (data[0]?.originalData ? 
      Object.keys(data[0].originalData) : 
      ['certificateUrl', 'success', 'error', 'claimedAt']
    );
    
    // Create CSV header
    const csvHeader = csvColumns.join(',') + '\n';
    
    // Create CSV rows
    const csvRows = data.map(item => {
      const row = csvColumns.map(col => {
        let value = '';
        
        // Handle different data structures
        if (item.originalData && item.originalData[col] !== undefined) {
          value = item.originalData[col];
        } else if (item[col] !== undefined) {
          value = item[col];
        } else {
          // Map common column names
          switch(col) {
            case 'certificate_url':
              value = item.certificateUrl || item.certificate_url || '';
              break;
            case 'success':
              value = item.success ? 'Yes' : 'No';
              break;
            case 'error':
              value = item.error || '';
              break;
            case 'claimed_at':
              value = item.claimedAt || item.claimed_at || '';
              break;
            default:
              value = item[col] || '';
          }
        }
        
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      return row.join(',');
    }).join('\n');
    
    // Create and download file
    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trustedform-bulk-claim-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Certificate Status Checker Functions
  const handleStatusCheckFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      setStatusCheckError('Please upload a CSV file');
      return;
    }

    setStatusCheckFile(uploadedFile);
    setStatusCheckError(null);
    setStatusCheckComplete(false);
    setStatusCheckResults([]);

    // Parse CSV
    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setStatusCheckError('CSV file is empty');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = { _rowIndex: index };
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });

      setStatusCheckHeaders(headers);
      setStatusCheckData(data);
      console.log(`[Status Check] Loaded ${data.length} rows with headers:`, headers);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setStatusCheckError('Failed to parse CSV file');
    }
  }, []);

  const extractCertificateId = (url: string): string | null => {
    if (!url) return null;
    
    // Extract certificate ID from TrustedForm URL
    // Format: https://cert.trustedform.com/{cert_id}
    const match = url.match(/cert\.trustedform\.com\/([a-f0-9]+)/);
    return match ? match[1] : url; // Return the ID or fallback to original if not a URL
  };

  const checkCertificateStatus = async (certId: string): Promise<{ status: string; data?: any; error?: string }> => {
    try {
      // Call TrustedForm GET API
      const response = await fetch(`https://cert.trustedform.com/${certId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { status: 'Success', data };
      } else if (response.status === 404) {
        return { status: 'Failed', error: 'Certificate expired or not found' };
      } else if (response.status === 400) {
        return { status: 'Failed', error: 'Malformed certificate ID' };
      } else {
        return { status: 'Failed', error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return { status: 'Failed', error: `Network error: ${error}` };
    }
  };

  const startStatusChecking = async () => {
    if (!statusCheckData.length) {
      setStatusCheckError('No data to check');
      return;
    }

    setIsCheckingStatus(true);
    setStatusCheckError(null);
    setStatusCheckProgress(0);
    setStatusCheckComplete(false);
    
    // Find certificate URL column using the same intelligent detection logic as bulk claim
    const certUrlColumn = statusCheckHeaders.find(h => {
      const lower = h.toLowerCase();
      return (
        lower === 'certificate_url' ||
        lower === 'trustedform' ||
        lower === 'tf_cert' ||
        lower === 'cert_url' ||
        lower === 'trusted_form_cert_url' ||
        lower === 'certificateurl' ||
        lower === 'trustedformurl' ||
        lower === 'tf_url' ||
        lower === 'trusted_form_url' ||
        (lower.includes('certificate') && lower.includes('url')) ||
        (lower.includes('cert') && lower.includes('url')) ||
        (lower.includes('trusted') && lower.includes('form')) ||
        lower.includes('trustedform')
      );
    });

    if (!certUrlColumn) {
      setStatusCheckError(
        `Could not find certificate URL column. Please ensure your CSV has a column with one of these names:\n` +
        `• certificate_url\n• trustedform\n• tf_cert\n• cert_url\n• trusted_form_cert_url\n` +
        `Available columns: ${statusCheckHeaders.join(', ')}`
      );
      setIsCheckingStatus(false);
      return;
    }

    console.log(`[Status Check] Using column '${certUrlColumn}' for certificate URLs`);
    console.log(`[Status Check] Starting to check ${statusCheckData.length} certificates with BATCHED CONCURRENCY (target: ~1 min for 50k records)...`);

    // Process certificates in concurrent batches for optimal speed
    const BATCH_SIZE = 150; // Process 150 certificates concurrently per batch
    const BATCH_DELAY = 180; // 180ms delay between batches = ~833 requests/second
    
    const allResults: any[] = [];
    let totalProcessed = 0;
    
    // Split data into batches
    const batches = [];
    for (let i = 0; i < statusCheckData.length; i += BATCH_SIZE) {
      batches.push(statusCheckData.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[Status Check] Processing ${batches.length} batches of ${BATCH_SIZE} certificates each`);
    
    // Process each batch concurrently
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartIndex = batchIndex * BATCH_SIZE;
      
      // Process all certificates in this batch concurrently
      const batchPromises = batch.map(async (row, indexInBatch) => {
        const globalIndex = batchStartIndex + indexInBatch;
        const certUrl = row[certUrlColumn];
        const certId = extractCertificateId(certUrl);

        if (!certId) {
          return {
            ...row,
            tf_status: 'Failed',
            tf_error: 'Invalid certificate URL/ID',
            tf_checked_at: new Date().toISOString(),
            _index: globalIndex
          };
        } else {
          const statusResult = await checkCertificateStatus(certId);
          
          return {
            ...row,
            tf_status: statusResult.status,
            tf_error: statusResult.error || '',
            tf_data: statusResult.data ? JSON.stringify(statusResult.data) : '',
            tf_checked_at: new Date().toISOString(),
            _index: globalIndex
          };
        }
      });
      
      // Wait for this batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Add successful results to our collection
      const successfulBatchResults = batchResults
        .map(result => result.status === 'fulfilled' ? result.value : null)
        .filter(Boolean);
      
      allResults.push(...successfulBatchResults);
      totalProcessed += batch.length;
      
      // Update progress
      setStatusCheckProgress(Math.round((totalProcessed / statusCheckData.length) * 100));
      
      console.log(`[Status Check] Completed batch ${batchIndex + 1}/${batches.length} (${totalProcessed}/${statusCheckData.length} certificates)`);
      
      // Small delay between batches to maintain ~833 requests/second
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Sort results by original index and remove temporary index
    const finalResults = allResults
      .sort((a, b) => a._index - b._index)
      .map(({ _index, ...rest }) => rest);

    setStatusCheckResults(finalResults);
    setStatusCheckComplete(true);
    setIsCheckingStatus(false);
    console.log(`[Status Check] Completed checking ${finalResults.length} certificates`);
  };

  const downloadStatusCheckResults = () => {
    if (!statusCheckResults.length) {
      setStatusCheckError('No results to download');
      return;
    }

    // Create CSV with original columns plus new status columns
    const newHeaders = [...statusCheckHeaders, 'tf_status', 'tf_error', 'tf_data', 'tf_checked_at'];
    const csvHeader = newHeaders.join(',') + '\n';
    
    const csvRows = statusCheckResults.map(row => {
      return newHeaders.map(header => {
        const value = row[header] || '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trustedform-status-check-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Bulk Claim TrustedForm Certificates</h1>
        </div>
        <p className="text-gray-600 text-lg">
          Upload a CSV file to automatically claim TrustedForm certificates for your leads. 
          The system will intelligently detect certificate URLs and process them efficiently.
        </p>
      </div>

      {/* CSV Format Guide */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Format Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Required Column (any of these names):</h4>
              <div className="flex flex-wrap gap-2">
                {['certificate_url', 'trustedform', 'tf_cert', 'cert_url', 'trusted_form_cert_url'].map(name => (
                  <Badge key={name} variant="outline">{name}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Optional Columns (for better matching):</h4>
              <div className="flex flex-wrap gap-2">
                {['email', 'phone', 'first_name', 'last_name'].map(name => (
                  <Badge key={name} variant="secondary">{name}</Badge>
                ))}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">File Limits:</h4>
              <ul className="text-sm space-y-1">
                <li>• Maximum file size: 50MB</li>
                <li>• Maximum records: 100,000 rows</li>
                <li>• Large files are processed in chunks automatically</li>
              </ul>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Example CSV Format:</h4>
              <code className="text-sm">
                certificate_url,email,phone,first_name,last_name<br/>
                https://cert.trustedform.com/abc123,john@example.com,5551234567,John,Doe<br/>
                def456ghi789,jane@example.com,5559876543,Jane,Smith
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      {state === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Select your CSV file containing TrustedForm certificate URLs to claim
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Choose CSV file to upload</p>
                <p className="text-gray-500">Drag and drop or click to browse</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" className="mt-4" asChild>
                    <span>Select CSV File</span>
                  </Button>
                </label>
              </div>
            </div>
            

          </CardContent>
        </Card>
      )}

      {/* Resume Functionality */}
      {csvData.length > 0 && state !== 'claiming' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Resume Processing
            </CardTitle>
            <CardDescription>
              Resume from a specific chunk if processing was interrupted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Start from chunk:</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={resumeFromChunk}
                  onChange={(e) => setResumeFromChunk(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-center"
                />
                <span className="text-sm text-gray-600">
                  (Each chunk processes ~500 records = {Math.ceil(csvData.length / 500)} total chunks)
                </span>
              </div>
              
              {completedChunks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Completed chunks: {completedChunks.join(', ')}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setCompletedChunks([]);
                      setResumeFromChunk(1);
                      setCurrentChunk(0);
                      setTotalChunks(0);
                    }}
                  >
                    Reset Progress
                  </Button>
                </div>
              )}
              
              {resumeFromChunk > 1 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <p className="text-sm text-amber-800">
                    <strong>Resume Mode:</strong> Will skip chunks 1-{resumeFromChunk - 1} and start from chunk {resumeFromChunk}
                    <br />
                    <span className="text-xs">This will process records {((resumeFromChunk - 1) * 500) + 1} to {csvData.length}</span>
                  </p>
                  <Button 
                    onClick={startBulkClaiming}
                    disabled={!detectionResult?.detectedCertificates}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume Claiming from Chunk {resumeFromChunk}
                  </Button>
                </div>
              )}
              
              {/* Regular Start Button */}
              {resumeFromChunk === 1 && detectionResult && (
                <Button 
                  onClick={() => setShowPreviewDialog(true)}
                  disabled={!detectionResult?.detectedCertificates}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Claiming {detectionResult.detectedCertificates} Certificates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Previous Results
          </CardTitle>
          <CardDescription>
            Access and download results from previous bulk claim sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">From Date (optional)</label>
                <input
                  type="date"
                  value={historicalDateRange.start}
                  onChange={(e) => setHistoricalDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">To Date (optional)</label>
                <input
                  type="date"
                  value={historicalDateRange.end}
                  onChange={(e) => setHistoricalDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-end space-x-2">
                <Button 
                  onClick={() => fetchHistoricalResults(historicalDateRange.start, historicalDateRange.end)}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Get Historical Results
                </Button>
                <Button 
                  onClick={() => fetchHistoricalResults()}
                  variant="outline"
                  className="flex-1 bg-blue-50 hover:bg-blue-100 border-blue-300"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Get All Time Results
                </Button>
              </div>
            </div>
            
            {historicalResults.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <p className="text-sm text-green-800">
                  <strong>Found {historicalResults.length} unique certificates</strong>
                  <br />
                  <span className="text-xs">
                    Successful: {historicalResults.filter(r => r.success).length} | 
                    Failed: {historicalResults.filter(r => !r.success).length}
                  </span>
                  <br />
                  <span className="text-xs text-green-600">
                    ✅ Duplicates automatically removed for clean download
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => downloadCSV(historicalResults, ['certificate_url', 'success', 'error', 'claimed_at'])}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Historical Results
                  </Button>
                  {claimResults && (
                    <Button 
                      onClick={downloadCombinedResults}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Combined Results
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-500">
              <strong>Tip:</strong> All downloads contain only unique certificates with duplicates automatically removed for clean data.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Status Checker */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-indigo-600" />
            <div>
              <CardTitle>Certificate Status Checker</CardTitle>
              <CardDescription>
                Upload a CSV with certificate URLs to check their status via TrustedForm's GET API and download updated results
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Upload CSV File
            </label>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleStatusCheckFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              {statusCheckFile && (
                <div className="flex items-center text-sm text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {statusCheckFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Data Preview */}
          {statusCheckData.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-blue-900">Data Preview</h4>
                <Badge variant="secondary">{statusCheckData.length} rows</Badge>
              </div>
              <div className="text-sm text-blue-800">
                <p><strong>Headers:</strong> {statusCheckHeaders.join(', ')}</p>
                <p className="mt-1"><strong>Sample row:</strong> {Object.entries(statusCheckData[0] || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
              </div>
            </div>
          )}

          {/* Start Checking Button */}
          {statusCheckData.length > 0 && !isCheckingStatus && !statusCheckComplete && (
            <Button 
              onClick={startStatusChecking}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Status Checking ({statusCheckData.length} certificates)
            </Button>
          )}

          {/* Progress */}
          {isCheckingStatus && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Checking certificates...</span>
                <span className="text-sm text-gray-500">{statusCheckProgress}%</span>
              </div>
              <Progress value={statusCheckProgress} className="w-full" />
              <div className="text-xs text-blue-600 text-center font-medium">
                ⚡ BATCHED CONCURRENCY: 150 certificates per batch (~833 req/sec, 50k in ~1 min)
              </div>
            </div>
          )}

          {/* Results */}
          {statusCheckComplete && statusCheckResults.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-green-900">Status Check Complete!</h4>
                <Badge className="bg-green-600">{statusCheckResults.length} checked</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-green-800">
                  <strong>Successful:</strong> {statusCheckResults.filter(r => r.tf_status === 'Success').length}
                </div>
                <div className="text-red-800">
                  <strong>Failed:</strong> {statusCheckResults.filter(r => r.tf_status === 'Failed').length}
                </div>
              </div>

              <div className="text-xs text-green-700">
                New columns added: <code>tf_status</code>, <code>tf_error</code>, <code>tf_data</code>, <code>tf_checked_at</code>
              </div>
              
              <Button 
                onClick={downloadStatusCheckResults}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Updated CSV
              </Button>
            </div>
          )}

          {/* Error Display */}
          {statusCheckError && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{statusCheckError}</AlertDescription>
            </Alert>
          )}

          {/* Info */}
          <div className="text-xs text-gray-500 space-y-2">
            <div>
              <p><strong>Supported Certificate Column Names:</strong></p>
              <div className="flex flex-wrap gap-1 mt-1">
                {['certificate_url', 'trustedform', 'tf_cert', 'cert_url', 'trusted_form_cert_url'].map(name => (
                  <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p><strong>How it works:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Upload a CSV with certificate URLs (automatically detects column)</li>
                <li>Each certificate is checked via TrustedForm's GET /{'{cert_id}'} API</li>
                <li>Results include: Success/Failed status, error details, and full JSON response data</li>
                <li>Download the updated CSV with 4 new columns: tf_status, tf_error, tf_data, tf_checked_at</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing States */}
      {(state === 'uploading' || state === 'detecting') && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <span className="font-medium">
                    {state === 'uploading' ? 'Processing CSV file...' : 'Detecting TrustedForm certificates...'}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              TrustedForm Certificates Detected
            </DialogTitle>
            <DialogDescription>
              Review the detected certificates before starting the claiming process
            </DialogDescription>
          </DialogHeader>

          {detectionResult && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{detectionResult.totalRows}</div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{detectionResult.detectedCertificates}</div>
                  <div className="text-sm text-gray-600">Valid Certificates</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {getEstimatedTime(detectionResult.detectedCertificates)}
                  </div>
                  <div className="text-sm text-gray-600">Est. Processing Time</div>
                </div>
              </div>

              {/* Column Detection */}
              <div>
                <h4 className="font-semibold mb-2">Detected TrustedForm Column:</h4>
                <Badge variant="outline" className="text-sm">
                  {detectionResult.trustedFormColumn}
                </Badge>
              </div>

              {/* Sample Data Preview */}
              {detectionResult.sampleData.length > 0 && (
                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="font-semibold mb-3">Sample Certificates (first 10):</h4>
                  <div className="flex-1 border rounded-lg overflow-hidden">
                    <div className="h-full overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left p-2 w-16">Row</th>
                            <th className="text-left p-2 min-w-[200px]">Certificate URL</th>
                            <th className="text-left p-2 min-w-[150px]">Extracted ID</th>
                            <th className="text-left p-2 min-w-[120px]">Contact Info</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detectionResult.sampleData.map((sample) => (
                            <tr key={sample.row} className="hover:bg-gray-50">
                              <td className="p-2 text-center">{sample.row}</td>
                              <td className="p-2">
                                <div className="font-mono text-xs break-all">
                                  {sample.certificateUrl}
                                </div>
                              </td>
                              <td className="p-2">
                                <div className="font-mono text-xs break-all">
                                  {sample.extractedId}
                                </div>
                              </td>
                              <td className="p-2 text-xs">
                                <div className="break-words">
                                  {[sample.email, sample.phone].filter(Boolean).join(', ') || 'N/A'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {detectionResult.errors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{detectionResult.errors.length} rows have invalid certificate formats</strong>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">View errors</summary>
                      <ul className="mt-2 text-xs space-y-1">
                        {detectionResult.errors.slice(0, 5).map((error) => (
                          <li key={error.row}>Row {error.row}: {error.error}</li>
                        ))}
                        {detectionResult.errors.length > 5 && (
                          <li>... and {detectionResult.errors.length - 5} more</li>
                        )}
                      </ul>
                    </details>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={startBulkClaiming}
              disabled={!detectionResult?.detectedCertificates}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Claiming {detectionResult?.detectedCertificates} Certificates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claiming Progress */}
      {state === 'claiming' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <span className="font-medium">Claiming TrustedForm certificates...</span>
                </div>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              {/* Detailed Progress Info */}
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Processing {detectionResult?.detectedCertificates} certificates with retry logic for network failures.
                </p>
                
                {totalChunks > 1 && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-blue-600">
                      Chunk {currentChunk} of {totalChunks} 
                      ({Math.ceil(csvData.length / 500)} total chunks)
                    </span>
                    {resumeFromChunk > 1 && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Resumed from chunk {resumeFromChunk}
                      </Badge>
                    )}
                  </div>
                )}
                
                {completedChunks.length > 0 && totalChunks > 1 && (
                  <p className="text-xs text-gray-500">
                    Completed chunks: {completedChunks.slice(-5).join(', ')}
                    {completedChunks.length > 5 && ` (+${completedChunks.length - 5} more)`}
                  </p>
                )}
              </div>
              
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {state === 'completed' && claimResults && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{claimResults.summary.totalProcessed}</div>
                    <p className="text-sm text-gray-600">Total Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{claimResults.summary.successful}</div>
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">{claimResults.summary.failed}</div>
                    <p className="text-sm text-gray-600">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-gray-600" />
                  <div>
                    <div className="text-2xl font-bold">{claimResults.summary.processingTimeSeconds}s</div>
                    <p className="text-sm text-gray-600">Processing Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Success Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Success Rate</span>
                  <span>{Math.round((claimResults.summary.successful / claimResults.summary.totalProcessed) * 100)}%</span>
                </div>
                <Progress 
                  value={(claimResults.summary.successful / claimResults.summary.totalProcessed) * 100} 
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Failure Reasons */}
          {Object.keys(claimResults.summary.failureReasons).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Failure Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(claimResults.summary.failureReasons).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between items-center">
                      <span className="text-sm">{reason}</span>
                      <Badge variant="destructive">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button 
              onClick={downloadSuccessfulResults}
              disabled={!claimResults.summary.successful}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Successful Results ({claimResults.summary.successful} records)
            </Button>
            <Button variant="outline" onClick={resetProcess}>
              Process Another File
            </Button>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetProcess}
              className="ml-4"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
