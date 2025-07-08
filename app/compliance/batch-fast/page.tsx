'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, FileCheck, AlertCircle, CheckCircle, XCircle, Zap, Clock, Database, Send } from 'lucide-react';

interface FastComplianceSummary {
  totalRecords: number;
  compliantRecords: number;
  nonCompliantRecords: number;
  complianceRate: string;
  processingTimeSeconds: string;
  failureReasons: Record<string, number>;
}

interface FastComplianceResult {
  success: boolean;
  summary: FastComplianceSummary;
  compliantRecords: any[];
  nonCompliantDetails: Array<{
    record: any;
    failureReasons: string[];
    checks: any;
  }>;
  compliantCSV: string;
  error?: string;
}

// Additional interfaces for batch insertion and posting functionality
interface ListRouting {
  id: string;
  list_id: string;
  campaign_id: string;
  cadence_id: string;
  description: string;
  bid: number;
  dialer_type: number;
  dialer_name: string;
  token: string;
  display_label: string;
}

interface RoutingAllocation {
  routingId: string;
  listId: string;
  costPerLead: number;
  leadCount: number;
  routing: ListRouting;
}

interface InsertionResult {
  success: boolean;
  summary: {
    total: number;
    inserted: number;
    failed: number;
    listId: string;
    costPerLead: number;
    routingInfo: {
      campaign_id: string;
      cadence_id: string;
      dialer_name: string;
    };
  };
  failures: Array<{
    lead: any;
    error: string;
    details: any;
  }>;
}

interface PostingResult {
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  results: Array<{
    success: boolean;
    leadId: string;
    error?: string;
  }>;
}

