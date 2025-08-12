'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Settings, Users, ListIcon, Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { createClient } from '@supabase/supabase-js'
import DNCExportModal from './components/DNCExportModal'
import MonthlyDNCDownloads from './components/MonthlyDNCDownloads'

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
  partner_name: string
  integration_type: string
  active: boolean
}

export default function RoutingManagementPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showDNCExport, setShowDNCExport] = useState(false)

  useEffect(() => {
    loadData()
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

      // Load integrations with partner names
      const { data: integrationsData, error: integrationsError } = await supabase
        .from('partner_integrations')
        .select(`
          id,
          list_id,
          integration_type,
          active,
          partners!inner(name)
        `)
        .order('created_at', { ascending: false })

      if (integrationsError) throw integrationsError

      setPartners(partnersData || [])
      
      const integrationsWithNames = (integrationsData || []).map((integration: any) => ({
        id: integration.id,
        list_id: integration.list_id,
        partner_name: integration.partners?.name || 'Unknown',
        integration_type: integration.integration_type,
        active: integration.active
      }))
      
      setIntegrations(integrationsWithNames)

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

  const getPartnerIntegrations = (partnerId: string) => {
    return integrations.filter(integration => 
      partners.find(p => p.name === integration.partner_name)?.id === partnerId
    )
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
        </TabsList>

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
                  on_hours, off_hours, aged
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
                          <div key={integration.id} className="flex justify-between items-center p-2 border rounded">
                            <div className="flex-1">
                              <div className="font-medium">{integration.list_id}</div>
                              <div className="text-sm text-muted-foreground">List ID</div>
                            </div>
                            <Badge className={getIntegrationTypeBadge(integration.integration_type)}>
                              {integration.integration_type}
                            </Badge>
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


      </Tabs>

      {/* DNC Export Modal */}
      <DNCExportModal 
        isOpen={showDNCExport}
        onClose={() => setShowDNCExport(false)}
      />
    </div>
  )
}
