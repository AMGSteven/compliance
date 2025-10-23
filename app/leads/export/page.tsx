'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet, Calendar, Users, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ExportFilters {
  startDate: string;
  endDate: string;
  status: string;
  listId: string;
  publisherName: string;
}

interface ExportPreview {
  count: number;
  dateRange: string;
  filters: ExportFilters;
}

export default function LeadExportPage() {
  const [filters, setFilters] = useState<ExportFilters>({
    startDate: '',
    endDate: '',
    status: 'success',
    listId: '',
    publisherName: ''
  });

  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [includeAllFields, setIncludeAllFields] = useState(true);

  // Set default dates (last 30 days)
  const setDefaultDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    setFilters(prev => ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }));
  };

  // Set current week dates
  const setCurrentWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    
    setFilters(prev => ({
      ...prev,
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }));
  };

  // Set current month dates
  const setCurrentMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    setFilters(prev => ({
      ...prev,
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }));
  };

  const previewExport = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    setIsPreviewLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', filters.startDate);
      params.append('endDate', filters.endDate);
      params.append('status', filters.status);
      params.append('format', 'json');
      
      if (filters.listId) {
        params.append('listId', filters.listId);
      }

      const response = await fetch(`/api/leads/export?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setPreview({
          count: data.count || 0,
          dateRange: `${filters.startDate} to ${filters.endDate}`,
          filters: data.filters || filters
        });
      } else {
        console.error('Preview error:', data);
        alert(`Preview failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to preview export. Please try again.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const downloadExport = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    setIsExporting(true);
    try {
      const exportData = {
        dateRange: {
          startDate: filters.startDate,
          endDate: filters.endDate
        },
        statuses: [filters.status],
        listIds: filters.listId ? [filters.listId] : [],
        includeFields: includeAllFields ? [] : [
          'id', 'created_at', 'first_name', 'last_name', 'email', 'phone', 
          'state', 'zip_code', 'list_id', 'status', 'trusted_form_cert_url'
        ],
        format: 'csv',
        publisherName: filters.publisherName
      };

      const response = await fetch('/api/leads/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (response.ok) {
        // Get the filename from the response headers
        const contentDisposition = response.headers.get('content-disposition');
        const filename = contentDisposition 
          ? contentDisposition.split('filename="')[1]?.replace('"', '')
          : `leads_export_${new Date().toISOString().split('T')[0]}.csv`;

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Get count from headers for success message
        const totalCount = response.headers.get('X-Total-Count');
        alert(`Successfully exported ${totalCount} leads to ${filename}`);
      } else {
        const errorData = await response.json();
        console.error('Export error:', errorData);
        alert(`Export failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export leads. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8" />
          Lead Export
        </h1>
        <p className="text-gray-600 mt-2">
          Export accepted leads for publishers with customizable date ranges and filters
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Export Filters
            </CardTitle>
            <CardDescription>
              Configure your export parameters and preview the results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                <Label className="text-sm font-medium">Date Range</Label>
              </div>
              
              <div className="flex gap-2 mb-4">
                <Button onClick={setCurrentWeek} variant="outline" size="sm">
                  This Week
                </Button>
                <Button onClick={setCurrentMonth} variant="outline" size="sm">
                  This Month
                </Button>
                <Button onClick={setDefaultDates} variant="outline" size="sm">
                  Last 30 Days
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Label htmlFor="status">Lead Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">Accepted Leads (success)</SelectItem>
                  <SelectItem value="new">New Leads</SelectItem>
                  <SelectItem value="error">Error Leads</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="listId">List ID (Optional)</Label>
                <Input
                  id="listId"
                  placeholder="e.g., pitch-bpo-list-123"
                  value={filters.listId}
                  onChange={(e) => setFilters(prev => ({ ...prev, listId: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="publisherName">Publisher Name (Optional)</Label>
                <Input
                  id="publisherName"
                  placeholder="e.g., PublisherCorp"
                  value={filters.publisherName}
                  onChange={(e) => setFilters(prev => ({ ...prev, publisherName: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Field Selection */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeAllFields"
                checked={includeAllFields}
                onCheckedChange={(checked) => setIncludeAllFields(checked === true)}
              />
              <Label 
                htmlFor="includeAllFields" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include all available fields (recommended)
              </Label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={previewExport} 
                variant="outline" 
                disabled={isPreviewLoading}
                className="flex-1"
              >
                {isPreviewLoading ? 'Loading...' : 'Preview Export'}
              </Button>
              <Button 
                onClick={downloadExport} 
                disabled={isExporting || !filters.startDate || !filters.endDate}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Download CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <div className="space-y-6">
          {preview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Export Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Leads Found:</span>
                    <span className="font-semibold">{preview.count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Date Range:</span>
                    <span className="font-semibold text-sm">{preview.dateRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className="font-semibold capitalize">{filters.status || 'All'}</span>
                  </div>
                  {filters.listId && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">List ID:</span>
                      <span className="font-semibold text-sm">{filters.listId}</span>
                    </div>
                  )}
                </div>
                
                {preview.count === 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      No leads found with the current filters. Try adjusting your date range or filters.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Use</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Select your desired date range</p>
              <p>2. Choose lead status (default: accepted)</p>
              <p>3. Optionally filter by List ID or Publisher</p>
              <p>4. Click "Preview Export" to see lead count</p>
              <p>5. Click "Download CSV" to export</p>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-blue-800 font-medium text-xs">
                  💡 Tip: The export includes all lead data including contact info, 
                  TrustedForm certificates, and compliance status perfect for publisher reports.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
