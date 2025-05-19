// Script to execute the compliance fields migration
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set');
  process.exit(1);
}

// Initialize Supabase client with service key for admin rights
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(process.cwd(), 'migrations', 'add_compliance_fields.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });

    if (error) {
      throw error;
    }

    console.log('Migration completed successfully!');
    console.log('Added the following compliance fields:');
    console.log('- age_range: Alternative to birth_date/dob for compliance');
    console.log('- state: Ensured state column exists for compliance reporting');
    
    // Double check the table structure
    const { data, error: schemaError } = await supabase
      .rpc('exec_sql', { 
        sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('age_range', 'state', 'house_hold_income', 'birth_date', 'residence_type');" 
      });
      
    if (schemaError) {
      console.error('Error checking schema:', schemaError);
    } else {
      console.log('\nConfirmed existing compliance fields:');
      data.forEach(col => {
        console.log(`- ${col.column_name}`);
      });
    }
  } catch (error) {
    console.error('Error executing migration:', error);
    process.exit(1);
  }
}

main();
