#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

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

// Read the database results file and extract JSON array
const dbFileContent = readFileSync('/Users/rishiarmstrong/.cursor/projects/Users-rishiarmstrong-Downloads-compliance-compliance/agent-tools/58a37684-5c7d-4fde-8c3d-8ebc9af97155.txt', 'utf8');

// Extract JSON array from the file (it's wrapped in metadata with escaped quotes)
// The file contains escaped JSON, so we need to unescape it first
let jsonStr = dbFileContent;
// Find the JSON array part (starts with [ and ends with ])
const startIdx = jsonStr.indexOf('[');
const endIdx = jsonStr.lastIndexOf(']');
if (startIdx === -1 || endIdx === -1) {
  console.error('❌ Could not find JSON array in database file');
  process.exit(1);
}

jsonStr = jsonStr.substring(startIdx, endIdx + 1);
// Unescape the JSON string
jsonStr = jsonStr.replace(/\\n/g, '').replace(/\\"/g, '"');
const dbLeads = JSON.parse(jsonStr);

console.log(`📊 Database contains ${dbLeads.length} leads`);

// Find leads that are in our DB but NOT in the CSV
const missingLeads = [];

for (const lead of dbLeads) {
  // Normalize phone number: remove +1, +, and non-digits, keep last 10 digits
  let normalizedPhone = (lead.phone || '').replace(/[^0-9]/g, '');
  if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
    normalizedPhone = normalizedPhone.substring(1);
  }
  if (normalizedPhone.length === 10) {
    if (!csvPhones.has(normalizedPhone)) {
      missingLeads.push(lead);
    }
  } else {
    // Log phone numbers that don't normalize properly
    console.warn(`⚠️  Skipping lead with invalid phone: ${lead.phone} (normalized: ${normalizedPhone})`);
  }
}

console.log(`\n❌ Found ${missingLeads.length} leads in our DB that are NOT in the dialer CSV`);
console.log(`✅ Found ${dbLeads.length - missingLeads.length} leads that match`);
console.log(`📊 Match rate: ${((dbLeads.length - missingLeads.length) / dbLeads.length * 100).toFixed(1)}%`);

// Export the missing leads to CSV
const escapeCsv = (str) => {
  if (!str) return '';
  return `"${String(str).replace(/"/g, '""')}"`;
};

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
  return [
    lead.id,
    lead.phone || '',
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

