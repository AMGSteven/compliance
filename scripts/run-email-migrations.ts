import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Connected to Supabase');

  try {
    // Read migration file
    const migrationFilePath = path.join(__dirname, '../migrations/create_email_optout_table.sql');
    const sql = fs.readFileSync(migrationFilePath, 'utf8');

    console.log('Running email tables migration...');
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error executing migrations:', error);
      process.exit(1);
    }

    console.log('Email tables migration completed successfully.');
  } catch (error) {
    console.error('Unexpected error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
