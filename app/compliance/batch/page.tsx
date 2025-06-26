'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, FileCheck, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface ComplianceSummary {
  totalRecords: number;
  compliantRecords: number;
  nonCompliantRecords: number;
  complianceRate: string;
  failureReasons: Record<string, number>;
}

interface ComplianceResult {
  success: boolean;
  summary: ComplianceSummary;
  compliantRecords: any[];
  nonCompliantDetails: Array<{
    record: any;
    failureReasons: string[];
    checks: any;
  }>;
  compliantCSV: string;
  error?: string;
}

export default function BatchCompliancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/compliance/batch', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to process file');
      }
    } catch (err) {
      setError('An error occurred while processing the file');
      console.error('Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadCompliantRecords = () => {
    if (result?.compliantCSV) {
      downloadCSV(result.compliantCSV, 'compliant_records.csv');
    }
  };

  const downloadRejectedRecords = () => {
    if (result?.nonCompliantDetails) {
      const headers = ['phone_home', 'first_name', 'last_name', 'email', 'state', 'failure_reasons'];
      const csvLines = [headers.join(',')];
      
      result.nonCompliantDetails.forEach(detail => {
        const record = detail.record;
        const row = [
          record.phone_home || record.phone || '',
          record.first_name || '',
          record.last_name || '',
          record.email || '',
          record.state || '',
          `"${detail.failureReasons.join('; ')}"`
        ];
        csvLines.push(row.join(','));
      });
      
      const csvContent = csvLines.join('\n');
      downloadCSV(csvContent, 'rejected_records.csv');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CSV Batch Compliance Checking</h1>
        <p className="text-gray-600">
          Upload a CSV file to run compliance checks on all records. This process excludes duplicate checking 
          and filters out non-compliant records based on TCPA, DNC, phone validation, and state requirements.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Your CSV should contain a <code>phone_home</code> column with phone numbers. 
                Duplicate checking is excluded from this batch process.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleSubmit} 
              disabled={!file || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Check Compliance
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Section */}
      {isProcessing && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing records...</span>
                <span>Running compliance checks</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Section */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Compliance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.summary.totalRecords}
                  </div>
                  <div className="text-sm text-gray-600">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.summary.compliantRecords}
                  </div>
                  <div className="text-sm text-gray-600">Compliant</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.summary.nonCompliantRecords}
                  </div>
                  <div className="text-sm text-gray-600">Non-Compliant</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.summary.complianceRate}%
                  </div>
                  <div className="text-sm text-gray-600">Compliance Rate</div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={downloadCompliantRecords} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download Compliant Records ({result.summary.compliantRecords})
                </Button>
                {result.summary.nonCompliantRecords > 0 && (
                  <Button onClick={downloadRejectedRecords} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Rejected Records ({result.summary.nonCompliantRecords})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Failure Reasons */}
          {Object.keys(result.summary.failureReasons).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  Failure Reasons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(result.summary.failureReasons).map(([reason, count]) => (
                    <div key={reason} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <span className="text-sm">{reason}</span>
                      <span className="font-semibold text-red-600">{count} records</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Records */}
          {result.compliantRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Sample Compliant Records (First 5)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.compliantRecords.slice(0, 5).map((record, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 font-mono">
                            {record.phone_home || record.phone || 'N/A'}
                          </td>
                          <td className="p-2">
                            {`${record.first_name || ''} ${record.last_name || ''}`.trim() || 'N/A'}
                          </td>
                          <td className="p-2">{record.email || 'N/A'}</td>
                          <td className="p-2">{record.state || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.compliantRecords.length > 5 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ...and {result.compliantRecords.length - 5} more compliant records
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
