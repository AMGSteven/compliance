import { NextResponse } from 'next/server';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';

export async function POST(request: Request) {
  try {
    console.log('CSV Upload request received');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const reason = formData.get('reason') as string || 'CSV Upload';
    const campaign = formData.get('campaign') as string || 'csv_import';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Please upload a CSV file' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Detect if first line is a header or data
    const firstLine = lines[0].split(',').map(h => h.trim());
    const firstCell = firstLine[0].replace(/\D/g, ''); // Remove non-digits
    const hasHeader = firstCell.length < 10; // If first cell isn't a phone number, assume it's a header
    
    console.log('First line:', firstLine);
    console.log('First cell digits only:', firstCell);
    console.log('Has header:', hasHeader);

    let headers: string[] = [];
    let phoneColumnIndex = 0;
    let reasonColumnIndex = -1;
    let campaignColumnIndex = -1;
    let agentColumnIndex = -1;
    let dataStartIndex = 0;

    if (hasHeader) {
      // Parse CSV headers
      headers = firstLine.map(h => h.toLowerCase());
      console.log('CSV Headers:', headers);

      // Find phone number column
      phoneColumnIndex = headers.findIndex(h => 
        h.includes('phone') || h.includes('number') || h === 'phone_number'
      );

      if (phoneColumnIndex === -1) {
        return NextResponse.json({
          success: false,
          error: 'No phone number column found. Please ensure your CSV has a column named "phone_number", "phone", or containing "phone"'
        }, { status: 400 });
      }

      console.log(`Phone column found at index ${phoneColumnIndex}: ${headers[phoneColumnIndex]}`);

      // Find optional columns
      reasonColumnIndex = headers.findIndex(h => h.includes('reason'));
      campaignColumnIndex = headers.findIndex(h => h.includes('campaign') || h.includes('source'));
      agentColumnIndex = headers.findIndex(h => h.includes('agent'));
      
      dataStartIndex = 1; // Skip header row
    } else {
      // No header, assume first column is phone numbers
      console.log('No header detected, assuming first column contains phone numbers');
      phoneColumnIndex = 0;
      dataStartIndex = 0; // Start from first row
    }

    // Process data rows
    const dataRows = lines.slice(dataStartIndex);
    const entries = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNumber = i + dataStartIndex + 1; // Adjust row number based on whether we have header
      const row = dataRows[i].split(',').map(cell => cell.trim());

      // For headerless files, we only expect phone numbers, so don't check column count
      if (hasHeader && row.length < headers.length) {
        errors.push(`Row ${rowNumber}: Not enough columns (expected ${headers.length}, got ${row.length})`);
        continue;
      }

      const phoneNumber = row[phoneColumnIndex]?.replace(/['"]/g, ''); // Remove quotes
      
      if (!phoneNumber) {
        errors.push(`Row ${rowNumber}: Missing phone number`);
        continue;
      }

      // Validate phone number format (basic validation)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push(`Row ${rowNumber}: Invalid phone number format: ${phoneNumber}`);
        continue;
      }

      // Build entry object
      const entry = {
        phoneNumber: phoneNumber,
        reason: (reasonColumnIndex >= 0 && row[reasonColumnIndex]) ? 
          row[reasonColumnIndex].replace(/['"]/g, '') : reason,
        source: 'csv_upload',
        addedBy: 'csv_import',
        metadata: {
          campaign: (campaignColumnIndex >= 0 && row[campaignColumnIndex]) ? 
            row[campaignColumnIndex].replace(/['"]/g, '') : campaign,
          importTimestamp: new Date().toISOString(),
          csvRow: rowNumber,
          ...(agentColumnIndex >= 0 && row[agentColumnIndex] ? {
            agentId: row[agentColumnIndex].replace(/['"]/g, '')
          } : {})
        }
      };

      entries.push(entry);
    }

    console.log(`Processed ${entries.length} valid entries, ${errors.length} errors`);

    if (entries.length === 0) {
      return NextResponse.json({
        success: false,
        processed: dataRows.length,
        added: 0,
        errors: errors.length > 0 ? errors : ['No valid entries found to process'],
        duplicates: 0
      });
    }

    // Add to DNC using bulk method
    const checker = new InternalDNCChecker();
    const result = await checker.bulkAddToDNC(entries);

    console.log('Bulk DNC result:', result);

    return NextResponse.json({
      success: true,
      processed: dataRows.length,
      added: result.successful,
      duplicates: 0, // Note: bulkAddToDNC doesn't track duplicates separately
      errors: [...errors, ...result.errors.map(e => `${e.phone_number}: ${e.error}`)],
      details: {
        csvFile: file.name,
        fileSize: file.size,
        totalRows: dataRows.length,
        validEntries: entries.length,
        phoneColumn: headers[phoneColumnIndex],
        hasReasonColumn: reasonColumnIndex >= 0,
        hasCampaignColumn: campaignColumnIndex >= 0,
        hasAgentColumn: agentColumnIndex >= 0,
        defaultReason: reason,
        defaultCampaign: campaign
      }
    });

  } catch (error: any) {
    console.error('CSV Upload error:', error);
    return NextResponse.json({
      success: false,
      processed: 0,
      added: 0,
      errors: [`Server error: ${error.message}`],
      duplicates: 0
    }, { status: 500 });
  }
}
