import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// List ID for Onpoint Global from your previous queries
const onpointListId = '1b759535-2a5e-421e-9371-3bde7f855c60' 

async function countLeads() {
  console.log(`Directly counting ALL leads for List ID: ${onpointListId}`)
  
  // First, get the routing info for this list
  const { data: routing, error: routingError } = await supabase
    .from('list_routings')
    .select('*')
    .eq('list_id', onpointListId)
    .eq('active', true)
    .single()
  
  if (routingError) {
    console.error('Error fetching routing:', routingError)
    return
  }
  
  console.log('Found routing:', routing)
  console.log(`Bid amount: $${routing.bid}`)
  
  // Count total leads for this list ID
  const { count: totalCount, error: totalError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', onpointListId)
  
  if (totalError) {
    console.error('Error counting total leads:', totalError)
  } else {
    console.log(`Total leads for this list ID: ${totalCount}`)
  }
  
  // Count by status
  const statuses = ['success', 'pending', 'error', 'rejected']
  
  for (const status of statuses) {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', onpointListId)
      .eq('status', status)
    
    if (error) {
      console.error(`Error counting ${status} leads:`, error)
    } else {
      console.log(`${status} leads: ${count}`)
      
      if (status === 'success') {
        console.log(`Revenue from successful leads: $${(count * routing.bid).toFixed(2)}`)
      }
    }
  }
}

countLeads()
  .catch(console.error)
  .finally(() => {
    console.log('Query complete')
  })
