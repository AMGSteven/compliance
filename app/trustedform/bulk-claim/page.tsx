'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Upload, Download, Clock, AlertCircle } from 'lucide-react';

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

interface BulkClaimResponse {
  success: boolean;
  summary: BulkClaimSummary;
  successfulClaims: BulkClaimResult[];
  failedClaims: BulkClaimResult[];
  processingTime: string;
}

export default function BulkTrustedFormClaimPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BulkClaimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.name.toLowerCase().endsWith('.csv') || selectedFile.type === 'text/csv' || selectedFile.type === 'application/vnd.ms-excel')) {
      setFile(selectedFile);
      setError(null);
      setResults(null);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const parseCsv = (csvText: string): any[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const record: any = {};
      
      headers.forEach((header, index) => {
        if (values[index]) {
          record[header] = values[index];
        }
      });
      
      // Only add records that have a certificate URL
      if (record.certificate_url || record.certificateUrl || record.Certificate_URL || 
          record.trustedform_url || record.TrustedForm) {
        records.push(record);
      }
    }

    return records;
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const csvText = await file.text();
      const csvData = parseCsv(csvText);

      if (csvData.length === 0) {
        setError('No valid records found in CSV. Make sure you have certificate URLs.');
        setIsProcessing(false);
        return;
      }

      const response = await fetch('/api/trustedform/bulk-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvData }),
      });

      const result = await response.json();

      if (result.success) {
        setResults(result);
      } else {
        setError(result.error || 'Processing failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;

    const csvContent = [
      'Row,Certificate URL,Phone,Email,First Name,Last Name,Status,Error,Claimed At',
      ...results.successfulClaims.map(r => 
        `${r.row},"${r.certificateUrl}","${r.phone || ''}","${r.email || ''}","${r.firstName || ''}","${r.lastName || ''}",Success,"","${r.claimedAt || ''}"`
      ),
      ...results.failedClaims.map(r => 
        `${r.row},"${r.certificateUrl}","${r.phone || ''}","${r.email || ''}","${r.firstName || ''}","${r.lastName || ''}",Failed,"${r.error || ''}",""`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustedform-bulk-claim-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEstimatedTime = (recordCount: number): string => {
    // Rough estimate: 500ms per record with concurrency
    const estimatedSeconds = Math.ceil(recordCount * 0.5);
    if (estimatedSeconds < 60) return `${estimatedSeconds} seconds`;
    return `${Math.ceil(estimatedSeconds / 60)} minutes`;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bulk TrustedForm Certificate Claiming</h1>
        <p className="text-gray-600">
          Upload a CSV file to claim multiple TrustedForm certificates at once. 
          Each certificate will be retained in your TrustedForm account.
        </p>
        <div className="mt-4 flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/trustedform/bulk-claim-lists'}
          >
            Bulk Claim by List IDs
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/leads/export-by-lists'}
          >
            Export Leads by List IDs
          </Button>
        </div>
      </div>

      {/* CSV Format Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            CSV Format Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Required Column:</strong> certificate_url, certificateUrl, Certificate_URL, trustedform_url, or TrustedForm</p>
            <p><strong>Optional Columns:</strong> phone, email, first_name, last_name (for better matching)</p>
            <p><strong>Example:</strong></p>
            <code className="block bg-gray-100 p-2 rounded text-sm">
              certificate_url,phone,email,first_name,last_name<br/>
              https://cert.trustedform.com/abc123,5551234567,john@example.com,John,Doe<br/>
              https://cert.trustedform.com/def456,5559876543,jane@example.com,Jane,Smith
            </code>
            <div className="mt-3">
              <a 
                href="/sample-trustedform-bulk-claim.csv" 
                download
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Download Sample CSV File
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Select your CSV file containing TrustedForm certificate URLs to claim
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isProcessing}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <div className="text-sm text-gray-600">
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              )}
            </div>

            {file && !isProcessing && !results && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Estimated Processing Time:</strong> {getEstimatedTime(1000)} (for ~1000 records)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Processing time scales with file size. Large files may take several minutes.
                </p>
              </div>
            )}

            <Button 
              onClick={handleSubmit} 
              disabled={!file || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Processing Certificates...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Claim TrustedForm Certificates
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {isProcessing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 animate-spin" />
              Processing in Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Claiming TrustedForm certificates... This may take several minutes for large files.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Please be patient:</strong> We process certificates with controlled rate limiting 
                  to respect TrustedForm's API limits and ensure reliable results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Summary */}
      {results && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Processing Complete
              </CardTitle>
              <CardDescription>
                Processed {results.summary.totalProcessed} certificates in {results.processingTime}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.summary.successful}</div>
                  <div className="text-sm text-green-700">Successfully Claimed</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{results.summary.failed}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{results.summary.processingTimeSeconds}s</div>
                  <div className="text-sm text-blue-700">Processing Time</div>
                </div>
              </div>

              {results.summary.successful > 0 && (
                <div className="mb-4">
                  <Progress 
                    value={(results.summary.successful / results.summary.totalProcessed) * 100} 
                    className="h-2"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Success Rate: {Math.round((results.summary.successful / results.summary.totalProcessed) * 100)}%
                  </p>
                </div>
              )}

              <Button onClick={downloadResults} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Results CSV
              </Button>
            </CardContent>
          </Card>

          {/* Failure Reasons */}
          {results.summary.failed > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Failure Analysis</CardTitle>
                <CardDescription>
                  Common reasons why certificates failed to claim
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(results.summary.failureReasons).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm">{reason}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Records Preview */}
          {results.failedClaims.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Failed Claims Preview</CardTitle>
                <CardDescription>
                  First 10 failed certificate claims (download full results for complete list)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Row</th>
                        <th className="text-left p-2">Certificate URL</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.failedClaims.slice(0, 10).map((claim) => (
                        <tr key={claim.row} className="border-b">
                          <td className="p-2">{claim.row}</td>
                          <td className="p-2 max-w-xs truncate">{claim.certificateUrl}</td>
                          <td className="p-2">{claim.phone || '-'}</td>
                          <td className="p-2">{claim.email || '-'}</td>
                          <td className="p-2 text-red-600 max-w-xs truncate">{claim.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {results.failedClaims.length > 10 && (
                  <p className="text-sm text-gray-600 mt-2">
                    ... and {results.failedClaims.length - 10} more failed claims. Download the full results for complete data.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
