import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// Using jsPDF instead of @react-pdf/renderer to avoid React errors

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// GET - Generate API specification PDF for a partner or specific list ID
export async function GET(request: NextRequest) {
  try {
    console.log('🔥 PDF Generation Request:', request.url)
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partner_id')
    const listId = searchParams.get('list_id')
    const listIds = searchParams.get('list_ids') // Support multiple list IDs
    const partnerName = searchParams.get('partner_name')
    const campaignType = searchParams.get('campaign_type')
    const includePrePing = searchParams.get('include_pre_ping') === 'true'

    if (!partnerId && !listId && !listIds && !partnerName) {
      return NextResponse.json({ error: 'Missing required parameter: partner_id, list_id, list_ids, or partner_name' }, { status: 400 })
    }

    // Try to load routing configurations, but don't fail if none exist
    let allRoutings: any[] = []
    let query = supabase
      .from('list_routings')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (listId) {
      query = query.eq('list_id', listId)
    } else if (listIds) {
      // Handle multiple list IDs (comma-separated)
      const listIdArray = listIds.split(',').map(id => id.trim())
      query = query.in('list_id', listIdArray)
    }

    console.log('🔍 Executing database query for list_ids:', listIds)
    const { data: dbRoutings, error } = await query

    if (error) {
      console.warn('❌ Database error loading routing configs (non-fatal):', error)
      // Continue without routing data - we'll generate generic specs
    } else if (dbRoutings && dbRoutings.length > 0) {
      console.log('✅ Found routing data:', dbRoutings.length, 'records')
      console.log('📋 Routing data preview:', dbRoutings.map(r => ({ list_id: r.list_id, description: r.description })))
      allRoutings = dbRoutings
    } else {
      console.log('⚠️ No routing data found for the provided list_ids:', listIds)
    }

    // If we have routing data, use it. Otherwise, generate generic spec
    let routingsToUse: any[] = []
    
    if (allRoutings.length > 0) {
      routingsToUse = allRoutings
      // Only filter by partner name if we don't have specific list IDs
      if (partnerName && !listId && !listIds) {
        routingsToUse = allRoutings.filter(r => {
          const desc = r.description?.toLowerCase() || ''
          return desc.includes(partnerName.toLowerCase())
        })
      }
    }

    // If no routing data found, generate generic campaigns for the partner
    if (routingsToUse.length === 0) {
      console.log('No routing configurations found, generating generic PDF spec for:', partnerName)
      routingsToUse = generateGenericCampaignsForPDF(partnerName, campaignType)
    }

    // Group routings by partner and data source type
    const groupedRoutings = groupRoutingsByPartner(routingsToUse)
    console.log('📊 Grouped routings:', Object.keys(groupedRoutings))
    
    // Generate PDF
    console.log('📝 Generating PDF...')
    const title = partnerName || 'API'
    const pdfBuffer = await generateAPISpecPDF(groupedRoutings, title, includePrePing)

    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    let filename = `${title}-Integration-Specs`
    if (campaignType) filename = `${title}-${campaignType}-API-Specs`
    if (includePrePing) filename += '-with-PrePing'
    filename += '.pdf'
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)

    return new NextResponse(pdfBuffer, { status: 200, headers })

  } catch (error: any) {
    console.error('Unexpected error in generate-api-spec:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message || error.toString(),
      stack: error.stack 
    }, { status: 500 })
  }
}

function generateGenericCampaignsForPDF(partnerName: string | null, campaignType: string | null): any[] {
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
      // Remove dialer info from generic campaigns
      description: `${partnerName || 'Partner'} - ${type} Campaign`,
      active: true,
      created_at: new Date().toISOString()
    })
  })
  
  return campaigns
}

function groupRoutingsByPartner(routings: any[]) {
  const grouped: { [key: string]: { partner: string; campaigns: any[] } } = {}

  for (const routing of routings) {
    // Use the partner_name field from database, fall back to parsing description if needed
    let partnerName = routing.partner_name || 'Unknown Partner'
    const desc = routing.description?.toLowerCase() || ''
    
    // If partner_name is null/empty, try to extract from description as fallback
    if (!partnerName || partnerName.trim() === '') {
    if (desc.includes('pushnami')) {
      partnerName = 'Pushnami'
    } else if (desc.includes('citadel')) {
      partnerName = 'Citadel'
    } else if (desc.includes('employers')) {
      partnerName = 'Employers.io'
    } else if (desc.includes('fluent')) {
      partnerName = 'Fluent'
    } else if (desc.includes('juiced')) {
      partnerName = 'Juiced Media'
    } else if (desc.includes('iexecute') || desc.includes('iexcecute')) {
      partnerName = 'iExecute'
    } else if (desc.includes('onpoint')) {
      partnerName = 'Onpoint Global'
    } else if (desc.includes('ifficent')) {
      partnerName = 'Ifficent'
      } else if (desc.includes('interest media')) {
        partnerName = 'Interest Media'
      } else if (desc.includes('moxxi')) {
        partnerName = 'Moxxi'
      } else {
        partnerName = 'Unknown Partner'
      }
    }

    // Determine data source type and campaign name
    let dataSourceType = 'Standard'
    let campaignName = 'Campaign'
    
    if (desc.includes('on hour') || desc.includes('on-hour')) {
      dataSourceType = 'On Hours'
      campaignName = `${partnerName} On Hours`
    } else if (desc.includes('after hour') || desc.includes('off hour') || desc.includes('after-hour')) {
      dataSourceType = 'After Hours'
      campaignName = `${partnerName} After Hours`
    } else if (desc.includes('aged')) {
      dataSourceType = 'Aged Leads'
      campaignName = `${partnerName} Aged`
    }

    // Dialer info removed - not exposed to partners

    if (!grouped[partnerName]) {
      grouped[partnerName] = {
        partner: partnerName,
        campaigns: []
      }
    }

    grouped[partnerName].campaigns.push({
      name: campaignName,
      dataSourceType,
      // Remove dialer info from PDF campaigns
      listId: routing.list_id,
      campaignId: routing.campaign_id,
      cadenceId: routing.cadence_id,
      token: routing.token,
      bid: routing.bid || 0.30,
      description: routing.description
    })
  }

  return grouped
}

