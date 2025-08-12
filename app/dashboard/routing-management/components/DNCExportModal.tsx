'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Download, Calendar, FileText, AlertCircle, Zap } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { createClient } from '@supabase/supabase-js'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface DNCExportModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Partner {
  id: string
  name: string
}

interface Integration {
  id: string
  list_id: string
  partner_name: string
  integration_type: string
}

interface ExportProgress {
  current: number
  total: number
  percentage: number
  status: 'preparing' | 'exporting' | 'complete' | 'error'
  message: string
}

export default function DNCExportModal({ isOpen, onClose }: DNCExportModalProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [filteredIntegrations, setFilteredIntegrations] = useState<Integration[]>([])
  const [selectedPartner, setSelectedPartner] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  
  const [formData, setFormData] = useState({
    list_id: '',
    start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    format: 'csv'
  })

  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    }
  }, [isOpen])

  // Get preview count when filters change
  useEffect(() => {
    if (formData.list_id || (formData.start_date && formData.end_date)) {
      getPreviewCount()
    }
  }, [formData.list_id, formData.start_date, formData.end_date])

  const loadInitialData = async () => {
    try {
      // Load partners and integrations
      const [partnersResult, integrationsResult] = await Promise.all([
        supabase.from('partners').select('id, name').eq('active', true).order('name'),
        supabase.from('partner_integrations').select(`
          id,
          list_id,
          integration_type,
          partners!inner(name)
        `).eq('active', true)
      ])

      if (partnersResult.error) throw partnersResult.error
      if (integrationsResult.error) throw integrationsResult.error

      setPartners(partnersResult.data || [])
      
      const integrationsWithNames = (integrationsResult.data || []).map((integration: any) => ({
        id: integration.id,
        list_id: integration.list_id,
        partner_name: integration.partners?.name || 'Unknown',
        integration_type: integration.integration_type
      }))
      
      setIntegrations(integrationsWithNames)
      setFilteredIntegrations(integrationsWithNames)

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoadingData(false)
    }
  }

  const getPreviewCount = async () => {
    if (!formData.list_id && !formData.start_date) return

    try {
      const params = new URLSearchParams()
      if (formData.list_id) params.append('list_id', formData.list_id)
      if (formData.start_date) params.append('start_date', formData.start_date)
      if (formData.end_date) params.append('end_date', formData.end_date)
      params.append('page', '1')
      params.append('limit', '1') // Just get count, not actual data

      const response = await fetch(`/api/dnc/export?${params.toString()}`)
      const result = await response.json()
      
      if (result.success) {
        // Fix: Read total_count from metadata object, not root level
        setPreviewCount(result.metadata?.total_count || 0)
      }
    } catch (error) {
      console.error('Failed to get preview count:', error)
    }
  }

  const handleExport = async () => {
    if (!formData.list_id && !formData.start_date) {
      toast({
        title: "Validation Error",
        description: "Please select a list ID or date range",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setExportProgress({
      current: 0,
      total: previewCount || 1000,
      percentage: 0,
      status: 'preparing',
      message: 'Preparing export...'
    })

    try {
      // For smaller exports (< 10k), use simple export
      if ((previewCount || 0) < 10000) {
        await handleSimpleExport()
      } else {
        await handleLargeExport()
      }
    } catch (error: any) {
      console.error('Export error:', error)
      toast({
        title: "Export Error",
        description: error.message || "Failed to export DNC entries",
        variant: "destructive",
      })
      setExportProgress(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSimpleExport = async () => {
    const params = new URLSearchParams()
    if (formData.list_id) params.append('list_id', formData.list_id)
    if (formData.start_date) params.append('start_date', formData.start_date)
    if (formData.end_date) params.append('end_date', formData.end_date)
    params.append('format', formData.format)
    params.append('limit', '50000') // Higher limit for simple export

    const response = await fetch(`/api/dnc/export?${params.toString()}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Export failed')
    }

    // Create and download file
    const filename = `dnc_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}`
    
    if (formData.format === 'csv') {
      // Convert to CSV
      const csvData = convertToCSV(result.data)
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } else {
      // JSON download
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }

    setExportProgress({
      current: previewCount || 1,
      total: previewCount || 1,
      percentage: 100,
      status: 'complete',
      message: `Successfully exported ${previewCount || 0} DNC entries`
    })

    toast({
      title: "Export Complete",
      description: `Downloaded ${previewCount || 0} DNC entries`,
    })
  }

  const handleLargeExport = async () => {
    // For very large exports, use chunked processing
    const totalCount = previewCount || 0
    const chunkSize = 50000 // 50k chunks for max speed
    const totalPages = Math.ceil(totalCount / chunkSize)
    const allData: any[] = []

    setExportProgress({
      current: 0,
      total: totalCount,
      percentage: 0,
      status: 'exporting',
      message: `Processing ${totalCount.toLocaleString()} records in ${totalPages} chunks...`
    })

    // Process chunks in parallel (3 at a time for speed)
    const concurrentChunks = 3
    for (let i = 0; i < totalPages; i += concurrentChunks) {
      const chunkPromises = []
      
      for (let j = 0; j < concurrentChunks && (i + j) < totalPages; j++) {
        const page = i + j + 1
        chunkPromises.push(fetchChunk(page, chunkSize))
      }
      
      const chunkResults = await Promise.all(chunkPromises)
      chunkResults.forEach(result => {
        if (result.data) allData.push(...result.data)
      })

      // Update progress
      const processed = Math.min((i + concurrentChunks) * chunkSize, totalCount)
      setExportProgress({
        current: processed,
        total: totalCount,
        percentage: Math.round((processed / totalCount) * 100),
        status: 'exporting',
        message: `Processed ${processed.toLocaleString()} of ${totalCount.toLocaleString()} records...`
      })
    }

    // Create download
    const filename = `dnc_export_large_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}`
    const recordCount = previewCount ? `_${previewCount.toLocaleString()}records` : ''
    
    if (formData.format === 'csv') {
      const csvData = convertToCSV(allData)
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}${recordCount}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } else {
      // JSON download
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}${recordCount}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }

    setExportProgress({
      current: totalCount,
      total: totalCount,
      percentage: 100,
      status: 'complete',
      message: `Successfully exported ${totalCount} DNC entries`
    })

    toast({
      title: "Large Export Complete",
      description: `Downloaded ${totalCount} DNC entries in ${totalPages} chunks`,
    })
  }

  const fetchChunk = async (page: number, limit: number) => {
    const params = new URLSearchParams()
    if (formData.list_id) params.append('list_id', formData.list_id)
    if (formData.start_date) params.append('start_date', formData.start_date)
    if (formData.end_date) params.append('end_date', formData.end_date)
    params.append('page', page.toString())
    params.append('limit', limit.toString())

    const response = await fetch(`/api/dnc/export?${params.toString()}`)
    return await response.json()
  }

  const convertToCSV = (data: any[]) => {
    if (!data || data.length === 0) return 'No data'

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header] || ''
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        }).join(',')
      )
    ].join('\n')

    return csvContent
  }

  const handlePartnerSearch = (value: string) => {
    setSelectedPartner(value)
    if (value) {
      setFilteredIntegrations(
        integrations.filter(integration => 
          integration.partner_name.toLowerCase().includes(value.toLowerCase())
        )
      )
    } else {
      setFilteredIntegrations(integrations)
    }
  }

  const getDateRangePresets = () => [
    {
      label: "Last Month",
      start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
    },
    {
      label: "This Month",
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    },
    {
      label: "Last 30 Days",
      start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export DNC Returns
          </DialogTitle>
          <DialogDescription>
            Download DNC entries for partner reconciliation and invoice credits.
            Optimized for large datasets (tens of thousands of records).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Partner/Campaign Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partner_search">Search Partners</Label>
              <Input
                id="partner_search"
                value={selectedPartner}
                onChange={(e) => handlePartnerSearch(e.target.value)}
                placeholder="Type partner name..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="list_id">Campaign/List ID</Label>
              <Select value={formData.list_id} onValueChange={(value) => setFormData({ ...formData, list_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign/list..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.list_id}>
                      <div className="flex items-center gap-2">
                        <span>{integration.list_id.substring(0, 8)}...</span>
                        <span className="text-sm">{integration.partner_name}</span>
                        <Badge variant="outline">{integration.integration_type}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Date Range</Label>
              <div className="flex gap-2">
                {getDateRangePresets().map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({
                      ...formData,
                      start_date: preset.start,
                      end_date: preset.end
                    })}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Export Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Export Preview</div>
                  <div className="text-sm text-muted-foreground">
                    {previewCount !== null ? (
                      previewCount > 0 ? 
                        `${previewCount.toLocaleString()} DNC entries found` : 
                        'No DNC entries found for these criteria'
                    ) : 'Select criteria to preview'}
                    {previewCount && previewCount > 10000 && (
                      <Badge variant="outline" className="ml-2">Large Export</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={formData.format} onValueChange={(value) => setFormData({ ...formData, format: value })}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Performance Info */}
            {previewCount && previewCount > 50000 && (
              <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <strong>⚡ Ultra-Fast Export:</strong> Processing {previewCount.toLocaleString()} records 
                    with aggressive 50k chunks + parallel processing. Estimated time: ~{Math.ceil(previewCount / 150000)} minutes.
                  </div>
                </div>
              </div>
            )}

            {previewCount && previewCount > 10000 && previewCount <= 50000 && (
              <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="text-sm">
                    <strong>🚀 Fast Export:</strong> {previewCount.toLocaleString()} records will be processed 
                    in optimized chunks for maximum download speed.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Progress */}
          {exportProgress && (
            <div className="space-y-3">
              <Progress value={exportProgress.percentage} className="w-full" />
              <div className="text-sm text-muted-foreground">
                {exportProgress.message}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              disabled={isLoading || previewCount === 0 || (!formData.list_id && !formData.start_date)}
              className="flex items-center gap-2"
            >
              {isLoading ? 'Exporting...' : `Export ${previewCount ? previewCount.toLocaleString() : ''} DNCs`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
