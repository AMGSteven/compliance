import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function createTable() {
  console.log('🔧 Creating monthly_dnc_exports table...')
  
  const createTableSQL = `
    -- Create table to store monthly DNC export results
    CREATE TABLE IF NOT EXISTS monthly_dnc_exports (
        id SERIAL PRIMARY KEY,
        list_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_leads INTEGER NOT NULL DEFAULT 0,
        dnc_matches INTEGER NOT NULL DEFAULT 0,
        csv_data TEXT,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        
        -- Ensure one record per list_id/year/month combination
        CONSTRAINT unique_monthly_dnc_export UNIQUE (list_id, year, month)
    );
  `
  
  const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
  
  if (error) {
    console.error('❌ Error creating table:', error)
    
    // Try alternative approach - just test if we can insert a record
    console.log('🔄 Trying alternative approach...')
    
    const { error: insertError } = await supabase
      .from('monthly_dnc_exports')
      .insert({
        list_id: 'test-list',
        year: 2025,
        month: 7,
        total_leads: 100,
        dnc_matches: 5,
        csv_data: 'phone_number,return_reason\n5551234567,user claimed to never have opted in',
        processed_at: new Date().toISOString()
      })
    
    if (insertError) {
      console.error('❌ Table does not exist, error:', insertError)
      console.log('ℹ️  You need to create the table in Supabase SQL Editor manually')
      console.log('📋 Copy this SQL and run it in Supabase:')
      console.log(createTableSQL)
    } else {
      console.log('✅ Table exists and working! Cleaning up test record...')
      await supabase
        .from('monthly_dnc_exports')
        .delete()
        .eq('list_id', 'test-list')
    }
  } else {
    console.log('✅ Table created successfully!')
  }
}

createTable().catch(console.error)
