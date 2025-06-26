import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    
    console.log('Setting up database tables...');
    
    // Step 1: Add policy_postback_date column if it doesn't exist
    console.log('Adding policy_postback_date column...');
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE leads ADD COLUMN IF NOT EXISTS policy_postback_date TIMESTAMPTZ;`
    });
    
    if (columnError && !columnError.message.includes('already exists')) {
      console.error('Error adding column:', columnError);
      return NextResponse.json({ success: false, error: columnError.message }, { status: 500 });
    }
    
    // Step 2: Create policy_postbacks audit table
    console.log('Creating policy_postbacks table...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS policy_postbacks (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          lead_id UUID REFERENCES leads(id),
          compliance_lead_id TEXT,
          policy_status TEXT NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (tableError) {
      console.error('Error creating table:', tableError);
      return NextResponse.json({ success: false, error: tableError.message }, { status: 500 });
    }
    
    // Step 3: Create indexes
    console.log('Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_leads_policy_postback_date ON leads(policy_postback_date);
        CREATE INDEX IF NOT EXISTS idx_leads_policy_status_postback_date ON leads(policy_status, policy_postback_date);
        CREATE INDEX IF NOT EXISTS idx_policy_postbacks_created_at ON policy_postbacks(created_at);
        CREATE INDEX IF NOT EXISTS idx_policy_postbacks_lead_id ON policy_postbacks(lead_id);
      `
    });
    
    if (indexError) {
      console.error('Error creating indexes:', indexError);
      return NextResponse.json({ success: false, error: indexError.message }, { status: 500 });
    }
    
    console.log('Database setup completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database tables and indexes created successfully'
    });
    
  } catch (error) {
    console.error('Error setting up tables:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to setup database tables' },
      { status: 500 }
    );
  }
}
