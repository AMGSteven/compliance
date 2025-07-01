'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Upload, Download } from 'lucide-react';

interface UploadResult {
  success: boolean;
  processed: number;
  added: number;
  errors: string[];
  duplicates: number;
  details?: any;
}

export default function DNCCSVUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState('Customer requested DNC');
  const [campaign, setCampaign] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setResult(null);
      } else {
        alert('Please select a CSV file');
      }
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `phone_number,reason,campaign,agent_id
5555551234,Customer requested DNC,Campaign A,agent001
5555555678,Do not call request,Campaign B,agent002
5555559012,Compliance violation,Campaign C,agent003`;
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dnc_upload_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reason', reason);
      formData.append('campaign', campaign);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/dnc/csv-upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        processed: 0,
        added: 0,
        errors: ['Failed to upload file. Please try again.'],
        duplicates: 0
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">DNC CSV Upload</h1>
        <p className="mt-2 text-gray-600">
          Upload a CSV file to add multiple phone numbers to the Do Not Call (DNC) list
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select a CSV file containing phone numbers to add to the DNC list.
              The CSV should have a "phone_number" column at minimum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-input">CSV File</Label>
              <Input
                id="file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleCSV}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download Sample CSV
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Default Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Customer requested DNC"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500">
                This reason will be used for entries that don't have a reason specified in the CSV
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign/Source (Optional)</Label>
              <Input
                id="campaign"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g., Campaign A, Import 2024-07-01"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500">
                Helps identify the source of these DNC entries
              </p>
            </div>

            {file && (
              <Alert>
                <AlertDescription>
                  <strong>Selected file:</strong> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </AlertDescription>
              </Alert>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? 'Processing...' : 'Upload and Process CSV'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Upload Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.success ? (
                <div className="space-y-3">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      CSV processed successfully!
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{result.processed}</div>
                      <div className="text-sm text-blue-600">Total Processed</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{result.added}</div>
                      <div className="text-sm text-green-600">Successfully Added</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{result.duplicates}</div>
                      <div className="text-sm text-yellow-600">Already in DNC</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                      <div className="text-sm text-red-600">Errors</div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-600 mb-2">Errors:</h4>
                      <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {result.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-700 mb-1">
                            • {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      Upload failed. Please check the errors below and try again.
                    </AlertDescription>
                  </Alert>
                  
                  {result.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-red-600 mb-2">Errors:</h4>
                      <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {result.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-700 mb-1">
                            • {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CSV Format Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>CSV Format Requirements</CardTitle>
            <CardDescription>
              Your CSV file should follow this format for best results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Required Column:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code>phone_number</code> - The phone number to add to DNC (any format accepted)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Optional Columns:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code>reason</code> - Specific reason for this DNC entry</li>
                  <li><code>campaign</code> - Campaign or source identifier</li>
                  <li><code>agent_id</code> - Agent or user who requested the DNC</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Example CSV Content:</h4>
                <div className="bg-gray-100 p-3 rounded-lg text-sm font-mono">
                  phone_number,reason,campaign,agent_id<br/>
                  5555551234,Customer requested DNC,Campaign A,agent001<br/>
                  (555) 555-5678,Do not call request,Campaign B,agent002<br/>
                  555.555.9012,Compliance violation,Campaign C,agent003
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <strong>Note:</strong> Phone numbers can be in any format (with or without parentheses, dashes, dots).
                They will be automatically normalized for storage.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
