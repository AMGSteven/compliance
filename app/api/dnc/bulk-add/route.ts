import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

function normalizePhoneNumber(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    return `1${cleanPhone}`;
  }
  return cleanPhone;
}

export async function POST() {
  try {
    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'dnc-numbers.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV (assuming first column is phone numbers)
    const lines = csvContent.split('\n').filter(line => line.trim());
    const phoneNumbers = lines.slice(1).map(line => {
      const columns = line.split(',');
      return columns[0]?.trim().replace(/"/g, '');
    }).filter(phone => phone && phone.length >= 10);

    console.log(`Found ${phoneNumbers.length} phone numbers to add to DNC list`);

    const supabase = createServerClient();
    const batchSize = 100;
    let added = 0;
    let skipped = 0;

    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);
      
      const dncEntries = batch.map(phone => ({
        phone_number: normalizePhoneNumber(phone),
        reason: 'Bulk upload - customer requested DNC',
        source: 'csv_upload',
        added_by: 'bulk_api',
        metadata: { batch_upload: true },
        date_added: new Date().toISOString(),
        status: 'active'
      }));

      try {
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(phoneNumbers.length/batchSize)}...`);
        
        const { data, error } = await supabase
          .from('dnc_entries')
          .upsert(dncEntries, { 
            onConflict: 'phone_number',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error('Batch error:', error);
          skipped += batch.length;
        } else {
          added += batch.length;
          console.log(`✓ Added ${batch.length} numbers to DNC (Total: ${added})`);
        }
      } catch (batchError) {
        console.error(`Error processing batch:`, batchError);
        skipped += batch.length;
      }

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalNumbers: phoneNumbers.length,
        added,
        skipped,
        message: 'All numbers have been added to the DNC list!'
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add numbers to DNC' },
      { status: 500 }
    );
  }
}
