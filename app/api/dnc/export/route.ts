import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker'
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecordCompliance(record: any) {
  const result = {
    record,
    isCompliant: true,
    failureReasons: [] as string[],
    checks: {}
  }

  try {
    const phone = record.phone || record.Phone || record.phone_number || record.PhoneNumber || ''
    
    if (!phone) {
      result.isCompliant = false
      result.failureReasons.push('Missing phone number')
      return result
    }

    // Check Internal DNC
    const internalDNCChecker = new InternalDNCChecker()
    const internalDNCResult = await internalDNCChecker.checkNumber(phone)
    
    if (!internalDNCResult.isCompliant) {
      result.isCompliant = false
      const reasons = internalDNCResult.reasons || ['Found in Internal DNC list']
      result.failureReasons.push(...reasons)
    }

    // Check Synergy DNC  
    const synergyDNCChecker = new SynergyDNCChecker()
    const synergyDNCResult = await synergyDNCChecker.checkNumber(phone)
    
    if (!synergyDNCResult.isCompliant) {
      result.isCompliant = false
      const reasons = synergyDNCResult.reasons || ['Found in Synergy DNC list']
      result.failureReasons.push(...reasons)
    }

  } catch (error) {
    console.error('Error checking record compliance:', error)
    result.isCompliant = false
    result.failureReasons.push('Error during compliance check')
  }

  return result
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = ['phone_number', 'return_reason', 'first_name', 'last_name', 'email', 'lead_created_at', 'list_id']
  const csvLines = [headers.join(',')]
  
  data.forEach(record => {
    const values = headers.map(header => {
      const value = record[header] || ''
      return `"${value.toString().replace(/"/g, '""')}"`
    })
    csvLines.push(values.join(','))
  })
  
  return csvLines.join('\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const list_id = searchParams.get('list_id')
  const start_date = searchParams.get('start_date')
  const end_date = searchParams.get('end_date')
  const format = searchParams.get('format') || 'csv'

  if (!start_date || !end_date) {
    return NextResponse.json(
      { success: false, error: 'start_date and end_date are required' },
      { status: 400 }
    )
  }

  console.log(`🚀 DNC EXPORT for list_id: ${list_id} from ${start_date} to ${end_date}`)

  try {
    // STEP 1: Get leads from the specified list_id and time period
    let leadsQuery = supabase
      .from('leads')
      .select('id, phone, first_name, last_name, email, created_at, list_id')
      .gte('created_at', start_date)
      .lte('created_at', end_date + 'T23:59:59.999Z')

    if (list_id) {
      leadsQuery = leadsQuery.eq('list_id', list_id)
    }

    const { data: leads, error: leadsError } = await leadsQuery.limit(100000)

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError)
      throw leadsError
    }

    if (!leads || leads.length === 0) {
      console.log('📊 No leads found')
      return NextResponse.json({
        success: true,
        data: format === 'csv' ? '' : [],
        message: 'No leads found for the specified criteria'
      })
    }

    console.log(`📊 Found ${leads.length} leads, checking them against DNC...`)

    // STEP 2: Use the existing batch compliance checker
    const results = await Promise.all(
      leads.map(lead => checkRecordCompliance(lead))
    )

    // STEP 3: Get the non-compliant (DNC) records
    const dncRecords = results
      .filter(r => !r.isCompliant)
      .map(r => ({
        phone_number: r.record.phone,
        return_reason: 'user claimed to never have opted in',
        first_name: r.record.first_name || '',
        last_name: r.record.last_name || '',
        email: r.record.email || '',
        lead_created_at: r.record.created_at,
        list_id: r.record.list_id
      }))

    console.log(`✅ Found ${dncRecords.length} DNC matches out of ${leads.length} leads`)

    if (format === 'csv') {
      return new Response(convertToCSV(dncRecords), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="dnc-export-${list_id || 'all'}-${start_date}-${end_date}.csv"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: dncRecords,
      total_leads: leads.length,
      dnc_matches: dncRecords.length
    })

  } catch (error) {
    console.error('❌ DNC Export Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export DNC entries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
