// Find leads without vertical associations
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and DATABASE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function findMissingVerticals() {
  console.log('🔍 Finding leads without vertical associations...\n');

  try {
    // Get all unique list_ids from leads (sample recent leads)
    console.log('📊 Fetching unique list_ids from leads table...');
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('list_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError.message);
      return;
    }

    // Get unique list_ids
    const uniqueListIds = [...new Set(leads.map(l => l.list_id).filter(Boolean))];
    console.log(`   ✅ Found ${uniqueListIds.length} unique list_ids\n`);

    // Get all list_routings
    console.log('📊 Fetching list_routings...');
    const { data: routings, error: routingsError } = await supabase
      .from('list_routings')
      .select('list_id, vertical, description, partner_name, dialer_type, active');

    if (routingsError) {
      console.error('❌ Error fetching list_routings:', routingsError.message);
      return;
    }

    console.log(`   ✅ Found ${routings.length} list_routing entries\n`);

    // Create map of list_id to routing info
    const routingsMap = new Map();
    routings.forEach(r => {
      routingsMap.set(r.list_id, r);
    });

    // Find list_ids without verticals
    const missingVerticals = [];
    const nullVerticals = [];

    for (const listId of uniqueListIds) {
      const routing = routingsMap.get(listId);
      
      // Count leads for this list_id
      const leadsForList = leads.filter(l => l.list_id === listId);
      const leadCount = leadsForList.length;
      const firstLead = leadsForList.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      )[0];
      const lastLead = leadsForList.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )[0];

      if (!routing) {
        missingVerticals.push({
          list_id: listId,
          lead_count: leadCount,
          first_seen: firstLead?.created_at,
          last_seen: lastLead?.created_at,
          status: 'NO_ROUTING_ENTRY'
        });
      } else if (!routing.vertical || routing.vertical === '') {
        nullVerticals.push({
          list_id: listId,
          lead_count: leadCount,
          first_seen: firstLead?.created_at,
          last_seen: lastLead?.created_at,
          description: routing.description,
          partner_name: routing.partner_name,
          dialer_type: routing.dialer_type,
          active: routing.active,
          status: 'NULL_VERTICAL'
        });
      }
    }

    // Display results
    console.log('='.repeat(80));
    console.log('📋 LEADS WITHOUT VERTICAL ASSOCIATIONS');
    console.log('='.repeat(80));
    console.log();

    if (missingVerticals.length > 0) {
      console.log(`❌ ${missingVerticals.length} list_ids with NO list_routing entry:\n`);
      missingVerticals.forEach((item, idx) => {
        console.log(`${idx + 1}. List ID: ${item.list_id}`);
        console.log(`   Lead Count: ${item.lead_count}`);
        console.log(`   First Seen: ${item.first_seen}`);
        console.log(`   Last Seen: ${item.last_seen}`);
        console.log(`   Status: ${item.status}\n`);
      });
    }

    if (nullVerticals.length > 0) {
      console.log(`⚠️  ${nullVerticals.length} list_ids with NULL/empty vertical:\n`);
      nullVerticals.forEach((item, idx) => {
        console.log(`${idx + 1}. List ID: ${item.list_id}`);
        console.log(`   Lead Count: ${item.lead_count}`);
        console.log(`   Description: ${item.description || 'N/A'}`);
        console.log(`   Partner: ${item.partner_name || 'N/A'}`);
        console.log(`   Dialer Type: ${item.dialer_type}`);
        console.log(`   Active: ${item.active}`);
        console.log(`   First Seen: ${item.first_seen}`);
        console.log(`   Last Seen: ${item.last_seen}\n`);
      });
    }

    if (missingVerticals.length === 0 && nullVerticals.length === 0) {
      console.log('✅ All leads have vertical associations!\n');
      return;
    }

    // Generate SQL fixes
    console.log('='.repeat(80));
    console.log('🔧 SQL FIX COMMANDS');
    console.log('='.repeat(80));
    console.log();

    if (nullVerticals.length > 0) {
      console.log('-- Update existing list_routings with NULL verticals:\n');
      nullVerticals.forEach(item => {
        const suggestedVertical = suggestVertical(item);
        console.log(`-- ${item.list_id} (${item.description || 'Unknown'}) - ${item.lead_count} leads`);
        console.log(`UPDATE list_routings SET vertical = '${suggestedVertical}' WHERE list_id = '${item.list_id}';`);
        console.log();
      });
    }

    if (missingVerticals.length > 0) {
      console.log('-- Create list_routing entries for orphaned list_ids:\n');
      missingVerticals.forEach(item => {
        console.log(`-- ${item.list_id} (${item.lead_count} leads)`);
        console.log(`INSERT INTO list_routings (list_id, campaign_id, cadence_id, vertical, dialer_type, active, bid, created_at, updated_at)`);
        console.log(`VALUES ('${item.list_id}', 'unknown-campaign', 'unknown-cadence', 'ACA', 1, false, 0.00, NOW(), NOW());`);
        console.log();
      });
    }

    console.log('='.repeat(80));
    console.log('📝 NEXT STEPS');
    console.log('='.repeat(80));
    console.log();
    console.log('1. Review the SQL commands above');
    console.log('2. Adjust vertical values based on campaign type:');
    console.log('   - ACA (Affordable Care Act / Health Insurance)');
    console.log('   - Final Expense');
    console.log('   - Medicare');
    console.log('3. Run the SQL in Supabase SQL Editor');
    console.log('4. Re-run this script to verify fixes');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

function suggestVertical(routing) {
  const name = (routing.description || routing.partner_name || '').toLowerCase();
  
  if (name.includes('aca') || name.includes('health') || name.includes('insurance')) {
    return 'ACA';
  }
  if (name.includes('final') || name.includes('expense')) {
    return 'Final Expense';
  }
  if (name.includes('medicare')) {
    return 'Medicare';
  }
  
  // Default to ACA for health insurance leads
  return 'ACA';
}

findMissingVerticals();
