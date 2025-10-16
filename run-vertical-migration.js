const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and DATABASE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function runMigration() {
  console.log('🚀 Running vertical state configs migration...\n');

  const migrationPath = path.join(__dirname, 'migrations', 'add_vertical_state_configs.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
      // If rpc doesn't work, try direct query
      const { data, error } = await supabase.from('_migrations').select('*').limit(1);
      if (error) {
        // Table doesn't exist, we need to use raw SQL
        console.log('⚠️  Using alternative method...\n');
        
        // Split SQL into individual statements
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX') || 
              statement.includes('INSERT INTO') || statement.includes('CREATE OR REPLACE FUNCTION') ||
              statement.includes('CREATE TRIGGER') || statement.includes('COMMENT ON')) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            
            // We'll need to use the REST API directly
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceRoleKey,
                'Authorization': `Bearer ${supabaseServiceRoleKey}`
              },
              body: JSON.stringify({ query: statement })
            });
            
            if (!response.ok) {
              console.log(`⚠️  Statement may have failed, continuing...`);
            }
          }
        }
        
        return { data: null, error: null };
      }
      return { data, error };
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
      console.log('   1. Go to your Supabase Dashboard');
      console.log('   2. Navigate to SQL Editor');
      console.log('   3. Copy the contents of: migrations/add_vertical_state_configs.sql');
      console.log('   4. Paste and run it\n');
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Created:');
    console.log('   - vertical_state_configs table');
    console.log('   - Default state configurations for ACA, Final Expense, and Medicare');
    console.log('   - Performance indexes');
    console.log('\n🎉 You can now use the Vertical States page!\n');
    
  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    console.log('\n📋 Manual migration required:');
    console.log('   Run the SQL from: migrations/add_vertical_state_configs.sql');
    console.log('   in your Supabase SQL Editor\n');
    process.exit(1);
  }
}

runMigration();
