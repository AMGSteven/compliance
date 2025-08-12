import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    console.log('[setup-monthly-dnc] Creating monthly_dnc_export_jobs table...')
    
    // Create the monthly_dnc_export_jobs table
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS monthly_dnc_export_jobs (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
            progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
            filters JSONB DEFAULT '{}',
            
            -- Job timing
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            
            -- Results summary
            total_lists_processed INTEGER DEFAULT 0,
            total_leads_found INTEGER DEFAULT 0,
            total_dnc_matches INTEGER DEFAULT 0,
            
            -- Error handling
            error_message TEXT,
            
            -- Metadata
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );

        -- Create indexes for faster queries
        CREATE INDEX IF NOT EXISTS idx_monthly_dnc_export_jobs_status 
        ON monthly_dnc_export_jobs (status);

        CREATE INDEX IF NOT EXISTS idx_monthly_dnc_export_jobs_year_month 
        ON monthly_dnc_export_jobs (year, month);

        CREATE INDEX IF NOT EXISTS idx_monthly_dnc_export_jobs_created_at 
        ON monthly_dnc_export_jobs (created_at);
      `
    })

    if (createError) {
      console.error('[setup-monthly-dnc] Error creating table:', createError)
      // Try alternative approach with direct SQL execution
      const { error: altError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'monthly_dnc_export_jobs')
        .single()

      if (altError && altError.code === 'PGRST116') {
        // Table doesn't exist, let's create it through raw SQL if possible
        console.log('[setup-monthly-dnc] Table does not exist, creating via direct client...')
        
        return NextResponse.json({
          success: false,
          error: 'Unable to create table via RPC. Please create the table manually in Supabase dashboard.',
          sql: `
CREATE TABLE monthly_dnc_export_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_lists_processed INTEGER DEFAULT 0,
    total_leads_found INTEGER DEFAULT 0,
    total_dnc_matches INTEGER DEFAULT 0,
    error_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monthly_dnc_export_jobs_status ON monthly_dnc_export_jobs (status);
CREATE INDEX idx_monthly_dnc_export_jobs_year_month ON monthly_dnc_export_jobs (year, month);
CREATE INDEX idx_monthly_dnc_export_jobs_created_at ON monthly_dnc_export_jobs (created_at);
          `
        })
      }
    }

    // Test that we can insert/read from the table
    const testJobId = `test-${Date.now()}`
    const { error: insertError } = await supabase
      .from('monthly_dnc_export_jobs')
      .insert({
        id: testJobId,
        status: 'pending',
        progress: 0,
        year: 2025,
        month: 8,
        filters: { test: true }
      })

    if (insertError) {
      console.error('[setup-monthly-dnc] Error testing table insert:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Table created but insert test failed: ' + insertError.message
      })
    }

    // Clean up test record
    await supabase
      .from('monthly_dnc_export_jobs')
      .delete()
      .eq('id', testJobId)

    console.log('[setup-monthly-dnc] Setup completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Monthly DNC export tables created successfully',
      tables_created: ['monthly_dnc_export_jobs'],
      ready_for_use: true
    })

  } catch (error) {
    console.error('[setup-monthly-dnc] Setup failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown setup error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if tables exist and are working
    const { data, error } = await supabase
      .from('monthly_dnc_export_jobs')
      .select('id')
      .limit(1)

    if (error) {
      return NextResponse.json({
        success: false,
        table_exists: false,
        error: error.message,
        recommendation: 'Run POST /api/setup-monthly-dnc to create tables'
      })
    }

    return NextResponse.json({
      success: true,
      table_exists: true,
      message: 'Monthly DNC export system is ready',
      total_jobs: data?.length || 0
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
