'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  CheckCircle,
  Loader2,
  Calendar,
  Play,
  RefreshCw,
  Info
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface ListActivity {
  list_id: string
  partner_name: string
  friendly_name: string
  description: string
  total_leads: number
  first_lead_date: string
  last_lead_date: string
  last_dnc_scrub_date: string | null
  last_dnc_rate: string | null
  scrub_status: 'ready' | 'running' | 'completed' | 'failed'
  dnc_matches: number | null
  dnc_rate: string | null
}

interface ListActivityResponse {
  success: boolean
  date_range: string
  lists: ListActivity[]
  total_lists: number
  total_leads: number
}

export default function BulkDNCScrubPage() {
  // Date range state (default to previous month)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
    
    return {
      start: prevMonth.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    }
  })
  
  // List activity state
  const [listActivity, setListActivity] = useState<ListActivity[]>([])
  const [isLoadingLists, setIsLoadingLists] = useState(false)
  const [totalStats, setTotalStats] = useState({ total_lists: 0, total_leads: 0 })

  // Load list activity when date range changes
  useEffect(() => {
    loadListActivity()
  }, [dateRange])

  const loadListActivity = async () => {
    setIsLoadingLists(true)
    try {
      const response = await fetch('/api/list-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateRange.start,
          end_date: dateRange.end
        })
      })

      if (!response.ok) {
        throw new Error('Failed to load list activity')
      }

      const data: ListActivityResponse = await response.json()
      setListActivity(data.lists)
      setTotalStats({
        total_lists: data.total_lists,
        total_leads: data.total_leads
      })

      toast({
        title: 'Lists Loaded',
        description: `Found ${data.total_lists} active lists with ${data.total_leads} total leads`
      })
    } catch (error) {
      console.error('Error loading list activity:', error)
      toast({
        title: 'Error',
        description: 'Failed to load list activity',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingLists(false)
    }
  }

  const runDNCScrubForList = async (listId: string) => {
    // Update list status to running
    setListActivity(prev => prev.map(list => 
      list.list_id === listId 
        ? { ...list, scrub_status: 'running', dnc_matches: null, dnc_rate: null }
        : list
    ))

    try {
      const response = await fetch('/api/list-dnc-scrub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: listId,
          start_date: dateRange.start,
          end_date: dateRange.end
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process DNC scrub')
      }

      const data = await response.json()
      
      // Update list with results
      setListActivity(prev => prev.map(list => 
        list.list_id === listId 
          ? { 
              ...list, 
              scrub_status: 'completed',
              dnc_matches: data.total_dnc_matches,
              dnc_rate: data.overall_dnc_rate,
              last_dnc_scrub_date: new Date().toISOString()
            }
          : list
      ))

      toast({
        title: 'DNC Scrub Complete',
        description: `List ${listId}: ${data.total_dnc_matches} DNC matches found (${data.overall_dnc_rate})`
      })
    } catch (error) {
      console.error('Error running DNC scrub:', error)
      
      // Update list status to failed
      setListActivity(prev => prev.map(list => 
        list.list_id === listId 
          ? { ...list, scrub_status: 'failed' }
          : list
      ))
      
      toast({
        title: 'Error',
        description: `Failed to run DNC scrub for list ${listId}`,
        variant: 'destructive'
      })
    }
  }

  const downloadCSVForList = async (listId: string) => {
    try {
      const response = await fetch('/api/list-dnc-scrub/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: listId,
          start_date: dateRange.start,
          end_date: dateRange.end
        })
      })

      if (!response.ok) {
        throw new Error('CSV download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dnc-scrub-${listId}-${dateRange.start}-${dateRange.end}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: 'CSV Downloaded',
        description: `DNC scrub results for List ${listId} have been downloaded`
      })
    } catch (error) {
      console.error('CSV download error:', error)
      toast({
        title: 'Error',
        description: `Failed to download CSV for List ${listId}`,
        variant: 'destructive'
      })
    }
  }

  const truncateListId = (listId: string) => {
    if (listId.length <= 20) return listId
    return listId.substring(0, 17) + '...'
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bulk Monthly DNC Scrub</h1>
          <p className="text-muted-foreground mt-1">
            Process multiple List IDs against internal DNC for any date range
          </p>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range Selection
          </CardTitle>
          <CardDescription>
            Select date range to find List IDs with activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              onClick={loadListActivity}
              disabled={isLoadingLists}
              variant="outline"
            >
              {isLoadingLists ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Lists
            </Button>
            
            <div className="text-sm text-muted-foreground">
              Found: <strong>{totalStats.total_lists}</strong> lists with <strong>{totalStats.total_leads.toLocaleString()}</strong> total leads
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active List IDs ({dateRange.start} to {dateRange.end})</CardTitle>
          <CardDescription>
            Run DNC scrub and download results for each list
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLists ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading active lists...</span>
            </div>
          ) : listActivity.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No lists found with activity in the selected date range. Try adjusting the dates.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Partner/List Name</th>
                    <th className="text-left p-2 font-medium">List ID</th>
                    <th className="text-left p-2 font-medium">Total Leads</th>
                    <th className="text-left p-2 font-medium">Last DNC Scrub</th>
                    <th className="text-left p-2 font-medium">DNC Rate</th>
                    <th className="text-left p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listActivity.map((list) => (
                    <tr key={list.list_id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="font-medium">
                          {list.friendly_name || list.partner_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {list.description || 'No description'}
                        </div>
                      </td>
                      <td className="p-2">
                        <div 
                          className="font-mono text-sm cursor-help" 
                          title={list.list_id}
                        >
                          {truncateListId(list.list_id)}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{list.total_leads.toLocaleString()}</div>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">
                          {list.last_dnc_scrub_date 
                            ? new Date(list.last_dnc_scrub_date).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </td>
                      <td className="p-2">
                        <div>
                          {list.scrub_status === 'completed' && list.dnc_rate ? (
                            <Badge variant="secondary">{list.dnc_rate}</Badge>
                          ) : list.last_dnc_rate ? (
                            <Badge variant="outline">{list.last_dnc_rate}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => runDNCScrubForList(list.list_id)}
                            disabled={list.scrub_status === 'running'}
                            variant={list.scrub_status === 'completed' ? 'outline' : 'default'}
                          >
                            {list.scrub_status === 'running' ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="mr-1 h-3 w-3" />
                            )}
                            {list.scrub_status === 'running' ? 'Running...' : 'Run DNC Scrub'}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadCSVForList(list.list_id)}
                            disabled={list.scrub_status !== 'completed'}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            CSV
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
