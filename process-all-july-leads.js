import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from './lib/compliance/checkers/internal-dnc-checker.js'
import { SynergyDNCChecker } from './lib/compliance/checkers/synergy-dnc-checker.js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecordCompliance(record) {
  const result = {
    record,
    isCompliant: true,
    failureReasons: []
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

function convertToCSV(data) {
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

async function processAllJulyLeads() {
  console.log('🚀 Processing ALL July 2025 leads for DNC export...')
  
  const listId = 'pitch-bpo-list-1750372488308'
  const startDate = '2025-07-01'
  const endDate = '2025-07-31'
  
  // Step 1: Get ALL leads for this list in July using proper pagination
  console.log(`📊 Getting ALL leads for ${listId} in July 2025...`)
  
  let allLeads = []
  let hasMore = true
  let offset = 0
  const fetchBatchSize = 5000 // Fetch 5K at a time from database
  
  while (hasMore) {
    console.log(`📦 Fetching leads batch: ${offset} to ${offset + fetchBatchSize - 1}`)
    
    const { data: leadBatch, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, first_name, last_name, email, created_at, list_id')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .range(offset, offset + fetchBatchSize - 1)
      .order('created_at', { ascending: true })

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError)
      throw leadsError
    }

    if (leadBatch && leadBatch.length > 0) {
      allLeads.push(...leadBatch)
      offset += fetchBatchSize
      console.log(`   Got ${leadBatch.length} leads, total so far: ${allLeads.length}`)
      
      if (leadBatch.length < fetchBatchSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }
  
  console.log(`📊 Total leads retrieved: ${allLeads.length}`)
  
  if (allLeads.length === 0) {
    console.log('❌ No leads found!')
    return
  }
  
  // Step 2: Process ALL leads in 1K batches for DNC checking
  console.log('🔍 Checking ALL leads against DNC lists in 1K batches...')
  
  let allDncRecords = []
  const dncCheckBatchSize = 1000
  
  for (let i = 0; i < allLeads.length; i += dncCheckBatchSize) {
    const batch = allLeads.slice(i, i + dncCheckBatchSize)
    const batchNum = Math.floor(i / dncCheckBatchSize) + 1
    const totalBatches = Math.ceil(allLeads.length / dncCheckBatchSize)
    
    console.log(`🧪 Processing DNC batch ${batchNum}/${totalBatches}: ${batch.length} leads`)
    
    // Check this batch for DNC compliance
    const batchResults = await Promise.all(
      batch.map(lead => checkRecordCompliance(lead))
    )
    
    // Get DNCs from this batch
    const batchDncs = batchResults
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
    
    allDncRecords.push(...batchDncs)
    console.log(`   └─ Found ${batchDncs.length} DNCs in this batch (${allDncRecords.length} total so far)`)
  }
  
  console.log(`✅ FINAL RESULTS:`)
  console.log(`   📋 Total leads processed: ${allLeads.length}`)
  console.log(`   🚫 Total DNC matches: ${allDncRecords.length}`)
  console.log(`   📊 DNC rate: ${((allDncRecords.length / allLeads.length) * 100).toFixed(2)}%`)
  
  // Step 3: Generate CSV and store in database
  const csvData = convertToCSV(allDncRecords)
  
  console.log('💾 Storing results in database...')
  
  const { error: insertError } = await supabase
    .from('monthly_dnc_exports')
    .upsert({
      list_id: listId,
      year: 2025,
      month: 7,
      total_leads: allLeads.length,
      dnc_matches: allDncRecords.length,
      csv_data: csvData,
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }, {
      onConflict: 'list_id,year,month'
    })

  if (insertError) {
    console.error('❌ Error storing results:', insertError)
    throw insertError
  }
  
  console.log('🎉 COMPLETE! July 2025 DNC export updated with ALL leads.')
  console.log(`📁 CSV contains ${allDncRecords.length} DNC records ready for download`)
}

processAllJulyLeads().catch(console.error)
