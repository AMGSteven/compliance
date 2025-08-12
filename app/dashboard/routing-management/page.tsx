'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Settings, Users, ListIcon, Plus, Edit2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { createClient } from '@supabase/supabase-js'
import DNCExportModal from './components/DNCExportModal'
import MonthlyDNCDownloads from './components/MonthlyDNCDownloads'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface Partner {
  id: string
  name: string
  active: boolean
}

interface Integration {
  id: string
  list_id: string
  integration_type: string
  partner_name: string
  active: boolean
  description?: string
  bid?: number
  dialer_type?: number
  vertical?: string
}

export default function RoutingManagementPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showDNCExport, setShowDNCExport] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null)
  const [newDialerType, setNewDialerType] = useState<string>('')
  const [updatingDialer, setUpdatingDialer] = useState(false)
  const [verticalConfigs, setVerticalConfigs] = useState<any[]>([])
  const [editingVerticalConfig, setEditingVerticalConfig] = useState<any>(null)
  const [editingListVertical, setEditingListVertical] = useState<Integration | null>(null)
  const [newVertical, setNewVertical] = useState<string>('')
  const [updatingVertical, setUpdatingVertical] = useState(false)
  const [editingWeights, setEditingWeights] = useState<Integration | null>(null)
  const [routingWeights, setRoutingWeights] = useState<any[]>([])  
  const [weightConfig, setWeightConfig] = useState<{ dialer_type: number; weight_percentage: number }[]>([])  
  const [updatingWeights, setUpdatingWeights] = useState(false)
  const [dialerApprovals, setDialerApprovals] = useState<any[]>([])
  const [dialerTypes, setDialerTypes] = useState<any[]>([])
  const [editingDialerType, setEditingDialerType] = useState<any | null>(null)
  const [savingDialerType, setSavingDialerType] = useState(false)
  const [editingApproval, setEditingApproval] = useState<{ integration: Integration; dialer_type: number } | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<boolean>(true)
  const [approvalReason, setApprovalReason] = useState<string>('')
  const [updatingApproval, setUpdatingApproval] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  useEffect(() => {
    loadData()
    loadVerticalConfigs()
    loadDialerApprovals()
    loadDialerTypes()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, name, active')
        .order('name')

      if (partnersError) throw partnersError

      // Load list routings and map them to partners based on known campaigns
      const { data: listRoutingsData, error: listRoutingsError } = await supabase
        .from('list_routings')
        .select('*')
        .order('created_at', { ascending: false })

      if (listRoutingsError) throw listRoutingsError

      setPartners(partnersData || [])
      
      console.log('Partners from database:', partnersData)
      
      // Map list routings to integrations with partner names
      const integrationsWithNames = (listRoutingsData || []).map((routing: any) => {
        let partnerName = 'Unknown'
        let integrationType = 'campaign'
        
        console.log('Processing routing:', routing.list_id, routing.description, routing.dialer_type, routing.active)
        
        // Map campaigns to partners based on actual database data
        const desc = routing.description?.toLowerCase() || ''
        
        // Specific List ID mappings first
        if (routing.list_id === 'pitch-bpo-list-1750720674171') {
          partnerName = 'iExecute'
          integrationType = 'pitch_bpo'
        } else if ([
          'a5e7700e-6525-4401-9ef7-aa1bff188f12',
          'pitch-bpo-list-1753907657505'
        ].includes(routing.list_id)) {
          partnerName = 'OPG'
          integrationType = 'pitch_bpo'
        }
        // Description-based matching for all other campaigns
        else if (desc.includes('employers')) {
          partnerName = 'Employers.io'
          integrationType = routing.dialer_type === 2 ? 'pitch_bpo' : 'internal_dialer'
        } else if (desc.includes('fluent')) {
          partnerName = 'Fluent'
          integrationType = 'internal_dialer'
        } else if (desc.includes('citadel')) {
          partnerName = 'Citadel'
          integrationType = routing.dialer_type === 2 ? 'pitch_bpo' : 'internal_dialer'
        } else if (desc.includes('onpoint') || desc.includes('opg')) {
          partnerName = 'Onpoint'
          integrationType = routing.dialer_type === 2 ? 'pitch_bpo' : 'internal_dialer'
        } else if (desc.includes('shift44')) {
          partnerName = 'Shift44'
          integrationType = routing.dialer_type === 2 ? 'pitch_bpo' : 'internal_dialer'
        } else if (desc.includes('top of funnel') || desc.includes('topfunnel')) {
          partnerName = 'Top of Funnel'
          integrationType = 'internal_dialer'
        } else if (desc.includes('pushnami')) {
          partnerName = 'Pushnami'
          integrationType = routing.dialer_type === 2 ? 'pitch_bpo' : 'internal_dialer'
        } else if (desc.includes('interest media')) {
          partnerName = 'Interest Media'
          integrationType = routing.dialer_type === 2 ? 'pitch_bpo' : 'internal_dialer'
        } else if (desc.includes('what if media')) {
          partnerName = 'What If Media'
          integrationType = 'internal_dialer'
        } else if (desc.includes('flex mg')) {
          partnerName = 'Flex MG'
          integrationType = 'internal_dialer'
        } else if (desc.includes('iexcecute') || desc.includes('iexecute')) {
          partnerName = 'iExecute'
          integrationType = 'pitch_bpo'
        } else if (desc.includes('launch')) {
          partnerName = 'Launch Potato'
          integrationType = 'internal_dialer'
        } else if (desc.includes('juiced')) {
          partnerName = 'Juiced Media'
          integrationType = 'internal_dialer'
        }
        // Handle specific List IDs that might not match description patterns
        else if ([
          'cd86b81c-1c76-4639-b287-d482bb215dfe',
          'fd248dab-3ecd-48db-9ac5-212b4b6e0fcc',
          'pitch-bpo-list-1753911011048',
          'pitch-bpo-list-1753910993210'
        ].includes(routing.list_id)) {
          partnerName = 'Ifficent'
          integrationType = 'pitch_bpo'
        }
        // Fallback to dialer type classification
        else if (routing.dialer_type === 3) {
          partnerName = 'Convoso'
          integrationType = 'health_insurance'
        } else if (routing.dialer_type === 2) {
          partnerName = 'Pitch BPO'
          integrationType = 'pitch_bpo'
        } else if (routing.dialer_type === 1) {
          partnerName = 'Internal Dialer'
          integrationType = 'internal_dialer'
        }
        
        return {
          id: routing.id,
          list_id: routing.list_id,
          partner_name: partnerName,
          integration_type: integrationType,
          active: routing.active,
          description: routing.description,
          bid: routing.bid,
          dialer_type: routing.dialer_type
        }
      })
      
      setIntegrations(integrationsWithNames)
      
      console.log('Final integrations mapped:', integrationsWithNames.map(i => ({ partner: i.partner_name, list_id: i.list_id })))
      console.log('Partners available for matching:', partnersData?.map(p => ({ id: p.id, name: p.name })))

    } catch (error: any) {
      console.error('Error loading data:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load routing data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getIntegrationTypeBadge = (type: string) => {
    const colors = {
      'on_hours': 'bg-green-100 text-green-800',
      'off_hours': 'bg-blue-100 text-blue-800', 
      'aged': 'bg-yellow-100 text-yellow-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const loadVerticalConfigs = async () => {
    try {
      const response = await fetch('/api/vertical-configs')
      const data = await response.json()
      
      if (response.ok) {
        setVerticalConfigs(data.configs || [])
      } else {
        console.error('Error loading vertical configs:', data.error)
      }
    } catch (error) {
      console.error('Error loading vertical configs:', error)
    }
  }

  const loadDialerApprovals = async () => {
    try {
      const response = await fetch('/api/dialer-approvals')
      const data = await response.json()
      
      if (response.ok) {
        setDialerApprovals(data.data || [])
      } else {
        console.error('Error loading dialer approvals:', data.error)
      }
    } catch (error) {
      console.error('Error loading dialer approvals:', error)
    }
  }

  const loadDialerTypes = async () => {
    try {
      const res = await fetch('/api/dialer-types')
      const data = await res.json()
      if (res.ok) setDialerTypes(data.dialers || [])
    } catch (e) {
      console.error('Failed to load dialer types', e)
    }
  }

  const getPartnerIntegrations = (partnerId: string) => {
    return integrations.filter(integration => 
      partners.find(p => p.name === integration.partner_name)?.id === partnerId
    )
  }

  const handleEditDialer = (integration: Integration) => {
    setEditingIntegration(integration)
    setNewDialerType(integration.dialer_type?.toString() || '1')
  }

  const handleUpdateDialer = async () => {
    if (!editingIntegration || !newDialerType) return
    
    try {
      setUpdatingDialer(true)
      
      const { error } = await supabase
        .from('list_routings')
        .update({ dialer_type: parseInt(newDialerType) })
        .eq('list_id', editingIntegration.list_id)
      
      if (error) throw error
      
      toast({
        title: "Success",
        description: `Dialer updated for ${editingIntegration.list_id}`,
      })
      
      // Reload data to reflect changes
      await loadData()
      setEditingIntegration(null)
      
    } catch (error: any) {
      console.error('Error updating dialer:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update dialer",
        variant: "destructive",
      })
    } finally {
      setUpdatingDialer(false)
    }
  }

  const getDialerTypeLabel = (dialerType: number) => {
    const t = dialerTypes.find((d: any) => d.id === dialerType)
    if (t) return t.name
    switch (dialerType) { case 1: return 'Internal Dialer'; case 2: return 'Pitch BPO'; case 3: return 'Convoso (Health Insurance)'; default: return 'Unknown' }
  }

  const getDialerTypeColor = (dialerType: number) => {
    const t = dialerTypes.find((d: any) => d.id === dialerType)
    if (t?.default_color) return t.default_color
    switch (dialerType) { case 1: return 'bg-blue-100 text-blue-800'; case 2: return 'bg-orange-100 text-orange-800'; case 3: return 'bg-green-100 text-green-800'; default: return 'bg-gray-100 text-gray-800' }
  }

  const handleEditListVertical = (integration: Integration) => {
    setEditingListVertical(integration)
    setNewVertical(integration.vertical || 'ACA')
  }

  const handleUpdateListVertical = async () => {
    if (!editingListVertical || !newVertical) return
    
    try {
      setUpdatingVertical(true)
      
      const response = await fetch('/api/vertical-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: editingListVertical.list_id,
          vertical: newVertical
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      
      toast({
        title: "Success",
        description: `Vertical updated for ${editingListVertical.list_id}`,
      })
      
      // Reload data to reflect changes
      await loadData()
      setEditingListVertical(null)
      
    } catch (error: any) {
      console.error('Error updating vertical:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update vertical",
        variant: "destructive",
      })
    } finally {
      setUpdatingVertical(false)
    }
  }

  const handleEditVerticalConfig = (config: any) => {
    setEditingVerticalConfig({ ...config })
  }

  const handleUpdateVerticalConfig = async () => {
    if (!editingVerticalConfig) return
    
    try {
      const response = await fetch('/api/vertical-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical: editingVerticalConfig.vertical,
          dialer_type: editingVerticalConfig.dialer_type,
          campaign_id: editingVerticalConfig.campaign_id || null,
          cadence_id: editingVerticalConfig.cadence_id || null,
          token: editingVerticalConfig.token || null,
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      
      toast({
        title: "Success",
        description: `Configuration updated for ${editingVerticalConfig.vertical}`,
      })
      
      // Reload vertical configs
      await loadVerticalConfigs()
      setEditingVerticalConfig(null)
      
    } catch (error: any) {
      console.error('Error updating vertical config:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      })
    }
  }

  const getVerticalColor = (vertical: string) => {
    switch (vertical) {
      case 'ACA': return 'bg-blue-100 text-blue-800'
      case 'Final Expense': return 'bg-purple-100 text-purple-800'
      case 'Medicare': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getIntegrationsGroupedByVertical = () => {
    const grouped = integrations.reduce((acc, integration) => {
      const vertical = integration.vertical || 'ACA'
      if (!acc[vertical]) acc[vertical] = []
      acc[vertical].push(integration)
      return acc
    }, {} as Record<string, Integration[]>)
    // Ensure verticals with configs but zero list IDs still appear
    const configuredVerticals = Array.from(new Set((verticalConfigs || []).map((c: any) => c.vertical))).filter(Boolean)
    configuredVerticals.forEach((v: string) => {
      if (!grouped[v]) grouped[v] = []
    })
    return grouped
  }

  const getVerticalConfigs = (vertical: string) => {
    const configs = verticalConfigs.filter((config:any) => config.vertical === vertical)
    // Normalize against dialer types so we can render missing ones with an Add button
    const map: Record<number, any> = {}
    configs.forEach((c: any) => { map[c.dialer_type] = c })
    // Prefer existing configs; only add placeholders for truly missing pairs
    const base = (dialerTypes.length ? dialerTypes : [{ id: 1 }, { id: 2 }, { id: 3 }])
    return base.map((dt: any) => map[dt.id] ? map[dt.id] : { id: `${vertical}-${dt.id}-new`, vertical, dialer_type: dt.id, __isNew: true })
  }

  const getDataSourceFromDescription = (description: string | undefined) => {
    if (!description) return 'Unknown'
    
    const desc = description.toLowerCase()
    
    if (desc.includes('on hour')) return 'On Hour'
    if (desc.includes('after hour') || desc.includes('off hour')) return 'After Hour'
    if (desc.includes('aged')) return 'Aged'
    
    return 'Unknown'
  }

  const getIntegrationsGroupedByDataSource = () => {
    const grouped = integrations.reduce((acc, integration) => {
      const dataSource = getDataSourceFromDescription(integration.description)
      if (!acc[dataSource]) acc[dataSource] = []
      acc[dataSource].push(integration)
      return acc
    }, {} as Record<string, Integration[]>)
    
    return grouped
  }

  const getDataSourceColor = (dataSource: string) => {
    switch (dataSource) {
      case 'On Hour':
        return 'bg-green-100 text-green-800'
      case 'After Hour':
        return 'bg-orange-100 text-orange-800'
      case 'Aged':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDataSourceLabel = (dataSource: string) => {
    // Data source is already properly formatted from getDataSourceFromDescription
    return dataSource
  }

  const loadRoutingWeights = async (listId?: string) => {
    try {
      const url = `/api/weighted-routing${listId ? `?list_id=${listId}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok) {
        setRoutingWeights(data.weights || [])
      } else {
        console.error('Error loading routing weights:', data.error)
      }
    } catch (error) {
      console.error('Error loading routing weights:', error)
    }
  }

  const handleConfigureWeights = async (integration: Integration) => {
    setEditingWeights(integration)
    
    // Load existing weights for this list ID
    await loadRoutingWeights(integration.list_id)
    
    // Initialize weight config with existing weights or defaults
    const existingWeights = routingWeights.filter(w => w.list_id === integration.list_id)
    
    if (existingWeights.length > 0) {
      setWeightConfig(existingWeights.map(w => ({
        dialer_type: w.dialer_type,
        weight_percentage: w.weight_percentage
      })))
    } else {
      // Default: 100% to current dialer type
      setWeightConfig([{
        dialer_type: integration.dialer_type || 1,
        weight_percentage: 100
      }])
    }
  }

  const handleAddDialer = () => {
    const availableDialers = [1, 2, 3].filter(d => 
      !weightConfig.some(w => w.dialer_type === d)
    )
    
    if (availableDialers.length > 0) {
      setWeightConfig([...weightConfig, {
        dialer_type: availableDialers[0],
        weight_percentage: 0
      }])
    }
  }

  const handleRemoveDialer = (dialerType: number) => {
    setWeightConfig(weightConfig.filter(w => w.dialer_type !== dialerType))
  }

  const handleWeightChange = (dialerType: number, percentage: number) => {
    setWeightConfig(weightConfig.map(w => 
      w.dialer_type === dialerType 
        ? { ...w, weight_percentage: Math.max(0, Math.min(100, percentage)) }
        : w
    ))
  }

  const handleSaveWeights = async () => {
    if (!editingWeights) return
    
    const totalWeight = weightConfig.reduce((sum, w) => sum + w.weight_percentage, 0)
    
    if (totalWeight !== 100) {
      toast({
        title: "Error",
        description: `Weights must sum to 100%. Current total: ${totalWeight}%`,
        variant: "destructive",
      })
      return
    }
    
    try {
      setUpdatingWeights(true)
      
      const response = await fetch('/api/weighted-routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: editingWeights.list_id,
          weights: weightConfig
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      
      toast({
        title: "Success",
        description: data.message || `Weighted routing configured for ${editingWeights.list_id}`,
      })
      
      // Reload data to reflect changes
      await loadData()
      setEditingWeights(null)
      setWeightConfig([])
      
    } catch (error: any) {
      console.error('Error saving weights:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save weighted routing",
        variant: "destructive",
      })
    } finally {
      setUpdatingWeights(false)
    }
  }

  // Dialer Approval Functions
  const getDialerApprovalStatus = (listId: string, dialerType: number) => {
    const approval = dialerApprovals.find(a => a.list_id === listId && a.dialer_type === dialerType)
    return approval ? approval.approved : true // Default to approved if no record exists
  }

  const handleEditApproval = (integration: Integration, dialerType: number) => {
    const approval = dialerApprovals.find(a => a.list_id === integration.list_id && a.dialer_type === dialerType)
    setEditingApproval({ integration, dialer_type: dialerType })
    setApprovalStatus(approval ? approval.approved : true)
    setApprovalReason(approval ? approval.reason || '' : '')
  }

  const handleSaveApproval = async () => {
    if (!editingApproval) return
    
    try {
      setUpdatingApproval(true)
      
      const response = await fetch('/api/dialer-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: editingApproval.integration.list_id,
          dialer_type: editingApproval.dialer_type,
          approved: approvalStatus,
          reason: approvalReason,
          approved_by: 'admin'
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      
      toast({
        title: "Success",
        description: data.message || `Dialer approval updated for ${editingApproval.integration.list_id}`,
      })
      
      // Reload approvals to reflect changes
      await loadDialerApprovals()
      setEditingApproval(null)
      setApprovalReason('')
      
    } catch (error: any) {
      console.error('Error saving approval:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save dialer approval",
        variant: "destructive",
      })
    } finally {
      setUpdatingApproval(false)
    }
  }

  const handleDisableWeights = async (listId: string) => {
    try {
      const response = await fetch(`/api/weighted-routing?list_id=${listId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      
      toast({
        title: "Success",
        description: data.message || `Weighted routing disabled for ${listId}`,
      })
      
      // Reload data to reflect changes
      await loadData()
      
    } catch (error: any) {
      console.error('Error disabling weights:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to disable weighted routing",
        variant: "destructive",
      })
    }
  }

  const handleDownloadPartnerSpec = async (partnerName: string) => {
    try {
      setGeneratingPDF(true)
      
      const response = await fetch(`/api/generate-api-spec-text?partner_name=${encodeURIComponent(partnerName)}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.details || 'Failed to generate specification')
      }
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${partnerName}-API-Integration-Specs.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `API specifications downloaded for ${partnerName}`,
      })
      
    } catch (error: any) {
      console.error('Error downloading partner spec:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate API specification",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleDownloadCampaignSpec = async (partnerName: string, campaigns: Integration[], campaignType: string) => {
    try {
      setGeneratingPDF(true)
      
      // Build query params for specific campaigns
      const listIds = campaigns.map(c => c.list_id).join(',')
      const response = await fetch(`/api/generate-api-spec-text?partner_name=${encodeURIComponent(partnerName)}&list_ids=${encodeURIComponent(listIds)}&campaign_type=${encodeURIComponent(campaignType)}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.details || 'Failed to generate specification')
      }
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${partnerName}-${campaignType}-API-Specs.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `${campaignType} API specifications downloaded for ${partnerName}`,
      })
      
    } catch (error: any) {
      console.error('Error downloading campaign spec:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate API specification",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleDownloadPartnerSpecWithPrePing = async (partnerName: string) => {
    try {
      setGeneratingPDF(true)
      
      const response = await fetch(`/api/generate-api-spec-text?partner_name=${encodeURIComponent(partnerName)}&include_pre_ping=true`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.details || 'Failed to generate specification')
      }
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${partnerName}-API-Integration-Specs-with-PrePing.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `API specifications with pre-ping instructions downloaded for ${partnerName}`,
      })
      
    } catch (error: any) {
      console.error('Error downloading partner spec with pre-ping:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate API specification with pre-ping instructions",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleDownloadCampaignSpecWithPrePing = async (partnerName: string, campaigns: Integration[], campaignType: string) => {
    try {
      setGeneratingPDF(true)
      
      // Build query params for specific campaigns with pre-ping
      const listIds = campaigns.map(c => c.list_id).join(',')
      const response = await fetch(`/api/generate-api-spec-text?partner_name=${encodeURIComponent(partnerName)}&list_ids=${encodeURIComponent(listIds)}&campaign_type=${encodeURIComponent(campaignType)}&include_pre_ping=true`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.details || 'Failed to generate specification')
      }
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${partnerName}-${campaignType}-API-Specs-with-PrePing.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `${campaignType} API specifications with pre-ping instructions downloaded for ${partnerName}`,
      })
      
    } catch (error: any) {
      console.error('Error downloading campaign spec with pre-ping:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to generate API specification with pre-ping instructions",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading routing management...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Routing Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage partner integrations, routing rules, and export DNC data
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowDNCExport(true)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export DNCs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
          <TabsTrigger value="verticals">Verticals</TabsTrigger>
          <TabsTrigger value="dialer-approvals">Dialer Approval</TabsTrigger>
            <TabsTrigger value="dialers">Dialers</TabsTrigger>
          <TabsTrigger value="api-specs">API Specs</TabsTrigger>
        </TabsList>
        <TabsContent value="dialers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dialer Types</CardTitle>
              <CardDescription>Manage global dialer types available across all verticals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-3">
                <Button size="sm" onClick={() => setEditingDialerType({ id: '', name: '', slug: '', default_color: 'bg-gray-100 text-gray-800', active: true })}>
                  <Plus className="h-3 w-3 mr-1" /> New Dialer Type
                </Button>
              </div>
              <div className="space-y-2">
                {(dialerTypes || []).map((dt:any) => (
                  <div key={dt.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge className={dt.default_color || 'bg-gray-100 text-gray-800'}>{dt.name}</Badge>
                      <span className="text-xs text-muted-foreground">ID: {dt.id} • {dt.slug || 'no-slug'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={dt.active ? 'default' : 'secondary'}>{dt.active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => setEditingDialerType({ ...dt })}><Edit2 className="h-3 w-3 mr-1"/>Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{partners.length}</div>
                <p className="text-xs text-muted-foreground">
                  {partners.filter(p => p.active).length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
                <ListIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{integrations.length}</div>
                <p className="text-xs text-muted-foreground">
                  {integrations.filter(i => i.active).length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Integration Types</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(integrations.map(i => i.integration_type)).size}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Array.from(new Set(integrations.map(i => i.integration_type))).join(', ') || 'No types found'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partners" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {partners.map((partner) => {
              const partnerIntegrations = getPartnerIntegrations(partner.id)
              return (
                <Card key={partner.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{partner.name}</CardTitle>
                        <CardDescription>
                          {partnerIntegrations.length} integration{partnerIntegrations.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <Badge variant={partner.active ? 'default' : 'secondary'}>
                        {partner.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {partnerIntegrations.length > 0 ? (
                        partnerIntegrations.map((integration) => (
                          <div key={integration.id} className="flex justify-between items-center p-3 border rounded">
                            <div className="flex-1">
                              <div className="font-medium">{integration.list_id}</div>
                              <div className="text-sm text-muted-foreground">List ID</div>
                              {integration.description && (
                                <div className="text-xs text-muted-foreground mt-1">{integration.description}</div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={getIntegrationTypeBadge(integration.integration_type)}>
                                  {integration.integration_type}
                                </Badge>
                                {integration.dialer_type && (
                                  <Badge className={getDialerTypeColor(integration.dialer_type)}>
                                    {getDialerTypeLabel(integration.dialer_type)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfigureWeights(integration)}
                                className="flex items-center gap-1"
                              >
                                <Settings className="h-3 w-3" />
                                Configure Weights
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditDialer(integration)}
                                className="flex items-center gap-1"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit Dialer
                              </Button>
                              {false && getWeightedRouting(integration.list_id) && (
                                <div className="flex items-center gap-1 text-xs text-blue-600">
                                  <Percent className="h-3 w-3" />
                                  Weighted: {getWeightedRouting(integration.list_id)?.map(w => 
                                    `${w.weight_percentage}% ${getDialerTypeLabel(w.dialer_type)}`
                                  ).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No integrations configured</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Integrations</CardTitle>
              <CardDescription>
                Complete list of all partner integrations and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <div key={integration.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{integration.partner_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        List ID: {integration.list_id}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getIntegrationTypeBadge(integration.integration_type)}>
                        {integration.integration_type}
                      </Badge>
                      <Badge variant={integration.active ? 'default' : 'secondary'}>
                        {integration.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-sources" className="space-y-6">
          {Object.entries(getIntegrationsGroupedByDataSource()).map(([dataSource, dataSourceIntegrations]) => (
            <Card key={dataSource}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getDataSourceColor(dataSource)}>
                        {getDataSourceLabel(dataSource)}
                      </Badge>
                      Data Source
                    </CardTitle>
                    <CardDescription>
                      {dataSourceIntegrations.length} integration{dataSourceIntegrations.length !== 1 ? 's' : ''} • {dataSourceIntegrations.filter(i => i.active).length} active
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataSourceIntegrations.map((integration) => (
                    <div key={integration.id} className="flex justify-between items-center p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{integration.list_id}</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.partner_name}
                          {integration.description && ` • ${integration.description}`}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getIntegrationTypeBadge(integration.integration_type)}>
                            {integration.integration_type}
                          </Badge>
                          {integration.dialer_type && (
                            <Badge className={getDialerTypeColor(integration.dialer_type)}>
                              {getDialerTypeLabel(integration.dialer_type)}
                            </Badge>
                          )}
                          {integration.vertical && (
                            <Badge className={getVerticalColor(integration.vertical)}>
                              {integration.vertical}
                            </Badge>
                          )}
                          <Badge variant={integration.active ? 'default' : 'secondary'}>
                            {integration.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {integration.bid && (
                            <span className="text-xs text-muted-foreground">
                              Bid: ${integration.bid}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditListVertical(integration)}
                          className="flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Change Vertical
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDialer(integration)}
                          className="flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Change Dialer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="verticals" className="space-y-6">
          {Object.entries(getIntegrationsGroupedByVertical()).map(([vertical, verticalIntegrations]) => (
            <Card key={vertical}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getVerticalColor(vertical)}>
                        {vertical}
                      </Badge>
                      Vertical
                    </CardTitle>
                    <CardDescription>
                      {verticalIntegrations.length} list ID{verticalIntegrations.length !== 1 ? 's' : ''} • Configure dialer settings
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dialer Configuration Section */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Dialer Configuration</h4>
                  <div className="grid gap-4">
                    {getVerticalConfigs(vertical).map((config) => (
                      <div key={config.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <Badge className={getDialerTypeColor(config.dialer_type)}>
                              {getDialerTypeLabel(config.dialer_type)}
                            </Badge>
                          </div>
                          {config.__isNew ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditVerticalConfig(config)}
                              className="flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Config
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditVerticalConfig(config)}
                              className="flex items-center gap-1"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit Config
                            </Button>
                          )}
                        </div>
                        {!config.__isNew && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Campaign ID:</span>
                              <div className="font-mono">{config.campaign_id || 'Not set'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cadence ID:</span>
                              <div className="font-mono">{config.cadence_id || 'Not set'}</div>
                            </div>
                            {config.dialer_type === 2 && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Token:</span>
                                <div className="font-mono">{config.token || 'Not set'}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* List IDs Section */}
                <div>
                  <h4 className="text-sm font-medium mb-3">List IDs ({verticalIntegrations.length})</h4>
                  <div className="space-y-2">
                    {verticalIntegrations.map((integration) => (
                      <div key={integration.id} className="flex justify-between items-center p-3 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{integration.list_id}</div>
                          <div className="text-sm text-muted-foreground">
                            {integration.partner_name}
                            {integration.description && ` • ${integration.description}`}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getIntegrationTypeBadge(integration.integration_type)}>
                              {integration.integration_type}
                            </Badge>
                            {integration.dialer_type && (
                              <Badge className={getDialerTypeColor(integration.dialer_type)}>
                                {getDialerTypeLabel(integration.dialer_type)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditListVertical(integration)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Change Vertical
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditDialer(integration)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Change Dialer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="dialer-approvals" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {integrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{integration.list_id}</CardTitle>
                      <CardDescription>
                        {integration.partner_name}
                        {integration.description && ` • ${integration.description}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getIntegrationTypeBadge(integration.integration_type)}>
                        {integration.integration_type}
                      </Badge>
                      {integration.vertical && (
                        <Badge className={getVerticalColor(integration.vertical)}>
                          {integration.vertical}
                        </Badge>
                      )}
                      <Badge variant={integration.active ? 'default' : 'secondary'}>
                        {integration.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm font-medium mb-3">Dialer Approvals:</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Internal Dialer */}
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge className={getDialerTypeColor(1)}>
                            {getDialerTypeLabel(1)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getDialerApprovalStatus(integration.list_id, 1) ? 'default' : 'destructive'}
                            className={getDialerApprovalStatus(integration.list_id, 1) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {getDialerApprovalStatus(integration.list_id, 1) ? 'Approved' : 'Denied'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditApproval(integration, 1)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </div>
                      
                      {/* Pitch BPO */}
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge className={getDialerTypeColor(2)}>
                            {getDialerTypeLabel(2)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getDialerApprovalStatus(integration.list_id, 2) ? 'default' : 'destructive'}
                            className={getDialerApprovalStatus(integration.list_id, 2) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {getDialerApprovalStatus(integration.list_id, 2) ? 'Approved' : 'Denied'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditApproval(integration, 2)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </div>
                      
                      {/* Convoso */}
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge className={getDialerTypeColor(3)}>
                            {getDialerTypeLabel(3)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getDialerApprovalStatus(integration.list_id, 3) ? 'default' : 'destructive'}
                            className={getDialerApprovalStatus(integration.list_id, 3) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {getDialerApprovalStatus(integration.list_id, 3) ? 'Approved' : 'Denied'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditApproval(integration, 3)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api-specs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">API Integration Specifications</h3>
              <p className="text-sm text-muted-foreground">
                Download custom API documentation PDFs for vendors and partners
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            {partners.filter(partner => partner.active).map(partner => {
              const partnerIntegrations = integrations.filter(integration => 
                integration.partner_name === partner.name
              )
              
              if (partnerIntegrations.length === 0) return null
              
              // Group integrations by data source type
              const onHour = partnerIntegrations.filter(i => 
                i.description?.toLowerCase().includes('on hour') || 
                i.description?.toLowerCase().includes('on-hour')
              )
              const afterHour = partnerIntegrations.filter(i => 
                i.description?.toLowerCase().includes('after hour') || 
                i.description?.toLowerCase().includes('off hour') ||
                i.description?.toLowerCase().includes('after-hour')
              )
              const aged = partnerIntegrations.filter(i => 
                i.description?.toLowerCase().includes('aged')
              )
              const other = partnerIntegrations.filter(i => 
                !onHour.includes(i) && !afterHour.includes(i) && !aged.includes(i)
              )
              
              return (
                <Card key={partner.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {partner.name}
                          <Badge variant="outline">
                            {partnerIntegrations.length} integration{partnerIntegrations.length !== 1 ? 's' : ''}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Generate API specification documents for this partner
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleDownloadPartnerSpec(partner.name)}
                          className="flex items-center gap-2"
                          disabled={generatingPDF}
                        >
                          <Download className="h-4 w-4" />
                          {generatingPDF ? 'Generating...' : 'Download All'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDownloadPartnerSpecWithPrePing(partner.name)}
                          className="flex items-center gap-2"
                          disabled={generatingPDF}
                        >
                          <Download className="h-4 w-4" />
                          With Pre-Ping
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {onHour.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-100 text-green-800">⏰ On Hours</Badge>
                              <span className="text-sm text-muted-foreground">
                                {onHour.length} campaign{onHour.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpec(partner.name, onHour, 'On Hours')}
                                disabled={generatingPDF}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpecWithPrePing(partner.name, onHour, 'On Hours')}
                                disabled={generatingPDF}
                                className="text-xs"
                              >
                                Pre-Ping
                              </Button>
                            </div>
                          </div>
                          <div className="pl-4 space-y-1">
                            {onHour.map(integration => (
                              <div key={integration.list_id} className="text-xs text-muted-foreground font-mono">
                                {integration.list_id}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {afterHour.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-800">🌙 After Hours</Badge>
                              <span className="text-sm text-muted-foreground">
                                {afterHour.length} campaign{afterHour.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpec(partner.name, afterHour, 'After Hours')}
                                disabled={generatingPDF}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpecWithPrePing(partner.name, afterHour, 'After Hours')}
                                disabled={generatingPDF}
                                className="text-xs"
                              >
                                Pre-Ping
                              </Button>
                            </div>
                          </div>
                          <div className="pl-4 space-y-1">
                            {afterHour.map(integration => (
                              <div key={integration.list_id} className="text-xs text-muted-foreground font-mono">
                                {integration.list_id}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {aged.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-orange-100 text-orange-800">📅 Aged Leads</Badge>
                              <span className="text-sm text-muted-foreground">
                                {aged.length} campaign{aged.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpec(partner.name, aged, 'Aged Leads')}
                                disabled={generatingPDF}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpecWithPrePing(partner.name, aged, 'Aged Leads')}
                                disabled={generatingPDF}
                                className="text-xs"
                              >
                                Pre-Ping
                              </Button>
                            </div>
                          </div>
                          <div className="pl-4 space-y-1">
                            {aged.map(integration => (
                              <div key={integration.list_id} className="text-xs text-muted-foreground font-mono">
                                {integration.list_id}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {other.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-gray-100 text-gray-800">📋 Standard</Badge>
                              <span className="text-sm text-muted-foreground">
                                {other.length} campaign{other.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpec(partner.name, other, 'Standard')}
                                disabled={generatingPDF}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadCampaignSpecWithPrePing(partner.name, other, 'Standard')}
                                disabled={generatingPDF}
                                className="text-xs"
                              >
                                Pre-Ping
                              </Button>
                            </div>
                          </div>
                          <div className="pl-4 space-y-1">
                            {other.map(integration => (
                              <div key={integration.list_id} className="text-xs text-muted-foreground font-mono">
                                {integration.list_id}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

      </Tabs>

      {/* DNC Export Modal */}
      <DNCExportModal 
        isOpen={showDNCExport}
        onClose={() => setShowDNCExport(false)}
      />

      {/* Edit Dialer Modal */}
      <Dialog open={!!editingIntegration} onOpenChange={() => setEditingIntegration(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Dialer Type</DialogTitle>
            <DialogDescription>
              Change the dialer routing for List ID: {editingIntegration?.list_id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-dialer" className="text-right">
                Current
              </Label>
              <div className="col-span-3">
                <Badge className={editingIntegration?.dialer_type ? getDialerTypeColor(editingIntegration.dialer_type) : 'bg-gray-100 text-gray-800'}>
                  {editingIntegration?.dialer_type ? getDialerTypeLabel(editingIntegration.dialer_type) : 'Unknown'}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-dialer" className="text-right">
                New Dialer
              </Label>
              <div className="col-span-3">
                <Select value={newDialerType} onValueChange={setNewDialerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dialer type" />
                  </SelectTrigger>
                  <SelectContent>
                      {(dialerTypes.length ? dialerTypes : [{id:1,name:'Internal Dialer'},{id:2,name:'Pitch BPO'},{id:3,name:'Convoso (Health Insurance)'}]).map((d:any)=> (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingIntegration?.description && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Description</Label>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {editingIntegration.description}
                </div>
              </div>
            )}
            {editingIntegration?.bid && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Bid</Label>
                <div className="col-span-3 text-sm text-muted-foreground">
                  ${editingIntegration.bid}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingIntegration(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateDialer}
              disabled={updatingDialer || !newDialerType || newDialerType === editingIntegration?.dialer_type?.toString()}
            >
              {updatingDialer ? 'Updating...' : 'Update Dialer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Vertical Configuration Modal */}
      <Dialog open={!!editingVerticalConfig} onOpenChange={() => setEditingVerticalConfig(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Vertical Configuration</DialogTitle>
            <DialogDescription>
              Configure {editingVerticalConfig?.vertical} vertical settings for {getDialerTypeLabel(editingVerticalConfig?.dialer_type)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingVerticalConfig?.__isNew ? (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vertical-select" className="text-right">Vertical</Label>
                  <div className="col-span-3">
                    <Select value={editingVerticalConfig?.vertical || 'ACA'} onValueChange={(v)=> setEditingVerticalConfig((prev:any)=> ({ ...(prev||{}), vertical: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vertical" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACA">ACA</SelectItem>
                        <SelectItem value="Final Expense">Final Expense</SelectItem>
                        <SelectItem value="Medicare">Medicare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dialer-type-select" className="text-right">Dialer Type</Label>
                  <div className="col-span-3">
                    <Select value={String(editingVerticalConfig?.dialer_type || '')} onValueChange={(v)=> setEditingVerticalConfig((prev:any)=> ({ ...(prev||{}), dialer_type: parseInt(v) }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dialer type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dialerTypes.length ? dialerTypes : [{id:1,name:'Internal Dialer'},{id:2,name:'Pitch BPO'},{id:3,name:'Convoso (Health Insurance)'}]).map((d:any)=> (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vertical-name" className="text-right">Vertical</Label>
                  <div className="col-span-3">
                    <Badge className={editingVerticalConfig?.vertical ? getVerticalColor(editingVerticalConfig.vertical) : 'bg-gray-100 text-gray-800'}>
                      {editingVerticalConfig?.vertical || 'Unknown'}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dialer-type" className="text-right">Dialer Type</Label>
                  <div className="col-span-3">
                    <Badge className={editingVerticalConfig?.dialer_type ? getDialerTypeColor(editingVerticalConfig.dialer_type) : 'bg-gray-100 text-gray-800'}>
                      {editingVerticalConfig?.dialer_type ? getDialerTypeLabel(editingVerticalConfig.dialer_type) : 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="campaign-id" className="text-right">
                Campaign ID
              </Label>
              <div className="col-span-3">
                <input
                  id="campaign-id"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingVerticalConfig?.campaign_id || ''}
                  onChange={(e) => setEditingVerticalConfig((prev: any) => prev ? { ...prev, campaign_id: e.target.value } : null)}
                  placeholder="Enter campaign ID"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cadence-id" className="text-right">
                Cadence ID
              </Label>
              <div className="col-span-3">
                <input
                  id="cadence-id"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingVerticalConfig?.cadence_id || ''}
                  onChange={(e) => setEditingVerticalConfig((prev: any) => prev ? { ...prev, cadence_id: e.target.value } : null)}
                  placeholder="Enter cadence ID"
                />
              </div>
            </div>
            {editingVerticalConfig?.dialer_type === 2 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="token" className="text-right">
                  Token
                </Label>
                <div className="col-span-3">
                  <input
                    id="token"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingVerticalConfig?.token || ''}
                    onChange={(e) => setEditingVerticalConfig((prev: any) => prev ? { ...prev, token: e.target.value } : null)}
                    placeholder="Enter Pitch BPO token"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingVerticalConfig(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateVerticalConfig}>
              {editingVerticalConfig?.__isNew ? 'Create Configuration' : 'Update Configuration'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialer Type Modal */}
      <Dialog open={!!editingDialerType} onOpenChange={() => setEditingDialerType(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingDialerType?.id ? 'Edit Dialer Type' : 'New Dialer Type'}</DialogTitle>
            <DialogDescription>Define global dialer type used across lists and verticals</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">ID</Label>
              <div className="col-span-3">
                <input
                  type="number"
                  value={editingDialerType?.id ?? ''}
                  onChange={(e)=> setEditingDialerType((p:any)=> ({ ...(p||{}), id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Unique integer ID"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name</Label>
              <div className="col-span-3">
                <input
                  type="text"
                  value={editingDialerType?.name ?? ''}
                  onChange={(e)=> setEditingDialerType((p:any)=> ({ ...(p||{}), name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Dialer display name"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Slug</Label>
              <div className="col-span-3">
                <input
                  type="text"
                  value={editingDialerType?.slug ?? ''}
                  onChange={(e)=> setEditingDialerType((p:any)=> ({ ...(p||{}), slug: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="slug-for-dialer"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Badge Class</Label>
              <div className="col-span-3">
                <input
                  type="text"
                  value={editingDialerType?.default_color ?? ''}
                  onChange={(e)=> setEditingDialerType((p:any)=> ({ ...(p||{}), default_color: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g. bg-blue-100 text-blue-800"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingDialerType(null)}>Cancel</Button>
            <Button
              onClick={async ()=>{
                if (!editingDialerType?.id || !editingDialerType?.name) return
                setSavingDialerType(true)
                try {
                  const res = await fetch('/api/dialer-types', {
                    method: editingDialerType.__isExisting ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingDialerType.id, name: editingDialerType.name, slug: editingDialerType.slug, default_color: editingDialerType.default_color, active: true })
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error)
                  await loadDialerTypes()
                  setEditingDialerType(null)
                } catch (e:any) {
                  console.error('Failed to save dialer type', e)
                  toast({ title: 'Error', description: e.message || 'Failed to save dialer type', variant: 'destructive' })
                } finally {
                  setSavingDialerType(false)
                }
              }}
              disabled={savingDialerType || !editingDialerType?.id || !editingDialerType?.name}
            >
              {savingDialerType ? 'Saving...' : 'Save Dialer Type'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change List Vertical Modal */}
      <Dialog open={!!editingListVertical} onOpenChange={() => setEditingListVertical(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Vertical Assignment</DialogTitle>
            <DialogDescription>
              Change the vertical for List ID: {editingListVertical?.list_id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-vertical" className="text-right">
                Current
              </Label>
              <div className="col-span-3">
                <Badge className={editingListVertical?.vertical ? getVerticalColor(editingListVertical.vertical) : getVerticalColor('ACA')}>
                  {editingListVertical?.vertical || 'ACA'}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-vertical" className="text-right">
                New Vertical
              </Label>
              <div className="col-span-3">
                <Select value={newVertical} onValueChange={setNewVertical}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACA">ACA</SelectItem>
                    <SelectItem value="Final Expense">Final Expense</SelectItem>
                    <SelectItem value="Medicare">Medicare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingListVertical?.partner_name && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Partner</Label>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {editingListVertical.partner_name}
                </div>
              </div>
            )}
            {editingListVertical?.description && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Description</Label>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {editingListVertical.description}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingListVertical(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateListVertical}
              disabled={updatingVertical || !newVertical || newVertical === (editingListVertical?.vertical || 'ACA')}
            >
              {updatingVertical ? 'Updating...' : 'Update Vertical'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configure Weighted Routing Modal */}
      <Dialog open={!!editingWeights} onOpenChange={() => setEditingWeights(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configure Weighted Routing</DialogTitle>
            <DialogDescription>
              Set percentage distribution for List ID: {editingWeights?.list_id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">List ID</Label>
              <div className="col-span-3 font-mono text-sm">
                {editingWeights?.list_id}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Partner</Label>
              <div className="col-span-3 text-sm text-muted-foreground">
                {editingWeights?.partner_name}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Dialer Distribution</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddDialer}
                  disabled={weightConfig.length >= 3}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Dialer
                </Button>
              </div>
              
              <div className="space-y-3">
                {weightConfig.map((weight, index) => (
                  <div key={weight.dialer_type} className="flex items-center gap-3 p-3 border rounded">
                    <div className="flex-1">
                      <Badge className={getDialerTypeColor(weight.dialer_type)}>
                        {getDialerTypeLabel(weight.dialer_type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={weight.weight_percentage}
                        onChange={(e) => handleWeightChange(weight.dialer_type, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    {weightConfig.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveDialer(weight.dialer_type)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">Total Weight:</span>
                <span className={`text-sm font-bold ${
                  weightConfig.reduce((sum, w) => sum + w.weight_percentage, 0) === 100 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {weightConfig.reduce((sum, w) => sum + w.weight_percentage, 0)}%
                </span>
              </div>
              
              {weightConfig.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <strong>Preview:</strong> {weightConfig.map(w => 
                    `${w.weight_percentage}% ${getDialerTypeLabel(w.dialer_type)}`
                  ).join(', ')}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => handleDisableWeights(editingWeights?.list_id || '')}
              className="text-red-600 hover:text-red-700"
            >
              Disable Weighted Routing
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEditingWeights(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveWeights}
                disabled={updatingWeights || weightConfig.reduce((sum, w) => sum + w.weight_percentage, 0) !== 100}
              >
                {updatingWeights ? 'Saving...' : 'Save Weights'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialer Approval Modal */}
      <Dialog open={!!editingApproval} onOpenChange={() => setEditingApproval(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Dialer Approval</DialogTitle>
            <DialogDescription>
              Manage approval status for {editingApproval && getDialerTypeLabel(editingApproval.dialer_type)} on List ID: {editingApproval?.integration.list_id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">List ID</Label>
              <div className="col-span-3 font-mono text-sm">
                {editingApproval?.integration.list_id}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Partner</Label>
              <div className="col-span-3 text-sm text-muted-foreground">
                {editingApproval?.integration.partner_name}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Dialer</Label>
              <div className="col-span-3">
                <Badge className={editingApproval ? getDialerTypeColor(editingApproval.dialer_type) : 'bg-gray-100 text-gray-800'}>
                  {editingApproval && getDialerTypeLabel(editingApproval.dialer_type)}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="approval-status" className="text-right">
                Status
              </Label>
              <div className="col-span-3">
                <Select value={approvalStatus.toString()} onValueChange={(value) => setApprovalStatus(value === 'true')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approval status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">✅ Approved</SelectItem>
                    <SelectItem value="false">❌ Denied</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="approval-reason" className="text-right">
                Reason
              </Label>
              <div className="col-span-3">
                <textarea
                  id="approval-reason"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder={approvalStatus ? "Reason for approval (optional)" : "Reason for denial (required)"}
                />
              </div>
            </div>
            {!approvalStatus && !approvalReason.trim() && (
              <div className="text-sm text-red-600 ml-[25%]">
                Please provide a reason for denial
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingApproval(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveApproval}
              disabled={updatingApproval || (!approvalStatus && !approvalReason.trim())}
            >
              {updatingApproval ? 'Saving...' : 'Save Approval'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
