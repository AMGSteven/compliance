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

    // Load all list routings first, then filter using same logic as dashboard
    const { data: allRoutingData, error } = await supabase
      .from('list_routings')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: error.message 
      }, { status: 500 })
    }

    if (!allRoutingData || allRoutingData.length === 0) {
      return NextResponse.json({ 
        error: 'No routing configurations found in database',
        details: 'No active routing configurations exist'
      }, { status: 404 })
    }

    // Map routing data to partners using same logic as dashboard
    const routingWithPartners = allRoutingData.map((routing: any) => {
      let mappedPartnerName = 'Unknown'
      
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
      }
      
      return { ...routing, mappedPartnerName }
    })

    // Filter by partner name if specified
    let filteredData = routingWithPartners
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

    if (filteredData.length === 0) {
      return NextResponse.json({ 
        error: 'No matching routing configurations found',
        details: { partnerName, listId, listIds, campaignType, totalConfigs: allRoutingData.length }
      }, { status: 404 })
    }

    const routingData = filteredData

    // Debug logging
    console.log('Text API Debug:', {
      partnerName,
      campaignType,
      totalRoutings: filteredData.length,
      routingDescriptions: filteredData.map(r => r.description)
    })

    // Group campaigns by data source type
    const groupedCampaigns = filteredData.reduce((acc: any, routing: any) => {
      const dataSourceType = extractDataSourceType(routing.description || '')
      const dialerTypeString = getDialerTypeString(routing.dialer_type)
      
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
        dialerType: routing.dialer_type,
        dialerTypeString,
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

function extractDataSourceType(description: string): string {
  const lowerDesc = description.toLowerCase()
  if (lowerDesc.includes('after hour')) return 'After Hours'
  if (lowerDesc.includes('aged')) return 'Aged'
  if (lowerDesc.includes('on hour')) return 'On Hours'
  return 'Standard'
}

function getDialerTypeString(dialerType: number): string {
  switch (dialerType) {
    case 1: return 'internal'
    case 2: return 'pitch_bpo'
    case 3: return 'convoso'
    default: return 'unknown'
  }
}

function generateAPISpecText(groupedCampaigns: any, partnerName: string | null, includePrePing: boolean): string {
  let content = ''
  
  // Header
  content += `===============================================\n`
  content += `API INTEGRATION SPECIFICATION\n`
  content += `===============================================\n`
  content += `Partner: ${partnerName || 'Integration'}\n`
  content += `Generated: ${new Date().toISOString()}\n`
  content += `Workflow: ${includePrePing ? '2-Step (Pre-Ping + Full Submission)' : 'Single-Step (Direct Submission)'}\n`
  content += `===============================================\n\n`

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
      content += `Dialer Type: ${campaign.dialerTypeString}\n`
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
        content += `  "dialer_type": "${campaign.dialerTypeString}",\n`
        content += `  "list_id": "${campaign.list_id}"\n`
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
      content += `  "dialer_type": "${campaign.dialerTypeString}",\n`
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
      content += `  "landing_page_url": "https://yoursite.com/form"\n`
      content += `}\n\n`

      content += `Response - SUCCESS:\n`
      if (includePrePing) {
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "message": "Lead submitted successfully",\n`
        content += `  "lead_id": "lead_123456789",\n`
        content += `  "estimated_bid": ${campaign.bid},\n`
        content += `  "routing_info": {\n`
        content += `    "dialer": "${campaign.dialerTypeString}",\n`
        content += `    "campaign": "${campaign.campaign_id}"\n`
        content += `  }\n`
        content += `}\n\n`
      } else {
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "message": "Lead submitted successfully",\n`
        content += `  "lead_id": "lead_123456789",\n`
        content += `  "bid": ${campaign.bid},\n`
        content += `  "dialer": {\n`
        content += `    "type": "${campaign.dialerTypeString}",\n`
        content += `    "forwarded": true,\n`
        content += `    "status": 200\n`
        content += `  }\n`
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
        content += `    "dialer_type": "${campaign.dialerTypeString}",\n`
        content += `    "list_id": "${campaign.list_id}"\n`
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
      content += `    "dialer_type": "${campaign.dialerTypeString}",\n`
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
      content += `    "ageRange": "35-44"\n`
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
