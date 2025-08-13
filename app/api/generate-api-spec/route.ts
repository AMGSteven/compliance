import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// GET - Generate API specification PDF for a partner or specific list ID
export async function GET(request: NextRequest) {
  try {
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

    const { data: dbRoutings, error } = await query

    if (error) {
      console.warn('Database error loading routing configs (non-fatal):', error)
      // Continue without routing data - we'll generate generic specs
    } else if (dbRoutings && dbRoutings.length > 0) {
      allRoutings = dbRoutings
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
    
    // Generate PDF
    const pdfBuffer = await generateAPISpecPDF(groupedRoutings, partnerName || 'API Integration', includePrePing)

    // Return PDF as downloadable file
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    
    // Generate appropriate filename
    let filename = `${partnerName || 'API'}-Integration-Specs`
    if (campaignType) {
      filename = `${partnerName || 'API'}-${campaignType}-API-Specs`
    }
    if (includePrePing) {
      filename += '-with-PrePing'
    }
    filename += '.pdf'
    
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers
    })

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
    // Determine partner name from description or list_id
    let partnerName = 'Unknown Partner'
    const desc = routing.description?.toLowerCase() || ''
    
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
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        autoFirstPage: true,
        bufferPages: true
      })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (error) => reject(error))

      // Title page
      doc.fontSize(24).text(title + ' API Integration Specifications', { align: 'center' })
      doc.moveDown(2)

      // Generate specs for each partner
      Object.values(groupedRoutings).forEach((partnerGroup: any, partnerIndex) => {
        if (partnerIndex > 0) doc.addPage()
        
        doc.fontSize(20).text(`${partnerGroup.partner} Integration`, { underline: true })
        doc.moveDown()

        partnerGroup.campaigns.forEach((campaign: any, campaignIndex: number) => {
          if (campaignIndex > 0) doc.moveDown(2)
          
          // Campaign header
          doc.fontSize(16).text(`Campaign ${campaignIndex + 1}: ${campaign.name}`, { underline: true })
          doc.moveDown()
          
          // Campaign details
          doc.fontSize(12).text('Campaign Details', { underline: true })
          doc.fontSize(10)
          doc.text(`• List ID: ${campaign.listId}`)
          doc.text(`• Campaign ID: ${campaign.campaignId}`)
          doc.text(`• Cadence ID: ${campaign.cadenceId}`)
          doc.text(`• API Token: ${campaign.token || 'N/A'}`)
          doc.text(`• Bid Amount: $${campaign.bid}`)
          doc.moveDown()

          // API endpoint details - conditional based on includePrePing
          if (includePrePing) {
            // Step 1: Pre-Ping API
            doc.fontSize(12).text('STEP 1: Pre-Ping API (Lead Validation)', { underline: true })
            doc.fontSize(10)
            doc.text('Endpoint:')
            doc.text('POST https://compliance.juicedmedia.io/api/leads/pre-ping')
            doc.moveDown(0.5)
            
            doc.text('Headers:')
            doc.text(`Authorization: Bearer ${campaign.token || 'YOUR_TOKEN'}`)
            doc.text('Content-Type: application/json')
            doc.moveDown(0.5)

            // Pre-ping request body
            doc.text('Request Body:')
            doc.fontSize(8)
            const prePingBody = JSON.stringify({
              "phone": "5551234567",
              "state": "TX",
              "firstName": "John",
              "lastName": "Doe",
              "email": "john@example.com",
              "list_id": campaign.listId,
              "custom_fields": {
                "subid": "12345"
              }
            }, null, 2)
            
            doc.text(prePingBody)
            doc.fontSize(10)
            doc.moveDown()

            // Pre-ping responses
            doc.text('Response - ACCEPTED:')
            doc.fontSize(8)
            const acceptedResponse = JSON.stringify({
              "success": true,
              "accepted": true,
              "rejection_reasons": [],
              "estimated_bid": campaign.bid,
              "checks": {
                "duplicate": { "isCompliant": true },
                "state": { "isCompliant": true },
                "compliance": { "isCompliant": true }
              },
              "processing_time_ms": 1200
            }, null, 2)
            
            doc.text(acceptedResponse)
            doc.fontSize(10)
            doc.moveDown()

            doc.text('Response - REJECTED:')
            doc.fontSize(8)
            const rejectedResponse = JSON.stringify({
              "success": true,
              "accepted": false,
              "rejection_reasons": ["Internal DNC List: Phone blocked"],
              "estimated_bid": 0,
              "checks": {
                "duplicate": { "isCompliant": true },
                "state": { "isCompliant": true },
                "compliance": { "isCompliant": false, "reason": "Failed compliance checks" }
              },
              "processing_time_ms": 1200
            }, null, 2)
            
            doc.text(rejectedResponse)
            doc.fontSize(10)
            doc.moveDown(2)

            // Step 2: Full Lead Submission
            doc.fontSize(12).text('STEP 2: Full Lead Submission (Only if Pre-Ping Accepted)', { underline: true })
            doc.fontSize(10)
            doc.text('Endpoint:')
            doc.text('POST https://compliance.juicedmedia.io/api/leads')
            doc.moveDown(0.5)
          } else {
            // Original single-step API
            doc.fontSize(12).text('Full Lead Submission', { underline: true })
            doc.fontSize(10)
            doc.text('Endpoint:')
            doc.text('POST https://compliance.juicedmedia.io/api/leads')
            doc.moveDown(0.5)
          }
          
          doc.text('Headers:')
          doc.text(`Authorization: Bearer ${campaign.token || 'YOUR_TOKEN'}`)
          doc.text('Content-Type: application/json')
          doc.moveDown(0.5)

          // Request body example
          doc.text('Request Body Example:')
          doc.fontSize(8)
          const requestExample = JSON.stringify({
            "phone": "5551234567",
            "state": "TX",
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com",
            "list_id": campaign.listId,
            "campaign_id": campaign.campaignId,
            "cadence_id": campaign.cadenceId,
            "address": "123 Main St",
            "city": "Dallas",
            "zip": "75201",
            "age": "35",
            "gender": "M",
            "incomeBracket": "50000-75000",
            "homeownerStatus": "Own",
            "ageRange": "35-44",
            "trusted_form_cert_url": "https://cert.trustedform.com/...",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0...",
            "landing_page_url": "https://yoursite.com/form",
            "custom_fields": {
              "subid": "12345"
            }
          }, null, 2)
          
          doc.text(requestExample)
          doc.fontSize(10)
          doc.moveDown()

          // Response example (different for pre-ping vs standard)
          doc.text('Response - SUCCESS:')
          doc.fontSize(8)
          const responseBody = includePrePing ? JSON.stringify({
            "success": true,
            "message": "Lead submitted successfully",
            "lead_id": "lead_123456789",
            "estimated_bid": campaign.bid,
            "routing_info": {
              "campaign": campaign.campaignId
            }
          }, null, 2) : JSON.stringify({
            "success": true,
            "message": "Lead submitted successfully",
            "lead_id": "lead_123456789",
            "bid": campaign.bid,
            "status": "processed"
          }, null, 2)
          
          doc.text(responseBody)
          doc.fontSize(10)
          doc.moveDown()

          // cURL test command - different for pre-ping vs standard
          if (includePrePing) {
            // Add Integration Workflow section first
            doc.moveDown()
            doc.fontSize(12).text('Integration Workflow', { underline: true })
            doc.fontSize(10).text('Recommended Process')
            doc.text('• Pre-validate every lead using the pre-ping API')
            doc.text('• Only submit leads where "accepted": true')
            doc.text('• Ensure all required fields are present in full submission')
            doc.text('• Monitor responses for issues or errors')
            doc.moveDown()
            
            doc.text('Test Commands (cURL):')
            doc.fontSize(8)
            
            // Pre-ping test command
            doc.text('# Pre-Ping Test')
            const prePingCurl = `curl -X POST https://compliance.juicedmedia.io/api/leads/pre-ping \\
  -H "Authorization: Bearer ${campaign.token || 'YOUR_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "6507769592",
    "state": "TX",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "list_id": "${campaign.listId}",
    "custom_fields": {
      "subid": "12345"
    }
  }'`
            
            doc.text(prePingCurl)
            doc.moveDown()
            
            // Full submission test command
            doc.text('# Full Lead Submission (if pre-ping accepted)')
            const fullCurl = `curl -X POST https://compliance.juicedmedia.io/api/leads \\
  -H "Authorization: Bearer ${campaign.token || 'YOUR_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "6507769592",
    "state": "TX",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "list_id": "${campaign.listId}",
    "campaign_id": "${campaign.campaignId}",
    "cadence_id": "${campaign.cadenceId}",
    "address": "123 Main St",
    "city": "Dallas",
    "zip": "75201",
    "age": "35",
    "gender": "M",
    "incomeBracket": "50000-75000",
    "homeownerStatus": "Own",
    "ageRange": "35-44",
    "custom_fields": {
      "subid": "12345"
    }
  }'`
            
            doc.text(fullCurl)
          } else {
            // Standard single-step test command
            doc.text('Test Command (cURL):')
            doc.fontSize(8)
            const curlCommand = `curl -X POST https://compliance.juicedmedia.io/api/leads \\
  -H "Authorization: Bearer ${campaign.token || 'YOUR_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "6507769592",
    "state": "TX",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "list_id": "${campaign.listId}",
    "campaign_id": "${campaign.campaignId}",
    "cadence_id": "${campaign.cadenceId}",
    "address": "123 Main St",
    "city": "Dallas",
    "zip": "75201",
    "age": "35",
    "gender": "M",
    "incomeBracket": "50000-75000",
    "homeownerStatus": "Own",
    "ageRange": "35-44",
    "custom_fields": {
      "subid": "12345"
    }
  }'`
            
            doc.text(curlCommand)
          }
          
          doc.fontSize(10)
        })
      })

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}
