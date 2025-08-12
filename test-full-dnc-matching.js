// Test DNC matching on ALL 65k July leads
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Copy the normalize function from the API
function normalizePhone(phone) {
  if (!phone) return ''
  
  // Remove all non-digits first
  const digits = phone.replace(/\D/g, '')
  
  // Handle various prefixes and lengths
  if (digits.startsWith('1') && digits.length === 11) {
    return digits.substring(1) // Remove country code 1
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return digits.substring(1) // Remove leading 0
  }
  if (digits.length === 10) {
    return digits // Perfect 10-digit number
  }
  
  // For other lengths, take the last 10 digits
  return digits.length >= 10 ? digits.slice(-10) : digits
}

async function testFullDNCMatching() {
  console.log('🔍 TESTING ALL 65K JULY LEADS VS DNCs');
  console.log('=====================================');
  
  const listId = 'pitch-bpo-list-1750372488308';
  const startDate = '2025-07-01';
  const endDate = '2025-07-31';
  
  console.log(`📂 List ID: ${listId}`);
  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log('');
  
  // STEP 1: Get ALL July leads for this list (using pagination to bypass limits)
  console.log('🚀 STEP 1: Getting ALL July 2025 leads...');
  
  let allJulyLeads = [];
  let hasMore = true;
  let offset = 0;
  const batchSize = 50000;
  
  while (hasMore) {
    console.log(`   Fetching leads batch: ${offset} to ${offset + batchSize}...`);
    const { data: leadBatch, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, first_name, last_name, email, created_at')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .range(offset, offset + batchSize - 1)
      .order('created_at', { ascending: true });
      
    if (leadsError) {
      console.error('❌ Error getting leads batch:', leadsError);
      return;
    }
    
    if (leadBatch && leadBatch.length > 0) {
      allJulyLeads.push(...leadBatch);
      offset += batchSize;
      console.log(`   Got ${leadBatch.length} leads, total so far: ${allJulyLeads.length}`);
      
      // If we got less than batch size, we're done
      if (leadBatch.length < batchSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  
  console.log(`📊 Retrieved ${allJulyLeads?.length || 0} July leads`);
  if (!allJulyLeads || allJulyLeads.length === 0) {
    console.log('❌ No leads found! Exiting...');
    return;
  }
  
  // STEP 2: Create phone lookup from leads
  console.log('🗺️ STEP 2: Creating phone lookup from leads...');
  const leadPhoneMap = new Map();
  const phoneSet = new Set();
  
  allJulyLeads.forEach(lead => {
    if (lead.phone) {
      const normalizedPhone = normalizePhone(lead.phone);
      if (normalizedPhone.length === 10) {
        phoneSet.add(normalizedPhone);
        leadPhoneMap.set(normalizedPhone, lead);
      }
    }
  });
  
  console.log(`📱 Created lookup for ${phoneSet.size} unique normalized phone numbers`);
  console.log(`📋 Sample normalized phones: ${Array.from(phoneSet).slice(0, 5).join(', ')}`);
  console.log('');
  
  // STEP 3: Get ALL DNCs (using pagination to bypass limits)
  console.log('🚀 STEP 3: Getting ALL DNCs...');
  
  let allDncs = [];
  let dncHasMore = true;
  let dncOffset = 0;
  const dncBatchSize = 50000;
  
  while (dncHasMore) {
    console.log(`   Fetching DNCs batch: ${dncOffset} to ${dncOffset + dncBatchSize}...`);
    const { data: dncBatch, error: dncsError } = await supabase
      .from('dnc_entries')
      .select('phone_number, date_added, reason, source')
      .range(dncOffset, dncOffset + dncBatchSize - 1)
      .order('date_added', { ascending: true });
      
    if (dncsError) {
      console.error('❌ Error getting DNCs batch:', dncsError);
      return;
    }
    
    if (dncBatch && dncBatch.length > 0) {
      allDncs.push(...dncBatch);
      dncOffset += dncBatchSize;
      console.log(`   Got ${dncBatch.length} DNCs, total so far: ${allDncs.length}`);
      
      // If we got less than batch size, we're done
      if (dncBatch.length < dncBatchSize) {
        dncHasMore = false;
      }
    } else {
      dncHasMore = false;
    }
  }
  
  console.log(`📊 Retrieved ${allDncs?.length || 0} total DNCs`);
  if (!allDncs || allDncs.length === 0) {
    console.log('❌ No DNCs found! Exiting...');
    return;
  }
  
  console.log(`📋 Sample DNC phones: ${allDncs.slice(0, 5).map(d => d.phone_number).join(', ')}`);
  console.log('');
  
  // STEP 4: Match DNCs to leads  
  console.log('🎯 STEP 4: Matching DNCs to July leads...');
  const matches = [];
  let processed = 0;
  
  allDncs.forEach(dnc => {
    processed++;
    if (processed % 10000 === 0) {
      console.log(`   Processed ${processed}/${allDncs.length} DNCs...`);
    }
    
    if (dnc.phone_number) {
      const normalizedDncPhone = normalizePhone(dnc.phone_number);
      if (normalizedDncPhone.length === 10 && phoneSet.has(normalizedDncPhone)) {
        const matchedLead = leadPhoneMap.get(normalizedDncPhone);
        matches.push({
          phone_number: dnc.phone_number,
          normalized_phone: normalizedDncPhone,
          dnc_date_added: dnc.date_added,
          dnc_reason: dnc.reason,
          dnc_source: dnc.source,
          lead_id: matchedLead.id,
          lead_created_at: matchedLead.created_at,
          lead_first_name: matchedLead.first_name,
          lead_last_name: matchedLead.last_name,
          lead_email: matchedLead.email
        });
      }
    }
  });
  
  console.log('');
  console.log('📈 RESULTS:');
  console.log(`✅ Total July leads processed: ${allJulyLeads.length}`);
  console.log(`📱 Unique phone numbers from leads: ${phoneSet.size}`);
  console.log(`📋 Total DNCs processed: ${allDncs.length}`);
  console.log(`🎯 MATCHES FOUND: ${matches.length}`);
  console.log('');
  
  if (matches.length > 0) {
    console.log('📞 Sample matches:');
    matches.slice(0, 5).forEach((match, i) => {
      console.log(`  ${i+1}. Phone: ${match.phone_number} (${match.normalized_phone})`);
      console.log(`     DNC Added: ${match.dnc_date_added}`);
      console.log(`     DNC Reason: ${match.dnc_reason}`);
      console.log(`     Lead Date: ${match.lead_created_at}`);
      console.log('');
    });
    
    // Calculate percentage
    const percentage = ((matches.length / allJulyLeads.length) * 100).toFixed(2);
    console.log(`📊 DNC Rate: ${percentage}% of July leads are on DNC`);
  } else {
    console.log('❌ NO MATCHES FOUND!');
    console.log('🔍 This could mean:');
    console.log('   - Phone number formats are different');
    console.log('   - Normalization is not working correctly');
    console.log('   - No overlap between lead phones and DNC phones');
  }
  
  console.log('');
  console.log('🏁 FULL DATASET TEST COMPLETE');
}

testFullDNCMatching().catch(console.error);
