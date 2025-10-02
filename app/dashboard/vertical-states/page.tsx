'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { MapPin, Check, X, Save, RefreshCw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const dynamic = 'force-dynamic'

interface StateConfig {
  vertical: string
  state_code: string
  is_allowed: boolean
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

const VERTICALS = ['ACA', 'Final Expense', 'Medicare']

const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming'
}

export default function VerticalStatesPage() {
  const [selectedVertical, setSelectedVertical] = useState<string>('ACA')
  const [stateConfigs, setStateConfigs] = useState<StateConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedStates, setEditedStates] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [listIds, setListIds] = useState<any[]>([])
  const [loadingListIds, setLoadingListIds] = useState(false)

  useEffect(() => {
    fetchStateConfigs(selectedVertical)
    fetchListIdsForVertical(selectedVertical)
  }, [selectedVertical])

  const fetchStateConfigs = async (vertical: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/vertical-states?vertical=${vertical}`)
      const result = await response.json()

      console.log('Vertical states API response:', result)

      if (result.success) {
        setStateConfigs(result.data || [])
        console.log('Loaded state configs:', result.data?.length || 0)
      } else {
        console.error('API error:', result.error)
        toast({
          title: 'Error',
          description: result.error || 'Failed to load state configurations',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching state configs:', error)
      toast({
        title: 'Error',
        description: 'Failed to load state configurations. The database table may not exist yet.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchListIdsForVertical = async (vertical: string) => {
    try {
      setLoadingListIds(true)
      const response = await fetch(`/api/list-routings/enriched`)
      const result = await response.json()

      if (result.success) {
        // Filter list routings by vertical
        const filtered = result.data.filter((item: any) => item.vertical === vertical)
        setListIds(filtered)
      }
    } catch (error) {
      console.error('Error fetching list IDs:', error)
    } finally {
      setLoadingListIds(false)
    }
  }

  const handleToggleState = (stateCode: string, currentValue: boolean) => {
    setStateConfigs(prev => 
      prev.map(config => 
        config.state_code === stateCode 
          ? { ...config, is_allowed: !currentValue }
          : config
      )
    )
    setEditedStates(prev => new Set(prev).add(stateCode))
  }

  const handleNotesChange = (stateCode: string, notes: string) => {
    setStateConfigs(prev => 
      prev.map(config => 
        config.state_code === stateCode 
          ? { ...config, notes }
          : config
      )
    )
    setEditedStates(prev => new Set(prev).add(stateCode))
  }

  const handleSaveChanges = async () => {
    if (editedStates.size === 0) {
      toast({
        title: 'No Changes',
        description: 'No changes to save',
      })
      return
    }

    try {
      setSaving(true)
      
      const statesToUpdate = stateConfigs
        .filter(config => editedStates.has(config.state_code))
        .map(config => ({
          state_code: config.state_code,
          is_allowed: config.is_allowed,
          notes: config.notes
        }))

      const response = await fetch('/api/vertical-states', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical: selectedVertical,
          states: statesToUpdate
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: `Updated ${result.updated} state configurations`,
        })
        setEditedStates(new Set())
        fetchStateConfigs(selectedVertical)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save changes',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error saving state configs:', error)
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBulkToggle = (enable: boolean) => {
    const filteredStates = getFilteredStates()
    setStateConfigs(prev => 
      prev.map(config => 
        filteredStates.some(s => s.state_code === config.state_code)
          ? { ...config, is_allowed: enable }
          : config
      )
    )
    filteredStates.forEach(state => {
      setEditedStates(prev => new Set(prev).add(state.state_code))
    })
  }

  const getFilteredStates = () => {
    if (!searchFilter) return stateConfigs
    
    const lowerFilter = searchFilter.toLowerCase()
    return stateConfigs.filter(config => 
      config.state_code.toLowerCase().includes(lowerFilter) ||
      STATE_NAMES[config.state_code]?.toLowerCase().includes(lowerFilter)
    )
  }

  const allowedCount = stateConfigs.filter(s => s.is_allowed).length
  const totalCount = stateConfigs.length

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8 text-blue-500" />
            Vertical State Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure which states are allowed for each vertical
          </p>
        </div>
        <Button
          onClick={() => fetchStateConfigs(selectedVertical)}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={selectedVertical} onValueChange={setSelectedVertical}>
        <TabsList className="grid w-full grid-cols-3">
          {VERTICALS.map(vertical => (
            <TabsTrigger key={vertical} value={vertical}>
              {vertical}
            </TabsTrigger>
          ))}
        </TabsList>

        {VERTICALS.map(vertical => (
          <TabsContent key={vertical} value={vertical} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total States</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Allowed States</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{allowedCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Blocked States</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{totalCount - allowedCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">List IDs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{listIds.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>List IDs for {vertical} Vertical</CardTitle>
                <CardDescription>
                  All list routings associated with this vertical
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingListIds ? (
                  <div className="text-center py-4">Loading list IDs...</div>
                ) : listIds.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No list IDs found for this vertical
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {listIds.map((item) => (
                      <div key={item.list_id} className="p-3 border rounded-lg">
                        <div className="font-mono text-sm font-semibold">{item.list_id}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Badge variant={item.active ? "default" : "secondary"} className="text-xs">
                            {item.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {item.dialer_type && (
                            <Badge variant="outline" className="text-xs">
                              Dialer: {item.dialer_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>State Configuration</CardTitle>
                    <CardDescription>
                      Toggle states on/off for {vertical} vertical
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleBulkToggle(true)}
                      variant="outline"
                      size="sm"
                    >
                      Enable All
                    </Button>
                    <Button
                      onClick={() => handleBulkToggle(false)}
                      variant="outline"
                      size="sm"
                    >
                      Disable All
                    </Button>
                    <Button
                      onClick={handleSaveChanges}
                      disabled={saving || editedStates.size === 0}
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes {editedStates.size > 0 && `(${editedStates.size})`}
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search states..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">State Code</TableHead>
                          <TableHead>State Name</TableHead>
                          <TableHead className="w-[120px]">Status</TableHead>
                          <TableHead className="w-[100px]">Allowed</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredStates().map((config) => (
                          <TableRow 
                            key={config.state_code}
                            className={editedStates.has(config.state_code) ? 'bg-yellow-50' : ''}
                          >
                            <TableCell className="font-mono font-bold">
                              {config.state_code}
                            </TableCell>
                            <TableCell>{STATE_NAMES[config.state_code]}</TableCell>
                            <TableCell>
                              {config.is_allowed ? (
                                <Badge className="bg-green-500">
                                  <Check className="h-3 w-3 mr-1" />
                                  Allowed
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <X className="h-3 w-3 mr-1" />
                                  Blocked
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={config.is_allowed}
                                onCheckedChange={() => handleToggleState(config.state_code, config.is_allowed)}
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={config.notes || ''}
                                onChange={(e) => handleNotesChange(config.state_code, e.target.value)}
                                placeholder="Add notes..."
                                className="min-h-[60px] text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
