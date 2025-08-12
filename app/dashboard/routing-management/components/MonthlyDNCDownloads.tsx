'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Calendar, FileText, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface MonthlyExport {
  list_id: string
  total_leads: number
  dnc_matches: number
  dnc_rate: string
  processed_at: string
}

interface MonthData {
  year: number
  month: number
  month_name: string
  lists: MonthlyExport[]
}

interface MonthlyDNCDownloadsProps {
  className?: string
}

export default function MonthlyDNCDownloads({ className }: MonthlyDNCDownloadsProps) {
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadMonthlyData()
  }, [])

  const loadMonthlyData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/monthly-dnc-exports')
      const result = await response.json()

      if (result.success) {
        setMonthlyData(result.data.available_months || [])
      } else {
        throw new Error(result.error || 'Failed to load monthly DNC data')
      }
    } catch (error) {
      console.error('Error loading monthly DNC data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load monthly DNC export data',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadDNCExport = async (listId: string, year: number, month: number) => {
    const downloadKey = `${listId}-${year}-${month}`
    
    try {
      setDownloadingItems(prev => new Set(prev.add(downloadKey)))

      const url = `/api/monthly-dnc-exports?list_id=${listId}&year=${year}&month=${month}&format=csv`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to download DNC export: ${response.statusText}`)
      }

      // Create download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `dnc-export-${listId}-${year}-${month.toString().padStart(2, '0')}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast({
        title: 'Download Started',
        description: `DNC export for ${listId} (${year}-${month.toString().padStart(2, '0')}) is downloading...`
      })

    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download DNC export',
        variant: 'destructive'
      })
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(downloadKey)
        return newSet
      })
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly DNC Exports
          </CardTitle>
          <CardDescription>
            Loading pre-computed monthly DNC exports...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Monthly DNC Exports
        </CardTitle>
        <CardDescription>
          Download pre-computed DNC exports by month and list ID. Exports are automatically generated on the 5th of each month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {monthlyData.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No monthly DNC exports available yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Exports are generated automatically on the 5th of each month for the previous month's data.
            </p>
          </div>
        ) : (
          monthlyData.map((monthData) => (
            <div key={`${monthData.year}-${monthData.month}`} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{monthData.month_name}</h3>
                <Badge variant="outline">
                  {monthData.lists.length} List{monthData.lists.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {monthData.lists.map((listExport) => {
                  const downloadKey = `${listExport.list_id}-${monthData.year}-${monthData.month}`
                  const isDownloading = downloadingItems.has(downloadKey)
                  
                  return (
                    <div
                      key={listExport.list_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {listExport.list_id}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {listExport.total_leads.toLocaleString()} leads • {' '}
                          {listExport.dnc_matches.toLocaleString()} DNCs • {' '}
                          {listExport.dnc_rate}% DNC rate
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Processed: {formatDate(listExport.processed_at)}
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDNCExport(
                          listExport.list_id,
                          monthData.year,
                          monthData.month
                        )}
                        disabled={isDownloading}
                        className="ml-4"
                      >
                        {isDownloading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                            CSV
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">How Monthly DNC Exports Work:</p>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• Exports are automatically generated on the 5th of each month</li>
                <li>• Each export contains DNCs for the previous month's leads</li>
                <li>• All phone numbers are checked against Internal and Synergy DNC lists</li>
                <li>• Return reason is always "user claimed to never have opted in"</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMonthlyData}
            disabled={isLoading}
          >
            Refresh Data
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
