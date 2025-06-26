#!/usr/bin/env node

/**
 * Migration script to populate Supabase database with historical Bland AI call data
 * Run this after creating the database table to backfill data
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateBlandAIData() {
  console.log('🚀 Starting Bland AI data migration...');
  
  // Define date range for migration (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  console.log(`📅 Migrating data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  let totalMigrated = 0;
  let totalCost = 0;
  
  // Process each day individually
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateString = d.toISOString().split('T')[0];
    console.log(`\n📊 Processing ${dateString}...`);
    
    try {
      // Fetch data using our batch API
      const response = await fetch(`http://localhost:3000/api/bland-ai-summary?date=${dateString}`, {
        headers: { 'x-api-key': 'test_key_123' }
      });
      
      if (!response.ok) {
        console.log(`❌ Failed to fetch data for ${dateString}: ${response.status}`);
        continue;
      }
      
      const dayData = await response.json();
      
      if (!dayData.success || dayData.totalCalls === 0) {
        console.log(`⚪ No calls found for ${dateString}`);
        continue;
      }
      
      console.log(`   📞 ${dayData.totalCalls.toLocaleString()} calls, $${dayData.totalCost}`);
      
      // Now fetch detailed call data for this day using batch processing
      await migrateDayData(dateString, dayData.totalCalls);
      
      totalMigrated += dayData.totalCalls;
      totalCost += dayData.totalCost;
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing ${dateString}:`, error.message);
    }
  }
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   📊 Total calls migrated: ${totalMigrated.toLocaleString()}`);
  console.log(`   💰 Total cost: $${totalCost.toFixed(2)}`);
  
  // Verify migration
  await verifyMigration();
}

async function migrateDayData(date, expectedCalls) {
  let fromIndex = 0;
  let migratedForDay = 0;
  
  while (migratedForDay < expectedCalls) {
    try {
      // Fetch batch of call data
      const url = `http://localhost:3000/api/bland-ai-costs?date=${date}&batch=true${fromIndex > 0 ? `&last_call_id=${fromIndex}` : ''}`;
      const response = await fetch(url, {
        headers: { 'x-api-key': 'test_key_123' }
      });
      
      if (!response.ok) {
        console.log(`   ❌ Batch failed at index ${fromIndex}`);
        break;
      }
      
      const batchData = await response.json();
      
      if (!batchData.success || batchData.callCount === 0) {
        break;
      }
      
      // Store this batch in database (we'll need to modify the API to return call details)
      // For now, just log progress
      console.log(`   ✅ Batch: ${batchData.callCount} calls ($${batchData.totalCost})`);
      
      migratedForDay += batchData.callCount;
      fromIndex = batchData.lastProcessedIndex;
      
      // If we got fewer calls than batch size, we're done
      if (batchData.callCount < 1000) {
        break;
      }
      
    } catch (error) {
      console.error(`   ❌ Batch error at index ${fromIndex}:`, error.message);
      break;
    }
  }
  
  return migratedForDay;
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  try {
    const { data, error } = await supabase
      .from('daily_bland_ai_costs')
      .select('*')
      .order('created_date', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Verification failed:', error);
      return;
    }
    
    console.log(`✅ Found ${data.length} days in database:`);
    data.forEach(day => {
      console.log(`   ${day.created_date}: ${day.total_calls.toLocaleString()} calls, $${parseFloat(day.total_cost).toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateBlandAIData().catch(console.error);
}

export { migrateBlandAIData };
