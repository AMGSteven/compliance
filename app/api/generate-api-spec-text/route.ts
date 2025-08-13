import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const partnerName = searchParams.get('partner_name')
    const listId = searchParams.get('list_id')
    const listIds = searchParams.get('list_ids')?.split(',') || []
    const campaignType = searchParams.get('campaign_type')
    const includePrePing = searchParams.get('include_pre_ping') === 'true'

    console.log('API Spec Text Generation Request:', {
      partnerName,
      listId,
      listIds,
      campaignType,
      includePrePing
    })

    // Try to load routing configurations, but don't fail if none exist
    let allRoutingData: any[] = []
    const { data: dbRoutingData, error } = await supabase
      .from('list_routings')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Database error loading routing configs (non-fatal):', error)
      // Continue without routing data - we'll generate generic specs
    } else if (dbRoutingData && dbRoutingData.length > 0) {
      allRoutingData = dbRoutingData
    }

    // If we have routing data, use it. Otherwise, generate generic spec
    let filteredData: any[] = []
    
    if (allRoutingData.length > 0) {
      // Short-circuit: when list_id or list_ids are provided, bypass partner mapping/filters
      if (listId || listIds.length > 0) {
        const ids = new Set<string>([...(listId ? [listId] : []), ...listIds])
        filteredData = allRoutingData.filter(r => ids.has(r.list_id))
      } else {
      // Map routing data to partners - use database partner_name field, fall back to description parsing
      const routingWithPartners = allRoutingData.map((routing: any) => {
        // Use the partner_name field from database first
        let mappedPartnerName = routing.partner_name || 'Unknown'
        
        // If partner_name is null/empty, fall back to description parsing
        if (!mappedPartnerName || mappedPartnerName.trim() === '' || mappedPartnerName === 'Unknown') {
          const desc = routing.description?.toLowerCase() || ''
          
          // Specific List ID mappings first (same as dashboard)
          if (routing.list_id === 'pitch-bpo-list-1750720674171') {
            mappedPartnerName = 'iExecute'
          } else if ([
            'a5e7700e-6525-4401-9ef7-aa1bff188f12',
            'pitch-bpo-list-1753907657505'
          ].includes(routing.list_id)) {
            mappedPartnerName = 'OPG'
          }
          // Description-based matching (complete mapping from dashboard)
          else if (desc.includes('employers')) {
            mappedPartnerName = 'Employers.io'
          } else if (desc.includes('fluent')) {
            mappedPartnerName = 'Fluent'
          } else if (desc.includes('citadel')) {
            mappedPartnerName = 'Citadel'
          } else if (desc.includes('onpoint') || desc.includes('opg')) {
            mappedPartnerName = 'Onpoint'
          } else if (desc.includes('shift44')) {
            mappedPartnerName = 'Shift44'
          } else if (desc.includes('top of funnel') || desc.includes('topfunnel')) {
            mappedPartnerName = 'Top of Funnel'
          } else if (desc.includes('pushnami')) {
            mappedPartnerName = 'Pushnami'
          } else if (desc.includes('interest media')) {
            mappedPartnerName = 'Interest Media'
          } else if (desc.includes('what if media')) {
            mappedPartnerName = 'What If Media'
          } else if (desc.includes('flex mg')) {
            mappedPartnerName = 'Flex MG'
          } else if (desc.includes('iexcecute') || desc.includes('iexecute')) {
            mappedPartnerName = 'iExecute'
          } else if (desc.includes('launch')) {
            mappedPartnerName = 'Launch Potato'
          } else if (desc.includes('juiced')) {
            mappedPartnerName = 'Juiced Media'
          } else if (desc.includes('moxxi')) {
            mappedPartnerName = 'Moxxi'
          } else {
            mappedPartnerName = 'Unknown'
          }
        }
        
        return { ...routing, mappedPartnerName }
      })
      
      // Filter by partner name if specified
      filteredData = routingWithPartners
      if (partnerName) {
        filteredData = routingWithPartners.filter(r => 
          r.mappedPartnerName.toLowerCase() === partnerName.toLowerCase()
        )
      }

      // Filter by specific list IDs if specified
      if (listId) {
        filteredData = filteredData.filter(r => r.list_id === listId)
      }

      if (listIds.length > 0) {
        filteredData = filteredData.filter(r => listIds.includes(r.list_id))
      }
      }
    }

    // If no routing data found, generate generic spec for the partner
    if (filteredData.length === 0) {
      console.log('No routing configurations found, generating generic API spec for:', partnerName)
      filteredData = generateGenericCampaigns(partnerName, campaignType)
    }

    const routingData = filteredData

    // Debug logging
    console.log('Text API Debug:', {
      partnerName,
      campaignType,
      totalRoutings: filteredData.length,
      routingDescriptions: filteredData.map(r => r.description)
    })

    // Group campaigns by data source type (with optional campaignType filter)
    const groupedCampaigns = filteredData.reduce((acc: any, routing: any) => {
      const dataSourceType = extractDataSourceType(routing.description || '')
      
      console.log('Processing routing:', {
        listId: routing.list_id,
        description: routing.description,
        extractedDataSourceType: dataSourceType,
        requestedCampaignType: campaignType,
        willInclude: !campaignType || dataSourceType === campaignType
      })
      
      // Only filter by campaign type if it's specified
      if (campaignType && dataSourceType !== campaignType) {
        return acc
      }

      const campaign = {
        list_id: routing.list_id,
        campaign_id: routing.campaign_id,
        cadence_id: routing.cadence_id,
        token: routing.token,
        bid: routing.bid,
        // Don't include dialer info - partners don't need to know about our internal routing
        description: routing.description,
        dataSourceType
      }

      if (!acc[dataSourceType]) {
        acc[dataSourceType] = []
      }
      acc[dataSourceType].push(campaign)
      return acc
    }, {})

    console.log('Grouped campaigns result:', Object.keys(groupedCampaigns), 'Total groups:', Object.keys(groupedCampaigns).length)

    // Fallback: if list_ids were provided and campaign_type filtering removed everything, rebuild without the filter
    if ((listId || listIds.length > 0) && campaignType && Object.keys(groupedCampaigns).length === 0) {
      const fallbackGroups = filteredData.reduce((acc: any, routing: any) => {
        const dataSourceType = extractDataSourceType(routing.description || '')
        if (!acc[dataSourceType]) acc[dataSourceType] = []
        acc[dataSourceType].push({
          list_id: routing.list_id,
          campaign_id: routing.campaign_id,
          cadence_id: routing.cadence_id,
          token: routing.token,
          bid: routing.bid,
          description: routing.description,
          dataSourceType
        })
        return acc
      }, {})
      console.log('Fallback (no-filter) groups used due to empty result with campaign_type and list_ids')
      // Use fallback groups
      const textContent = generateAPISpecText(fallbackGroups, partnerName, includePrePing)
      const timestamp = new Date().toISOString().split('T')[0]
      const prePingSuffix = includePrePing ? '-with-pre-ping' : ''
      const campaignSuffix = campaignType ? `-${campaignType.toLowerCase().replace(/\s+/g, '-')}` : ''
      const filename = `api-spec-${partnerName?.toLowerCase().replace(/\s+/g, '-') || 'integration'}${campaignSuffix}${prePingSuffix}-${timestamp}.txt`
      return new NextResponse(textContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    // Generate text content
    const textContent = generateAPISpecText(groupedCampaigns, partnerName, includePrePing)

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const prePingSuffix = includePrePing ? '-with-pre-ping' : ''
    const campaignSuffix = campaignType ? `-${campaignType.toLowerCase().replace(/\s+/g, '-')}` : ''
    const filename = `api-spec-${partnerName?.toLowerCase().replace(/\s+/g, '-') || 'integration'}${campaignSuffix}${prePingSuffix}-${timestamp}.txt`

    // Return text file
    return new NextResponse(textContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error: any) {
    console.error('API Spec Text Generation Error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate API specification text',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

function generateGenericCampaigns(partnerName: string | null, campaignType: string | null): any[] {
  const campaigns: any[] = []
  const timestamp = Date.now()
  
  // Generate generic campaigns for common types
  const campaignTypes = campaignType ? [campaignType] : ['Standard', 'Aged', 'On Hours', 'After Hours']
  
  campaignTypes.forEach((type, index) => {
    campaigns.push({
      list_id: `generic-${partnerName?.toLowerCase().replace(/\s+/g, '-') || 'partner'}-${type.toLowerCase().replace(/\s+/g, '-')}-${timestamp + index}`,
      campaign_id: `campaign-${timestamp + index}`,
      cadence_id: `cadence-${timestamp + index}`,
      token: 'YOUR_API_TOKEN_HERE',
      bid: 25.00,
      // Remove dialer info from generic campaigns too
      description: `${partnerName || 'Partner'} - ${type} Campaign`,
      dataSourceType: type,
      mappedPartnerName: partnerName || 'Integration Partner'
    })
  })
  
  return campaigns
}

function extractDataSourceType(description: string): string {
  const lowerDesc = description.toLowerCase()
  // Normalize common synonyms
  if (
    lowerDesc.includes('after hour') ||
    lowerDesc.includes('after-hour') ||
    lowerDesc.includes('after hours') ||
    lowerDesc.includes('off hour') ||
    lowerDesc.includes('off-hour') ||
    lowerDesc.includes('off hours')
  ) return 'After Hours'
  if (lowerDesc.includes('aged')) return 'Aged'
  if (lowerDesc.includes('on hour')) return 'On Hours'
  return 'Standard'
}

// Removed getDialerTypeString - dialer info is not exposed to partners

function generateAPISpecText(groupedCampaigns: any, partnerName: string | null, includePrePing: boolean): string {
  let content = ''
  
  // Header
  content += `===============================================\n`
  content += `API INTEGRATION SPECIFICATION\n`
  content += `===============================================\n`
  content += `Partner: ${partnerName || 'Integration Partner'}\n`
  content += `Generated: ${new Date().toISOString()}\n`
  content += `Workflow: ${includePrePing ? '2-Step (Pre-Ping + Full Submission)' : 'Single-Step (Direct Submission)'}\n`
  content += `===============================================\n\n`
  
  // Add note if this is a generic spec
  const isGenericSpec = Object.values(groupedCampaigns).some((campaigns: any) => 
    campaigns.some((c: any) => c.list_id.startsWith('generic-'))
  )
  
  if (isGenericSpec) {
    content += `NOTE: This is a generic API specification template.\n`
    content += `Actual list IDs, tokens, and campaign details will be provided\n`
    content += `during the integration setup process.\n\n`
  }

  // Authentication
  content += `AUTHENTICATION:\n`
  content += `All API requests require Bearer token authentication.\n`
  content += `Include the following header in all requests:\n`
  content += `Authorization: Bearer YOUR_API_TOKEN\n`
  content += `Content-Type: application/json\n\n`

  // Process each campaign group
  Object.entries(groupedCampaigns).forEach(([dataSourceType, campaigns]: [string, any]) => {
    content += `===============================================\n`
    content += `${dataSourceType.toUpperCase()} CAMPAIGNS\n`
    content += `===============================================\n\n`

    campaigns.forEach((campaign: any, index: number) => {
      content += `Campaign ${index + 1}: ${campaign.description}\n`
      content += `-----------------------------------------------\n`
      content += `List ID: ${campaign.list_id}\n`
      content += `Campaign ID: ${campaign.campaign_id}\n`
      content += `Cadence ID: ${campaign.cadence_id}\n`
      content += `API Token: ${campaign.token}\n`
      content += `Bid Amount: $${campaign.bid}\n\n`

      if (includePrePing) {
        // Pre-ping step
        content += `STEP 1: PRE-PING VALIDATION\n`
        content += `Endpoint: POST https://compliance.juicedmedia.io/api/leads/pre-ping\n\n`
        
        content += `Request Body:\n`
        content += `{\n`
        content += `  "phone": "5551234567",\n`
        content += `  "state": "TX",\n`
        content += `  "firstName": "John",\n`
        content += `  "lastName": "Doe",\n`
        content += `  "email": "john@example.com",\n`
        content += `  "list_id": "${campaign.list_id}",\n`
        content += `  "custom_fields": {\n`
        content += `    "subid": "12345"\n`
        content += `  }\n`
        content += `}\n\n`

        content += `Response - ACCEPTED:\n`
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "accepted": true,\n`
        content += `  "rejection_reasons": [],\n`
        content += `  "estimated_bid": ${campaign.bid},\n`
        content += `  "checks": {\n`
        content += `    "duplicate": { "isCompliant": true },\n`
        content += `    "state": { "isCompliant": true },\n`
        content += `    "compliance": { "isCompliant": true }\n`
        content += `  },\n`
        content += `  "processing_time_ms": 1200\n`
        content += `}\n\n`

        content += `Response - REJECTED:\n`
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "accepted": false,\n`
        content += `  "rejection_reasons": ["Internal DNC List: Phone blocked"],\n`
        content += `  "estimated_bid": 0,\n`
        content += `  "checks": {\n`
        content += `    "duplicate": { "isCompliant": true },\n`
        content += `    "state": { "isCompliant": true },\n`
        content += `    "compliance": { "isCompliant": false, "reason": "Failed compliance checks" }\n`
        content += `  },\n`
        content += `  "processing_time_ms": 1200\n`
        content += `}\n\n`

        // Step 2
        content += `STEP 2: FULL LEAD SUBMISSION (Only if Pre-Ping Accepted)\n`
      } else {
        content += `FULL LEAD SUBMISSION\n`
      }
      
      content += `Endpoint: POST https://compliance.juicedmedia.io/api/leads\n\n`
      
      content += `Request Body:\n`
      content += `{\n`
      content += `  "phone": "5551234567",\n`
      content += `  "state": "TX",\n`
      content += `  "firstName": "John",\n`
      content += `  "lastName": "Doe",\n`
      content += `  "email": "john@example.com",\n`
      content += `  "list_id": "${campaign.list_id}",\n`
      content += `  "campaign_id": "${campaign.campaign_id}",\n`
      content += `  "cadence_id": "${campaign.cadence_id}",\n`
      content += `  "address": "123 Main St",\n`
      content += `  "city": "Dallas",\n`
      content += `  "zip": "75201",\n`
      content += `  "age": "35",\n`
      content += `  "gender": "M",\n`
      content += `  "incomeBracket": "50000-75000",\n`
      content += `  "homeownerStatus": "Own",\n`
      content += `  "ageRange": "35-44",\n`
      content += `  "trusted_form_cert_url": "https://cert.trustedform.com/...",\n`
      content += `  "ip_address": "192.168.1.1",\n`
      content += `  "user_agent": "Mozilla/5.0...",\n`
      content += `  "landing_page_url": "https://yoursite.com/form",\n`
      content += `  "custom_fields": {\n`
      content += `    "subid": "12345"\n`
      content += `  }\n`
      content += `}\n\n`

      content += `Response - SUCCESS:\n`
      if (includePrePing) {
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "message": "Lead submitted successfully",\n`
        content += `  "lead_id": "lead_123456789",\n`
        content += `  "estimated_bid": ${campaign.bid},\n`
        content += `  "routing_info": {\n`
        content += `    "campaign": "${campaign.campaign_id}"\n`
        content += `  }\n`
        content += `}\n\n`
      } else {
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "message": "Lead submitted successfully",\n`
        content += `  "lead_id": "lead_123456789",\n`
        content += `  "bid": ${campaign.bid},\n`
        content += `  "status": "processed"\n`
        content += `}\n\n`
      }

      if (includePrePing) {
        content += `INTEGRATION WORKFLOW\n`
        content += `Recommended Process:\n`
        content += `• Pre-validate every lead using the pre-ping API\n`
        content += `• Only submit leads where "accepted": true\n`
        content += `• Ensure all required fields are present in full submission\n`
        content += `• Monitor responses for issues or errors\n\n`

        content += `TEST COMMANDS (cURL):\n\n`
        content += `# Pre-Ping Test\n`
        content += `curl -X POST https://compliance.juicedmedia.io/api/leads/pre-ping \\\n`
        content += `  -H "Authorization: Bearer ${campaign.token}" \\\n`
        content += `  -H "Content-Type: application/json" \\\n`
        content += `  -d '{\n`
        content += `    "phone": "6507769592",\n`
        content += `    "state": "TX",\n`
        content += `    "firstName": "John",\n`
        content += `    "lastName": "Doe",\n`
        content += `    "email": "john@example.com",\n`
        content += `    "list_id": "${campaign.list_id}",\n`
        content += `    "custom_fields": {\n`
        content += `      "subid": "12345"\n`
        content += `    }\n`
        content += `  }'\n\n`

        content += `# Full Lead Submission (if pre-ping accepted)\n`
      } else {
        content += `TEST COMMAND (cURL):\n\n`
      }
      
      content += `curl -X POST https://compliance.juicedmedia.io/api/leads \\\n`
      content += `  -H "Authorization: Bearer ${campaign.token}" \\\n`
      content += `  -H "Content-Type: application/json" \\\n`
      content += `  -d '{\n`
      content += `    "phone": "6507769592",\n`
      content += `    "state": "TX",\n`
      content += `    "firstName": "John",\n`
      content += `    "lastName": "Doe",\n`
      content += `    "email": "john@example.com",\n`
      content += `    "list_id": "${campaign.list_id}",\n`
      content += `    "campaign_id": "${campaign.campaign_id}",\n`
      content += `    "cadence_id": "${campaign.cadence_id}",\n`
      content += `    "address": "123 Main St",\n`
      content += `    "city": "Dallas",\n`
      content += `    "zip": "75201",\n`
      content += `    "age": "35",\n`
      content += `    "gender": "M",\n`
      content += `    "incomeBracket": "50000-75000",\n`
      content += `    "homeownerStatus": "Own",\n`
      content += `    "ageRange": "35-44",\n`
      content += `    "custom_fields": {\n`
      content += `      "subid": "12345"\n`
      content += `    }\n`
      content += `  }'\n\n`

      content += `===============================================\n\n`
    })
  })

  content += `NOTES:\n`
  content += `• Phone number 6507769592 bypasses compliance checks for testing\n`
  content += `• All API responses include processing time for monitoring\n`
  content += `• TrustedForm certificate claiming is supported\n`
  content += `• State validation and compliance checks apply to all submissions\n`
  content += `• Monitor bid values: $0.00 indicates rejected/non-compliant leads\n\n`

  content += `For technical support, contact the integration team.\n`

  return content
}
