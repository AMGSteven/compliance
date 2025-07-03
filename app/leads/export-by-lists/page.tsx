'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ExportSummary {
  totalLeads: number;
  leadsByListId: Record<string, number>;
  exportedAt: string;
}

export default function LeadExportByListsPage() {
  const [listIds, setListIds] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    if (!listIds.trim()) {
      setError('Please enter at least one list ID');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccess(null);
    setExportSummary(null);

    try {
      // Parse list IDs (comma-separated, space-separated, or newline-separated)
      const listIdArray = listIds
        .split(/[,\s\n]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (listIdArray.length === 0) {
        setError('Please enter valid list IDs');
        setIsExporting(false);
        return;
      }

      console.log('Exporting leads for list IDs:', listIdArray);

      const response = await fetch('/api/leads/export-by-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          listIds: listIdArray,
          format: 'csv'
        }),
      });

      if (response.ok) {
        // Get export summary from headers
        const summaryHeader = response.headers.get('X-Export-Summary');
        if (summaryHeader) {
          const summary = JSON.parse(summaryHeader);
          setExportSummary(summary);
        }

        // Download the CSV file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
                        `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
        
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        setSuccess(`Successfully exported leads! Check your downloads folder for ${filename}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Export failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during export');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = async () => {
    if (!listIds.trim()) {
      setError('Please enter at least one list ID');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      const listIdArray = listIds
        .split(/[,\s\n]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      const response = await fetch('/api/leads/export-by-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          listIds: listIdArray,
          format: 'json'
        }),
      });

      const result = await response.json();

      if (result.success) {
        setExportSummary({
          totalLeads: result.totalLeads,
          leadsByListId: result.leadsByListId,
          exportedAt: new Date().toISOString()
        });
        setSuccess(`Preview: Found ${result.totalLeads} leads across ${Object.keys(result.leadsByListId).length} list(s)`);
      } else {
        setError(result.error || 'Preview failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during preview');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Export Leads by List IDs</h1>
        <p className="text-gray-600">
          Export leads from your database filtered by specific list IDs. 
          Enter one or more list IDs to download a CSV file with all matching leads.
        </p>
        <div className="mt-4 flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/trustedform/bulk-claim'}
          >
            TrustedForm Bulk Claim
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/trustedform/bulk-claim-lists'}
          >
            TrustedForm Claim by Lists
          </Button>
        </div>
      </div>

      {/* Export Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Configuration
          </CardTitle>
          <CardDescription>
            Enter the list IDs you want to export leads for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="listIds" className="text-sm font-medium">
              List IDs (comma-separated, space-separated, or one per line)
            </Label>
            <textarea
              id="listIds"
              value={listIds}
              onChange={(e) => setListIds(e.target.value)}
              placeholder="e.g., LIST123, LIST456, LIST789"
              className="w-full min-h-24 p-3 border rounded-md resize-vertical"
              disabled={isExporting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Examples: "LIST123, LIST456" or "LIST123 LIST456" or separate lines
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handlePreview}
              disabled={isExporting || !listIds.trim()}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Preview Count
            </Button>
            
            <Button 
              onClick={handleExport}
              disabled={isExporting || !listIds.trim()}
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Summary */}
      {exportSummary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Export Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Leads Found</p>
                <p className="text-2xl font-bold text-green-600">{exportSummary.totalLeads}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Unique List IDs</p>
                <p className="text-2xl font-bold text-blue-600">{Object.keys(exportSummary.leadsByListId).length}</p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Leads per List ID:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(exportSummary.leadsByListId).map(([listId, count]) => (
                  <Badge key={listId} variant="secondary">
                    {listId}: {count} leads
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {success && (
        <Alert className="mb-4 border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert className="mb-4 border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Export Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Export Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>CSV Format:</strong> The exported CSV will include all lead fields including personal information, TrustedForm URLs, and metadata.</p>
            <p><strong>Export Fields:</strong> ID, List ID, Name, Email, Phone, Zip Code, TrustedForm URL, Status, Campaign ID, Traffic Source, Demographics, Timestamps</p>
            <p><strong>Data Privacy:</strong> This export contains sensitive personal information. Handle according to your privacy policies.</p>
            <p><strong>Performance:</strong> Large exports may take a few moments to process.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
