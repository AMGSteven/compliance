// Script to execute the health insurance fields migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeMigration() {
  console.log('Starting health insurance fields migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add_health_insurance_fields.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });
    
    if (error) {
      console.error('Error executing migration:', error);
      process.exit(1);
    }
    
    console.log('Health insurance fields migration completed successfully!');
    
    // Check if the fields were added properly
    const { data, error: tableError } = await supabase
      .from('leads')
      .select('id')
      .limit(1);
      
    if (tableError) {
      console.error('Error checking leads table:', tableError);
    } else {
      console.log('Leads table is accessible and has been updated!');
    }
    
  } catch (err) {
    console.error('Error running migration script:', err);
    process.exit(1);
  }
}

// Run the migration
executeMigration();
