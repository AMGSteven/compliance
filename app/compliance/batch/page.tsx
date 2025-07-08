'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, FileCheck, AlertCircle, CheckCircle, XCircle, Database, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface ListRouting {
  id: string;
  list_id: string;
  campaign_id: string;
  cadence_id: string;
  description: string;
  bid: number;
  dialer_type: number;
  dialer_name: string;
  display_label: string;
}

interface InsertionResult {
  success: boolean;
  insertedLeads: any[];
  failures: any[];
  summary: {
    total: number;
    inserted: number;
    failed: number;
    listId: string;
    costPerLead: number;
    routingInfo: {
      campaign_id: string;
      cadence_id: string;
      dialer_type: number;
      dialer_name: string;
    };
  };
}

interface PostingResult {
  success: boolean;
  postingResults: any[];
  summary: {
    requested: number;
    attempted: number;
    successful: number;
    failed: number;
    dialerType: string;
    dialerName: string;
  };
}

export default function BatchCompliancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New state for insertion dialog and posting controls
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [listRoutings, setListRoutings] = useState<ListRouting[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [costPerLead, setCostPerLead] = useState<number>(0);
  const [isInserting, setIsInserting] = useState(false);
  const [insertionResult, setInsertionResult] = useState<InsertionResult | null>(null);
  
  // State for posting controls
  const [isLoadingRoutings, setIsLoadingRoutings] = useState(false);
  const [pitchPostCount, setPitchPostCount] = useState<number>(0);
  const [internalPostCount, setInternalPostCount] = useState<number>(0);
  const [isPosting, setIsPosting] = useState(false);
  const [postingResults, setPostingResults] = useState<{ pitch?: PostingResult; internal?: PostingResult }>({});

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

  // New functions for insertion dialog and posting controls
  const handleInsertIntoDatabase = async () => {
    if (!result?.compliantRecords || result.compliantRecords.length === 0) {
      setError('No compliant records to insert');
      return;
    }

    // Load list routings for selection
    setIsLoadingRoutings(true);
    try {
      const response = await fetch('/api/list-routings-for-batch');
      const data = await response.json();
      
      if (data.success) {
        setListRoutings(data.data);
        setShowInsertDialog(true);
      } else {
        setError('Failed to load list routings');
      }
    } catch (err) {
      setError('Error loading list routings');
      console.error('Error:', err);
    } finally {
      setIsLoadingRoutings(false);
    }
  };

  const handleInsertionConfirm = async () => {
    if (!selectedListId || costPerLead < 0) {
      setError('Please select a list and enter a valid cost per lead');
      return;
    }

    setIsInserting(true);
    setError(null);

    try {
      const response = await fetch('/api/batch-insert-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliantLeads: result?.compliantRecords,
          listId: selectedListId,
          costPerLead: costPerLead
        })
      });

      const data = await response.json();

      if (data.success) {
        setInsertionResult(data);
        setShowInsertDialog(false);
        // Reset posting controls
        setPitchPostCount(0);
        setInternalPostCount(0);
      } else {
        setError(data.error || 'Failed to insert leads');
      }
    } catch (err) {
      setError('Error inserting leads into database');
      console.error('Error:', err);
    } finally {
      setIsInserting(false);
    }
  };

  const handleDialerPosting = async (dialerType: 'pitch_bpo' | 'internal', count: number) => {
    if (!insertionResult?.insertedLeads || insertionResult.insertedLeads.length === 0) {
      setError('No inserted leads available for posting');
      return;
    }

    if (count <= 0 || count > insertionResult.insertedLeads.length) {
      setError(`Invalid count. Must be between 1 and ${insertionResult.insertedLeads.length}`);
      return;
    }

    setIsPosting(true);
    setError(null);

    try {
      const leadIds = insertionResult.insertedLeads.map(lead => lead.id);
      
      const response = await fetch('/api/batch-post-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadIds,
          dialerType,
          count
        })
      });

      const data = await response.json();

      if (data.success) {
        setPostingResults(prev => ({
          ...prev,
          [dialerType === 'pitch_bpo' ? 'pitch' : 'internal']: data
        }));
      } else {
        setError(data.error || `Failed to post leads to ${dialerType}`);
      }
    } catch (err) {
      setError(`Error posting leads to ${dialerType}`);
      console.error('Error:', err);
    } finally {
      setIsPosting(false);
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

              <div className="flex gap-4 mb-4">
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
              
              {/* New Insert into Database section */}
              {result.summary.compliantRecords > 0 && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Database Insertion</h3>
                    <span className="text-sm text-gray-600">
                      {result.summary.compliantRecords} leads ready for insertion
                    </span>
                  </div>
                  <Button 
                    onClick={handleInsertIntoDatabase} 
                    disabled={isLoadingRoutings}
                    className="w-full"
                    variant="default"
                  >
                    {isLoadingRoutings ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Loading List Routings...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Insert Leads into Database
                      </>
                    )}
                  </Button>
                </div>
              )}
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
      
      {/* Insertion Results Display */}
      {insertionResult && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Database Insertion Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {insertionResult.summary.total}
                </div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {insertionResult.summary.inserted}
                </div>
                <div className="text-sm text-gray-600">Successfully Inserted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {insertionResult.summary.failed}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ${insertionResult.summary.costPerLead}
                </div>
                <div className="text-sm text-gray-600">Cost Per Lead</div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2">Routing Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Campaign ID:</span> {insertionResult.summary.routingInfo.campaign_id}
                </div>
                <div>
                  <span className="font-medium">Cadence ID:</span> {insertionResult.summary.routingInfo.cadence_id}
                </div>
                <div>
                  <span className="font-medium">Dialer:</span> {insertionResult.summary.routingInfo.dialer_name}
                </div>
                <div>
                  <span className="font-medium">List ID:</span> {insertionResult.summary.listId}
                </div>
              </div>
            </div>
            
            {/* Manual Posting Controls */}
            {insertionResult.summary.inserted > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Manual Dialer Posting</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pitch BPO Posting */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Pitch BPO Dialer
                    </h4>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Number of leads"
                          value={pitchPostCount || ''}
                          onChange={(e) => setPitchPostCount(parseInt(e.target.value) || 0)}
                          min={0}
                          max={insertionResult.summary.inserted}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleDialerPosting('pitch_bpo', pitchPostCount)}
                          disabled={isPosting || pitchPostCount <= 0 || pitchPostCount > insertionResult.summary.inserted}
                          size="sm"
                        >
                          {isPosting ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {insertionResult.summary.inserted} leads
                      </p>
                      {postingResults.pitch && (
                        <div className="text-xs bg-gray-50 p-2 rounded">
                          <div className="font-medium">Last Result:</div>
                          <div>Successful: {postingResults.pitch.summary.successful}</div>
                          <div>Failed: {postingResults.pitch.summary.failed}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Internal Dialer Posting */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Internal Dialer
                    </h4>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Number of leads"
                          value={internalPostCount || ''}
                          onChange={(e) => setInternalPostCount(parseInt(e.target.value) || 0)}
                          min={0}
                          max={insertionResult.summary.inserted}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleDialerPosting('internal', internalPostCount)}
                          disabled={isPosting || internalPostCount <= 0 || internalPostCount > insertionResult.summary.inserted}
                          size="sm"
                        >
                          {isPosting ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {insertionResult.summary.inserted} leads
                      </p>
                      {postingResults.internal && (
                        <div className="text-xs bg-gray-50 p-2 rounded">
                          <div className="font-medium">Last Result:</div>
                          <div>Successful: {postingResults.internal.summary.successful}</div>
                          <div>Failed: {postingResults.internal.summary.failed}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-sm text-gray-600">
                  <p><strong>Note:</strong> Leads are randomly selected from the inserted batch for posting.</p>
                  <p>Each posting operation selects a different random subset of leads.</p>
                </div>
              </div>
            )}
            
            {/* Insertion Failures */}
            {insertionResult.failures && insertionResult.failures.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-2 text-red-600">Insertion Failures ({insertionResult.failures.length})</h4>
                <div className="max-h-40 overflow-y-auto">
                  {insertionResult.failures.slice(0, 5).map((failure, index) => (
                    <div key={index} className="text-sm bg-red-50 p-2 rounded mb-2">
                      <div className="font-medium">{failure.lead.phone || 'Unknown Phone'}</div>
                      <div className="text-red-600">{failure.error}</div>
                    </div>
                  ))}
                  {insertionResult.failures.length > 5 && (
                    <p className="text-sm text-gray-500">...and {insertionResult.failures.length - 5} more failures</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Insertion Dialog */}
      <Dialog open={showInsertDialog} onOpenChange={setShowInsertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Leads into Database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="listSelect">Select List Routing</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a list routing..." />
                </SelectTrigger>
                <SelectContent>
                  {listRoutings.map((routing) => (
                    <SelectItem key={routing.id} value={routing.list_id}>
                      {routing.display_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="costInput">Cost Per Lead ($)</Label>
              <Input
                id="costInput"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costPerLead || ''}
                onChange={(e) => setCostPerLead(parseFloat(e.target.value) || 0)}
              />
            </div>
            
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm">
                <strong>Ready to insert:</strong> {result?.summary.compliantRecords || 0} compliant leads
              </p>
              <p className="text-xs text-gray-600 mt-1">
                All leads will be re-validated for compliance and duplicates before insertion.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInsertDialog(false)}
              disabled={isInserting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInsertionConfirm}
              disabled={isInserting || !selectedListId || costPerLead < 0}
            >
              {isInserting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Inserting...
                </>
              ) : (
                'Insert Leads'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
