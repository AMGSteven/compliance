'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Download, AlertTriangle } from 'lucide-react';

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
  message?: string;
}

export default function BulkClaimByListsPage() {
  const [listIds, setListIds] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BulkClaimByListsResponse | null>(null);

  const handleSubmit = async () => {
    if (!listIds.trim()) {
      alert('Please enter at least one list ID');
      return;
    }

    // Parse list IDs (split by newlines, commas, or spaces)
    const parsedListIds = listIds
      .split(/[\n,\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (parsedListIds.length === 0) {
      alert('Please enter valid list IDs');
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const response = await fetch('/api/trustedform/bulk-claim-by-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listIds: parsedListIds
        }),
      });

      const data: BulkClaimByListsResponse = await response.json();
      setResults(data);

    } catch (error: any) {
      console.error('Error:', error);
      setResults({
        success: false,
        error: error.message || 'An error occurred',
        totalLeads: 0,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        processingTime: '0.0s'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    if (!results || results.results.length === 0) return;
    
    const csvHeader = 'Row,List ID,Lead ID,Certificate URL,Phone,Email,First Name,Last Name,Success,Error,Claim Status\n';
    const csvContent = results.results.map(result => 
      `${result.row},"${result.listId}","${result.leadId}","${result.certificateUrl}","${result.phone}","${result.email}","${result.firstName}","${result.lastName}",${result.success},"${result.error || ''}","${result.claimStatus || ''}"`
    ).join('\n');
    
    const blob = new Blob([csvHeader + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustedform-bulk-claim-lists-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bulk TrustedForm Claim by List IDs</h1>
        <p className="text-gray-600">
          Claim TrustedForm certificates for historical leads filtered by list IDs.
          This will search existing leads and claim any certificates found.
        </p>
        <div className="mt-4 flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/trustedform/bulk-claim'}
          >
            CSV Upload Claim
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/leads/export-by-lists'}
          >
            Export Leads by List IDs
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>List IDs to Process</CardTitle>
          <CardDescription>
            Enter list IDs separated by newlines, commas, or spaces. The system will find all leads 
            with TrustedForm certificates from these lists and claim them retroactively.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={`pitch-bpo-list-1750372500892
f2a566d2-0e97-4a7d-bc95-389dade78caf
9cfc34d0-1236-4258-b4cd-9947baf28467
pitch-bpo-list-1750372488308`}
            value={listIds}
            onChange={(e) => setListIds(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing || !listIds.trim()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Processing Historical Leads...
              </>
            ) : (
              'Start Bulk Claim for Historical Leads'
            )}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {results.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Processing Results
                </CardTitle>
                <CardDescription>
                  Completed in {results.processingTime}
                </CardDescription>
              </div>
              {results.results.length > 0 && (
                <Button onClick={downloadResults} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{results.totalLeads}</div>
                <div className="text-sm text-gray-500">Total Leads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{results.processedCount}</div>
                <div className="text-sm text-gray-500">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{results.successCount}</div>
                <div className="text-sm text-gray-500">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{results.failureCount}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
            </div>

            {results.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-700 font-medium">{results.error}</span>
                </div>
              </div>
            )}

            {results.message && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <span className="text-blue-700">{results.message}</span>
              </div>
            )}

            {results.results.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <h4 className="font-semibold mb-2">Individual Results ({results.results.length})</h4>
                {results.results.slice(0, 100).map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-mono">{result.leadId}</span>
                      <Badge variant="outline" className="text-xs">
                        {result.listId}
                      </Badge>
                    </div>
                    <div className="text-right">
                      {result.success ? (
                        <Badge variant="default" className="text-xs">Claimed</Badge>
                      ) : (
                        <span className="text-red-600 text-xs">{result.error}</span>
                      )}
                    </div>
                  </div>
                ))}
                {results.results.length > 100 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ... and {results.results.length - 100} more results (download CSV for full list)
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
