#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const supabase = createClient(
  'https://xaglksnmuirvtrtdjkdu.supabase.co',
  process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZ2xrc25tdWlydnRydGRqa2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY0NzY1MSwiZXhwIjoyMDYyMjIzNjUxfQ.IDKH6YUhne6Cxd-a0ObWDmFsCtktjgnlZ44GeR4Y-6VE'
);

async function main() {
  console.log('🔍 Finding leads in our DB that are NOT in the dialer CSV...\n');

  // Read the CSV file and extract phone numbers
  const csvContent = readFileSync('/Users/rishiarmstrong/Downloads/predictive-dialer-new/employers_io_leads_nov21.csv', 'utf8');
  const csvLines = csvContent.split('\n');
  const csvPhones = new Set();
  
  // Skip header and extract phone numbers (normalize: remove +1, +, and non-digits)
  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i].trim();
    if (line) {
      // Remove +1 prefix and normalize to 10 digits
      let phone = line.replace(/^\+1/, '').replace(/\+/g, '').replace(/[^0-9]/g, '');
      if (phone.length === 10) {
        csvPhones.add(phone);
      } else if (phone.length === 11 && phone.startsWith('1')) {
        // Handle 11-digit numbers starting with 1
        csvPhones.add(phone.substring(1));
      }
    }
  }
  
  console.log(`📊 CSV contains ${csvPhones.size} unique phone numbers`);

  // Get all leads from Employers.io Internal On Hour sent to internal dialer since 12am ET Nov 21, 2025
  // 12am ET Nov 21 = 5am UTC Nov 21
  // List ID: f2a566d2-0e97-4a7d-bc95-389dade78caf
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id, phone, first_name, last_name, email, address, city, state, zip_code, created_at,
      list_routings!inner(description)
    `)
    .eq('list_routings.description', 'Employers.io Internal On Hour')
    .eq('assigned_dialer_type', 1)
    .gte('created_at', '2025-11-21T05:00:00Z')
    .lt('created_at', '2025-11-22T05:00:00Z')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching leads:', error);
    return;
  }

  console.log(`📊 Our database contains ${leads?.length || 0} leads from Employers.io Internal On Hour sent to internal dialer`);

  if (!leads || leads.length === 0) {
    console.log('⚠️  No leads found in database');
    return;
  }

  // Find leads that are in our DB but NOT in the CSV
  const missingLeads = [];
  
  for (const lead of leads) {
    // Normalize phone number: remove +1, +, and non-digits, keep last 10 digits
    let normalizedPhone = lead.phone.replace(/[^0-9]/g, '');
    if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    if (normalizedPhone.length === 10) {
      if (!csvPhones.has(normalizedPhone)) {
        missingLeads.push({
          ...lead,
          normalizedPhone
        });
      }
    }
  }

  console.log(`\n❌ Found ${missingLeads.length} leads in our DB that are NOT in the dialer CSV`);
  console.log(`✅ Found ${leads.length - missingLeads.length} leads that match`);
  console.log(`📊 Match rate: ${((leads.length - missingLeads.length) / leads.length * 100).toFixed(1)}%`);

  // Export the missing leads to CSV
  const csvHeader = 'id,phone,first_name,last_name,email,address,city,state,zip_code,created_at_et';
  const csvRows = missingLeads.map(lead => {
    const createdAt = new Date(lead.created_at).toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const escapeCsv = (str) => {
      if (!str) return '';
      return `"${String(str).replace(/"/g, '""')}"`;
    };
    return [
      lead.id,
      lead.phone,
      escapeCsv(lead.first_name),
      escapeCsv(lead.last_name),
      escapeCsv(lead.email),
      escapeCsv(lead.address),
      escapeCsv(lead.city),
      escapeCsv(lead.state),
      escapeCsv(lead.zip_code),
      createdAt
    ].join(',');
  });
  
  const outputCsv = [csvHeader, ...csvRows].join('\n');
  const outputPath = '/Users/rishiarmstrong/Downloads/compliance/compliance/missing_employers_io_leads.csv';
  
  writeFileSync(outputPath, outputCsv);
  
  console.log(`\n✅ Exported ${missingLeads.length} missing leads to:`);
  console.log(`   ${outputPath}`);
  
  if (missingLeads.length > 0) {
    console.log('\n📋 Sample of missing leads:');
    missingLeads.slice(0, 10).forEach((lead, i) => {
      console.log(`   ${i + 1}. ${lead.first_name || ''} ${lead.last_name || ''} (${lead.phone})`);
    });
  }
}

main().catch(console.error);