export default function FastBatchCompliancePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<FastComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // State for batch insertion and posting functionality
  const [listRoutings, setListRoutings] = useState<ListRouting[]>([]);
  const [isLoadingRoutings, setIsLoadingRoutings] = useState(false);
  const [routingAllocations, setRoutingAllocations] = useState<RoutingAllocation[]>([]);
  const [isInsertionDialogOpen, setIsInsertionDialogOpen] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [insertionResult, setInsertionResult] = useState<any>(null);
  
  // Debug logging for insertion result changes
  const debugSetInsertionResult = (value: any) => {
    console.log('🔄 SETTING INSERTION RESULT:', value);
    console.log('🔄 Previous insertion result was:', insertionResult);
    setInsertionResult(value);
    if (value) {
      console.log('🔄 NEW insertion result set - should render summary');
    } else {
      console.log('🔄 CLEARING insertion result - summary should hide');
    }
  };
  const [isPosting, setIsPosting] = useState(false);
  const [pitchPostCount, setPitchPostCount] = useState<number>(0);
  const [internalPostCount, setInternalPostCount] = useState<number>(0);
  const [postingResults, setPostingResults] = useState<{
    pitch?: PostingResult;
    internal?: PostingResult;
  }>({});

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
      debugSetInsertionResult(null); // Clear previous insertion results
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    // Keep insertion result when processing new file to avoid confusion
    // setInsertionResult(null); // Don't clear automatically

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/compliance/batch-fast', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        console.log('File processing completed, result set');
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
      downloadCSV(result.compliantCSV, 'compliant_records_fast.csv');
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
      downloadCSV(csvContent, 'rejected_records_fast.csv');
    }
  };

  // Handler functions for batch insertion and posting
  const handleInsertIntoDatabase = async () => {
    setIsLoadingRoutings(true);
    setError(null); // Clear any previous errors
    try {
      const response = await fetch('/api/list-routings-for-batch');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('List routings response:', data); // Debug logging
      
      if (data.success && data.data) {
        setListRoutings(data.data || []);
        setIsInsertionDialogOpen(true);
      } else {
        setError('Failed to load list routings: ' + (data.error || 'Unknown error'));
        console.error('API returned error:', data);
      }
    } catch (err) {
      setError('Error loading list routings: ' + (err instanceof Error ? err.message : 'Unknown error'));
      console.error('Fetch error:', err);
    } finally {
      setIsLoadingRoutings(false);
    }
  };

  // Add routing to allocation list
  const addRoutingAllocation = (routing: ListRouting) => {
    if (routingAllocations.find(a => a.routingId === routing.id)) {
      return; // Already added
    }
    
    const newAllocation: RoutingAllocation = {
      routingId: routing.id,
      listId: routing.list_id,
      costPerLead: 0,
      leadCount: 0,
      routing: routing
    };
    
    setRoutingAllocations([...routingAllocations, newAllocation]);
  };
  
  // Remove routing from allocation list
  const removeRoutingAllocation = (routingId: string) => {
    setRoutingAllocations(routingAllocations.filter(a => a.routingId !== routingId));
  };
  
  // Update allocation values
  const updateAllocation = (routingId: string, field: 'costPerLead' | 'leadCount', value: number) => {
    setRoutingAllocations(routingAllocations.map(a => 
      a.routingId === routingId ? { ...a, [field]: value } : a
    ));
  };
  
  // Validate allocations
  const validateAllocations = () => {
    const totalAllocated = routingAllocations.reduce((sum, a) => sum + a.leadCount, 0);
    const availableLeads = result?.compliantRecords?.length || 0;
    
    if (totalAllocated > availableLeads) {
      return `Total allocated leads (${totalAllocated}) exceeds available leads (${availableLeads})`;
    }
    
    if (routingAllocations.some(a => a.leadCount <= 0 || a.costPerLead <= 0)) {
      return 'All allocations must have positive lead count and cost per lead';
    }
    
    return null;
  };

  const handleConfirmInsertion = async () => {
    if (!result?.compliantRecords || routingAllocations.length === 0) {
      setError('Please add at least one routing allocation');
      return;
    }

    const validationError = validateAllocations();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsInserting(true);
    try {
      const response = await fetch('/api/batch-insert-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compliantLeads: result.compliantRecords,
          routingAllocations: routingAllocations
        })
      });

      const data = await response.json();
      console.log('Insertion API response:', data);
      
      if (data.success) {
        console.log('✅ Insertion successful! Setting insertion result:', data);
        console.log('✅ Summary:', {
          totalInserted: data.summary?.totalInserted,
          totalFailed: data.summary?.totalFailed,
          routingsProcessed: data.summary?.routingsProcessed
        });
        debugSetInsertionResult(data);
        console.log('✅ Insertion result state updated, closing dialog');
        setIsInsertionDialogOpen(false);
        // Reset allocations
        setRoutingAllocations([]);
        console.log('✅ Dialog closed, allocations reset');
        // Additional check to ensure insertion result persists
        setTimeout(() => {
          console.log('🔍 Checking insertion result persistence after 1 second:', !!insertionResult);
        }, 1000);
      } else {
        setError('Insertion failed: ' + data.error);
      }
    } catch (err) {
      setError('Error during insertion');
      console.error('Error:', err);
    } finally {
      setIsInserting(false);
    }
  };

  const handleDialerPosting = async (dialerType: 'pitch_bpo' | 'internal', leadCount: number) => {
    if (!insertionResult || leadCount <= 0) return;

    setIsPosting(true);
    try {
      const response = await fetch('/api/batch-post-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: insertionResult.summary.listId,
          dialerType: dialerType,
          leadCount: leadCount
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPostingResults(prev => ({
          ...prev,
          [dialerType === 'pitch_bpo' ? 'pitch' : 'internal']: data
        }));
        
        // Clear the input after successful posting
        if (dialerType === 'pitch_bpo') {
          setPitchPostCount(0);
        } else {
          setInternalPostCount(0);
        }
      } else {
        setError(`${dialerType} posting failed: ` + data.error);
      }
    } catch (err) {
      setError(`Error posting to ${dialerType}`);
      console.error('Error:', err);
    } finally {
      setIsPosting(false);
    }
  };

  // Debug logging
  console.log('Render - insertionResult:', insertionResult);
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Zap className="h-8 w-8 text-yellow-500" />
          Fast CSV Batch Compliance
        </h1>
        <p className="text-gray-600">
          Optimized for large files (25k+ records). Checks only: <strong>Internal DNC</strong>, <strong>TCPA Litigators</strong>, 
          <strong>Blacklist DNC</strong>, and <strong>Synergy DNC</strong>. No external API calls for maximum speed.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Large CSV File
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
                  file:bg-yellow-50 file:text-yellow-700
                  hover:file:bg-yellow-100"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB, ~{Math.floor(file.size / 100)} estimated records)
                </p>
              )}
            </div>

            <Alert>
              <Zap className="h-4 w-4" />
              <AlertDescription>
                <strong>Fast Mode:</strong> Only internal compliance checks. Estimated processing time: 
                {file ? ` ~${Math.ceil((file.size / 1024 / 1024) * 2)} minutes` : ' 5-15 minutes for 25k records'}.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleSubmit} 
              disabled={!file || isProcessing}
              className="w-full bg-yellow-600 hover:bg-yellow-700"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing Fast...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Fast Compliance Check
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
                <span>Processing records in chunks...</span>
                <span>Fast internal checks only</span>
              </div>
              <Progress value={undefined} className="w-full" />
              <p className="text-xs text-gray-500">
                Processing 1000 records at a time for optimal performance
              </p>
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
                Fast Compliance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.summary.totalRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.summary.compliantRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Compliant</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.summary.nonCompliantRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Non-Compliant</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.summary.complianceRate}%
                  </div>
                  <div className="text-sm text-gray-600">Compliance Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                    <Clock className="h-5 w-5" />
                    {result.summary.processingTimeSeconds}s
                  </div>
                  <div className="text-sm text-gray-600">Processing Time</div>
                </div>
              </div>

              <div className="flex gap-4 mb-4">
                <Button onClick={downloadCompliantRecords} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download Compliant ({result.summary.compliantRecords.toLocaleString()})
                </Button>
                {result.summary.nonCompliantRecords > 0 && (
                  <Button onClick={downloadRejectedRecords} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Rejected ({result.summary.nonCompliantRecords.toLocaleString()})
                  </Button>
                )}
              </div>
              
              {/* Database Insertion Section */}
              {result.summary.compliantRecords > 0 && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Database Insertion</h3>
                    <span className="text-sm text-gray-600">
                      {result.summary.compliantRecords.toLocaleString()} leads ready for insertion
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
                      <span className="font-semibold text-red-600">{count.toLocaleString()} records</span>
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
                      ...and {(result.compliantRecords.length - 5).toLocaleString()} more compliant records
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Multi-Routing Allocation Dialog */}
      <Dialog open={isInsertionDialogOpen} onOpenChange={setIsInsertionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Multi-Routing Lead Distribution</DialogTitle>
            <p className="text-sm text-gray-600">
              Available leads: {result?.compliantRecords?.length || 0} | 
              Allocated: {routingAllocations.reduce((sum, a) => sum + a.leadCount, 0)}
            </p>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Available Routings */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Available List Routings</h3>
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {listRoutings.map((routing) => (
                  <div key={routing.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{routing.display_label || routing.description}</div>
                      <div className="text-sm text-gray-600">
                        {routing.dialer_name} • Bid: ${routing.bid}
                      </div>
                    </div>
                    <Button
                      onClick={() => addRoutingAllocation(routing)}
                      disabled={routingAllocations.some(a => a.routingId === routing.id)}
                      size="sm"
                    >
                      {routingAllocations.some(a => a.routingId === routing.id) ? 'Added' : 'Add'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Selected Allocations */}
            {routingAllocations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Lead Allocations</h3>
                <div className="space-y-3">
                  {routingAllocations.map((allocation) => (
                    <div key={allocation.routingId} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium">{allocation.routing.display_label || allocation.routing.description}</div>
                          <div className="text-sm text-gray-600">{allocation.routing.dialer_name}</div>
                        </div>
                        <Button
                          onClick={() => removeRoutingAllocation(allocation.routingId)}
                          variant="outline"
                          size="sm"
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Cost Per Lead ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={allocation.costPerLead || ''}
                            onChange={(e) => updateAllocation(allocation.routingId, 'costPerLead', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Number of Leads</Label>
                          <Input
                            type="number"
                            min="1"
                            max={result?.compliantRecords?.length || 0}
                            value={allocation.leadCount || ''}
                            onChange={(e) => updateAllocation(allocation.routingId, 'leadCount', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Total Cost: ${(allocation.costPerLead * allocation.leadCount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Summary */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total Leads:</span> {routingAllocations.reduce((sum, a) => sum + a.leadCount, 0)}
                    </div>
                    <div>
                      <span className="font-medium">Total Cost:</span> ${routingAllocations.reduce((sum, a) => sum + (a.costPerLead * a.leadCount), 0).toFixed(2)}
                    </div>
                    <div>
                      <span className="font-medium">Avg Cost/Lead:</span> ${
                        routingAllocations.length > 0 
                          ? (routingAllocations.reduce((sum, a) => sum + (a.costPerLead * a.leadCount), 0) / routingAllocations.reduce((sum, a) => sum + a.leadCount, 0)).toFixed(2)
                          : '0.00'
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => setIsInsertionDialogOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmInsertion}
                disabled={isInserting || routingAllocations.length === 0 || !!validateAllocations()}
                className="flex-1"
              >
                {isInserting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  `Distribute ${routingAllocations.reduce((sum, a) => sum + a.leadCount, 0)} Leads`
                )}
              </Button>
            </div>
            
            {/* Validation Error */}
            {validateAllocations() && (
              <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
                {validateAllocations()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Insertion Results */}
      {(() => {
        console.log('📋 RENDER CHECK - insertionResult exists:', !!insertionResult);
        console.log('📋 RENDER CHECK - insertionResult value:', insertionResult);
        return insertionResult;
      })() && (() => {
        console.log('📋 ✅ RENDERING insertion results section:', insertionResult?.summary);
        return true;
      })() && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Insertion Complete
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  console.log('Clearing insertion result');
                  debugSetInsertionResult(null);
                }}
              >
                Clear Results
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {insertionResult.summary.totalInserted}
                </div>
                <div className="text-sm text-gray-600">Inserted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {insertionResult.summary.failed}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  ${insertionResult.summary.averageCostPerLead?.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-gray-600">Cost Per Lead</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ${insertionResult.routingResults?.reduce((sum: number, r: any) => sum + (r.totalCost || 0), 0).toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-gray-600">Total Cost</div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2">Routing Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Routings Processed:</span> {insertionResult.summary.routingsProcessed}
                </div>
                <div>
                  <span className="font-medium">Total Cost:</span> ${insertionResult.routingResults?.reduce((sum: number, r: any) => sum + (r.totalCost || 0), 0).toFixed(2) || '0.00'}
                </div>
                <div>
                  <span className="font-medium">Dialers Used:</span> {insertionResult.routingResults?.map((r: any) => r.routingInfo?.dialer_name).filter(Boolean).join(', ') || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">List IDs:</span> {insertionResult.routingResults?.map((r: any) => r.listId).filter(Boolean).join(', ') || 'N/A'}
                </div>
              </div>
            </div>
            
            {/* Manual Posting Controls */}
            {insertionResult.summary.totalInserted > 0 && (
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
                          max={insertionResult.summary.totalInserted}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleDialerPosting('pitch_bpo', pitchPostCount)}
                          disabled={isPosting || pitchPostCount <= 0 || pitchPostCount > insertionResult.summary.totalInserted}
                          size="sm"
                        >
                          {isPosting ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {insertionResult.summary.totalInserted} leads
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
                          max={insertionResult.summary.totalInserted}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleDialerPosting('internal', internalPostCount)}
                          disabled={isPosting || internalPostCount <= 0 || internalPostCount > insertionResult.summary.totalInserted}
                          size="sm"
                        >
                          {isPosting ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600">
                        Available: {insertionResult.summary.totalInserted} leads
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
