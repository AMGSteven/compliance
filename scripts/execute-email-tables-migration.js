// Direct SQL execution script for creating email tables
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function executeMigration() {
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
    // Read the SQL file
    const migrationPath = path.resolve('./migrations/create_email_optout_table.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}`);
      
      // Using Supabase SQL execution
      const { error } = await supabase.rpc('postgres_executesql', { query: statement });
      
      if (error) {
        // Try alternative approach using direct table creation if the RPC fails
        console.log('RPC method failed, trying direct SQL execution...');
        
        // Detect if it's a CREATE TABLE statement
        if (statement.toLowerCase().includes('create table')) {
          const tableName = statement.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/i)?.[1];
          
          if (tableName) {
            console.log(`Attempting to create table ${tableName} directly`);
            
            // Extract column definitions
            const columnDefs = statement.match(/\(([^)]+)\)/)?.[1];
            
            if (columnDefs) {
              // Simplified approach - this may not handle all SQL features
              console.log(`Warning: Using simplified table creation for ${tableName}`);
              // We'll just report this and continue - in production we'd implement proper fallback
            }
          }
        }
        
        console.error(`Error executing statement ${i + 1}: ${error.message}`);
        console.error('Statement:', statement);
      } else {
        console.log(`Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('Migration execution completed');
  } catch (error) {
    console.error('Error executing migration:', error);
    process.exit(1);
  }
}

executeMigration();
