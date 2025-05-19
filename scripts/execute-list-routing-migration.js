// Execute the migration to create the list_routings table
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize the Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('Reading migration file...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add_list_routing_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('pgcrypto_migration', { query: migrationSQL });
    
    if (error) {
      console.error('Error executing migration:', error);
      throw error;
    }
    
    console.log('Migration executed successfully!');
    console.log('Result:', data);
    
    // Verify the table exists
    const { data: tableCheck, error: tableCheckError } = await supabase
      .from('list_routings')
      .select('id, list_id, campaign_id, cadence_id')
      .limit(5);
      
    if (tableCheckError) {
      console.warn('Could not verify table creation:', tableCheckError);
    } else {
      console.log('Verified table creation. Sample data:');
      console.table(tableCheck);
    }
    
  } catch (err) {
    console.error('Unhandled error:', err);
    process.exit(1);
  }
}

// Run the migration
runMigration();
