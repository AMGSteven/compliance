import { readFileSync, writeFileSync } from 'fs';

// Read dialer CSV phones
const dialerPhones = new Set();
const csvContent = readFileSync('/Users/rishiarmstrong/Downloads/predictive-dialer-new/employers_io_leads_nov21.csv', 'utf8');
const csvLines = csvContent.split('\n');
for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i].trim();
  if (line) {
    const phone = line.replace(/^\+1/, '').replace(/\+/, '').replace(/[^0-9]/g, '');
    if (phone.length === 10) {
      dialerPhones.add(phone);
    }
  }
}

// Read database leads
const dbContent = readFileSync('/Users/rishiarmstrong/.cursor/projects/Users-rishiarmstrong-Downloads-compliance-compliance/agent-tools/86629a40-9ceb-4155-9533-6c4f8e58a223.txt', 'utf8');
const dbLeads = JSON.parse(dbContent);

console.log(`📊 Dialer CSV: ${dialerPhones.size} phone numbers`);
console.log(`📊 Our Database: ${dbLeads.length} leads`);

// Find missing leads
const missingLeads = [];
for (const lead of dbLeads) {
  const normalizedPhone = lead.phone.replace(/[^0-9]/g, '');
  if (!dialerPhones.has(normalizedPhone)) {
    missingLeads.push(lead);
  }
}

console.log(`\n❌ Missing from dialer: ${missingLeads.length} leads`);
console.log(`✅ Found in dialer: ${dbLeads.length - missingLeads.length} leads`);
console.log(`📊 Match rate: ${((dbLeads.length - missingLeads.length) / dbLeads.length * 100).toFixed(1)}%`);

// Export missing leads
const csvHeader = 'id,phone,first_name,last_name,email,created_at_et,status';
const csvRows = missingLeads.map(lead => 
  `${lead.id},${lead.phone},"${lead.first_name || ''}","${lead.last_name || ''}","${lead.email || ''}","${lead.created_at_et}",${lead.status}`
);

const outputCsv = [csvHeader, ...csvRows].join('\n');
writeFileSync('missing_employers_io_leads.csv', outputCsv);

console.log(`\n✅ Exported to: missing_employers_io_leads.csv`);
console.log('\n📋 First 10 missing leads:');
missingLeads.slice(0, 10).forEach((lead, i) => {
  console.log(`   ${i + 1}. ${lead.phone} - ${lead.first_name} ${lead.last_name}`);
});
