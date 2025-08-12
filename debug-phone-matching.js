// Debug script to test phone number matching
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

async function debugPhoneMatching() {
  console.log('🔍 DEBUGGING PHONE NUMBER MATCHING');
  console.log('=====================================');
  
  const listId = 'pitch-bpo-list-1750372488308';
  const startDate = '2025-07-01';
  const endDate = '2025-07-31';
  
  // Get a sample of July leads
  console.log('1. Getting sample July leads...');
  const { data: julyLeads, error: leadsError } = await supabase
    .from('leads')
    .select('phone, created_at')
    .eq('list_id', listId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59.999Z')
    .limit(10);
    
  if (leadsError) {
    console.error('❌ Error:', leadsError);
    return;
  }
  
  console.log(`📊 Got ${julyLeads?.length || 0} sample July leads`);
  if (julyLeads) {
    julyLeads.forEach((lead, i) => {
      const normalized = normalizePhone(lead.phone);
      console.log(`  ${i+1}. Original: ${lead.phone} → Normalized: ${normalized}`);
    });
  }
  console.log('');
  
  // Get a sample of DNCs
  console.log('2. Getting sample DNCs...');
  const { data: dncs, error: dncsError } = await supabase
    .from('dnc_entries')
    .select('phone_number, date_added')
    .limit(10);
    
  if (dncsError) {
    console.error('❌ Error:', dncsError);
    return;
  }
  
  console.log(`📊 Got ${dncs?.length || 0} sample DNCs`);
  if (dncs) {
    dncs.forEach((dnc, i) => {
      const normalized = normalizePhone(dnc.phone_number);
      console.log(`  ${i+1}. Original: ${dnc.phone_number} → Normalized: ${normalized}`);
    });
  }
  console.log('');
  
  // Test if any July lead phones match any DNC phones
  console.log('3. Testing manual phone matching...');
  if (julyLeads && dncs) {
    const leadPhones = new Set(julyLeads.map(lead => normalizePhone(lead.phone)));
    const dncPhones = new Set(dncs.map(dnc => normalizePhone(dnc.phone_number)));
    
    console.log(`📱 Lead phones (normalized): ${Array.from(leadPhones).slice(0, 5).join(', ')}`);
    console.log(`📱 DNC phones (normalized): ${Array.from(dncPhones).slice(0, 5).join(', ')}`);
    
    // Check for any intersections
    const matches = [];
    leadPhones.forEach(phone => {
      if (dncPhones.has(phone)) {
        matches.push(phone);
      }
    });
    
    console.log(`🎯 Manual matches found: ${matches.length}`);
    if (matches.length > 0) {
      console.log(`📞 Matching phones: ${matches.join(', ')}`);
    }
  }
  console.log('');
  
  // Test the exact phone from our API test result
  console.log('4. Testing the phone that did match in API...');
  const testPhone = '+19897212715';
  const normalizedTest = normalizePhone(testPhone);
  console.log(`🧪 Test phone: ${testPhone} → Normalized: ${normalizedTest}`);
  
  // Check if this phone exists in our July leads
  if (julyLeads) {
    const hasMatch = julyLeads.some(lead => normalizePhone(lead.phone) === normalizedTest);
    console.log(`📋 Is this phone in our July leads sample? ${hasMatch}`);
  }
  
  console.log('');
  console.log('🏁 PHONE MATCHING DEBUG COMPLETE');
}

debugPhoneMatching().catch(console.error);