async function generateAPISpecPDF(groupedRoutings: any, title: string, includePrePing: boolean = false): Promise<Buffer> {
  // Create minimal PDF without React components
  const content = buildTextContent(groupedRoutings, title, includePrePing)
  
  // Use a simple PDF library approach
  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    
    // Split content into lines and add to PDF
    const lines = content.split('\n')
    let yPosition = 20
    const lineHeight = 6
    const pageHeight = 280
    
    for (const line of lines) {
      if (yPosition > pageHeight) {
        doc.addPage()
        yPosition = 20
      }
      
      if (line.trim()) {
        doc.setFontSize(line.startsWith('Campaign') || line.endsWith('Integration') ? 14 : 
                       line.startsWith('STEP') || line.startsWith('Full Lead') ? 12 : 10)
        doc.text(line, 10, yPosition)
      }
      yPosition += lineHeight
    }
    
    const pdfBuffer = doc.output('arraybuffer')
    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('jsPDF error, falling back to text:', error)
    // If jsPDF fails, return as text with PDF headers
    return Buffer.from(content, 'utf-8')
  }
}

function buildTextContent(groupedRoutings: any, title: string, includePrePing: boolean): string {
  let content = `${title} API Integration Specifications\n\n`
  
  // Authentication section
  content += `AUTHENTICATION:\n`
  content += `All API requests require Bearer token authentication.\n`
  content += `Include the following header in all requests:\n`
  content += `Authorization: Bearer YOUR_API_TOKEN\n`
  content += `Content-Type: application/json\n\n`
  
  Object.values(groupedRoutings).forEach((pg: any) => {
    content += `===============================================\n`
    content += `${pg.partner.toUpperCase()} INTEGRATION\n`
    content += `===============================================\n\n`
    
    pg.campaigns.forEach((c: any, i: number) => {
      content += `Campaign ${i + 1}: ${c.description}\n`
      content += `-----------------------------------------------\n`
      content += `List ID: ${c.listId}\n`
      content += `Campaign ID: ${c.campaignId}\n`
      content += `Cadence ID: ${c.cadenceId}\n`
      content += `API Token: ${c.token || 'N/A'}\n`
      content += `Bid Amount: $${c.bid}\n\n`
      
      if (includePrePing) {
        // Pre-ping step with full responses
        content += `STEP 1: PRE-PING VALIDATION\n`
        content += `Endpoint: POST https://compliance.juicedmedia.io/api/leads/pre-ping\n\n`
        
        content += `Request Body:\n`
        content += `{\n`
        content += `  "phone": "5551234567",\n`
        content += `  "state": "TX",\n`
        content += `  "firstName": "John",\n`
        content += `  "lastName": "Doe",\n`
        content += `  "email": "john@example.com",\n`
        content += `  "list_id": "${c.listId}",\n`
        content += `  "custom_fields": {\n`
        content += `    "subid": "12345"\n`
        content += `  }\n`
        content += `}\n\n`

        content += `Response - ACCEPTED:\n`
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "accepted": true,\n`
        content += `  "rejection_reasons": [],\n`
        content += `  "estimated_bid": ${c.bid},\n`
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
      content += `  "list_id": "${c.listId}",\n`
      content += `  "campaign_id": "${c.campaignId}",\n`
      content += `  "cadence_id": "${c.cadenceId}",\n`
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
        content += `  "estimated_bid": ${c.bid},\n`
        content += `  "routing_info": {\n`
        content += `    "campaign": "${c.campaignId}"\n`
        content += `  }\n`
        content += `}\n\n`
      } else {
        content += `{\n`
        content += `  "success": true,\n`
        content += `  "message": "Lead submitted successfully",\n`
        content += `  "lead_id": "lead_123456789",\n`
        content += `  "bid": ${c.bid},\n`
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
        content += `  -H "Authorization: Bearer ${c.token}" \\\n`
        content += `  -H "Content-Type: application/json" \\\n`
        content += `  -d '{\n`
        content += `    "phone": "6507769592",\n`
        content += `    "state": "TX",\n`
        content += `    "firstName": "John",\n`
        content += `    "lastName": "Doe",\n`
        content += `    "email": "john@example.com",\n`
        content += `    "list_id": "${c.listId}",\n`
        content += `    "custom_fields": {\n`
        content += `      "subid": "12345"\n`
        content += `    }\n`
        content += `  }'\n\n`

        content += `# Full Lead Submission (if pre-ping accepted)\n`
      } else {
        content += `TEST COMMAND (cURL):\n\n`
      }
      
      content += `curl -X POST https://compliance.juicedmedia.io/api/leads \\\n`
      content += `  -H "Authorization: Bearer ${c.token}" \\\n`
      content += `  -H "Content-Type: application/json" \\\n`
      content += `  -d '{\n`
      content += `    "phone": "6507769592",\n`
      content += `    "state": "TX",\n`
      content += `    "firstName": "John",\n`
      content += `    "lastName": "Doe",\n`
      content += `    "email": "john@example.com",\n`
      content += `    "list_id": "${c.listId}",\n`
      content += `    "campaign_id": "${c.campaignId}",\n`
      content += `    "cadence_id": "${c.cadenceId}",\n`
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
