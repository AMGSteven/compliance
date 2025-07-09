'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Download, Play, X, Shield, Clock, TrendingUp } from 'lucide-react';
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

      // Scale up detection results for full dataset
      const scaledResult = {
        ...result.data,
        totalRows: data.length,
        detectedCertificates: Math.round((result.data.detectedCertificates / detectionData.length) * data.length)
      };

      setDetectionResult(scaledResult);
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

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkProgress = Math.round(((i + 1) / chunks.length) * 100);
        setProgress(chunkProgress);

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

        // Accumulate results
        allResults = [...allResults, ...result.data.results];
        totalProcessed += result.data.summary.totalProcessed;

        // Small delay between chunks to avoid overwhelming the API
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
    // Conservative estimate: 1 second per record with concurrency
    const estimatedSeconds = Math.ceil(recordCount * 1.0);
    if (estimatedSeconds < 60) return `${estimatedSeconds} seconds`;
    const minutes = Math.ceil(estimatedSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
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
              <p className="text-sm text-gray-600">
                Processing {detectionResult?.detectedCertificates} certificates in chunks with controlled concurrency to ensure API reliability.
                {csvData.length > 500 && (
                  <span className="block mt-1 text-blue-600">
                    Large dataset detected - processing in {Math.ceil(csvData.length / 500)} chunks
                  </span>
                )}
              </p>
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
