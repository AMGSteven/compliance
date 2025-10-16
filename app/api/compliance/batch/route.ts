import { NextRequest, NextResponse } from 'next/server';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker';
import { TCPAChecker } from '@/lib/compliance/checkers/tcpa-checker';
import { LeadContext } from '@/lib/compliance/types';

export const dynamic = 'force-dynamic';

interface ComplianceResult {
  record: any;
  isCompliant: boolean;
  failureReasons: string[];
  checks: {
    internalDNC?: boolean;
    synergyDNC?: boolean;
    tcpaLitigator?: boolean;
    stateDNC?: boolean;
  };
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const record: any = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function recordToCSV(records: any[]): string {
  if (records.length === 0) return '';
  
  const headers = Object.keys(records[0]);
  const csvLines = [headers.join(',')];
  
  records.forEach(record => {
    const values = headers.map(header => {
      const value = record[header] || '';
      // Escape commas and quotes in CSV values
      return `"${value.toString().replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(','));
  });
  
  return csvLines.join('\n');
}

async function checkRecordCompliance(record: any): Promise<ComplianceResult> {
  const result: ComplianceResult = {
    record,
    isCompliant: true,
    failureReasons: [],
    checks: {}
  };

  try {
    // Extract phone number from various possible field names
    const phone = record.phone || record.Phone || record.phone_number || record.PhoneNumber || record.primary_phone || record.PrimaryPhone || record.phone_home || '';
    
    if (!phone) {
      result.isCompliant = false;
      result.failureReasons.push('Missing phone number');
      return result;
    }

    // Extract state information from various possible field names
    const state = record.state || record.State || record.state_code || record.StateCode || record.st || record.ST || '';
    
    // Create lead context for state-specific checks
    const leadContext: LeadContext = {
      state: state.toUpperCase(), // Normalize to uppercase
      // Note: We don't have vertical info in batch processing, so we'll allow all states
      // This means State DNC will only check if the state is in the required list
    };

    // Initialize checkers
    const internalDNCChecker = new InternalDNCChecker();
    const synergyDNCChecker = new SynergyDNCChecker();
    const tcpaChecker = new TCPAChecker();

    // Check Internal DNC
    try {
      console.log(`Checking Internal DNC for: ${phone}`);
      const internalDNCResult = await internalDNCChecker.checkNumber(phone, leadContext);
      result.checks.internalDNC = internalDNCResult.isCompliant;
      
      if (!internalDNCResult.isCompliant) {
        result.isCompliant = false;
        const reasons = internalDNCResult.reasons || ['Found in Internal DNC list'];
        result.failureReasons.push(...reasons);
      }
    } catch (internalDNCError) {
      console.error('Internal DNC check error - FAILING CLOSED:', internalDNCError);
      result.checks.internalDNC = false; // FAIL CLOSED on error
      result.isCompliant = false;
      result.failureReasons.push('Internal DNC check failed - blocked for safety');
    }

    // Check Synergy DNC
    try {
      console.log(`Checking Synergy DNC for: ${phone}`);
      const synergyDNCResult = await synergyDNCChecker.checkNumber(phone, leadContext);
      result.checks.synergyDNC = synergyDNCResult.isCompliant;
      
      if (!synergyDNCResult.isCompliant) {
        result.isCompliant = false;
        const reasons = synergyDNCResult.reasons || ['Found in Synergy DNC list'];
        result.failureReasons.push(...reasons);
      }
    } catch (synergyDNCError) {
      console.error('Synergy DNC check error - FAILING CLOSED:', synergyDNCError);
      result.checks.synergyDNC = false; // FAIL CLOSED on error
      result.isCompliant = false;
      result.failureReasons.push('Synergy DNC check failed - blocked for safety');
    }

    // Check TCPA Litigator List (includes State DNC for specific states)
    try {
      console.log(`Checking TCPA Litigator List for: ${phone}${state ? ` (state: ${state})` : ''}`);
      const tcpaResult = await tcpaChecker.checkNumber(phone, leadContext);
      
      // Determine if this was a TCPA check or State DNC check based on the source
      if (tcpaResult.source?.includes('State DNC')) {
        result.checks.stateDNC = tcpaResult.isCompliant;
      } else {
        result.checks.tcpaLitigator = tcpaResult.isCompliant;
      }
      
      if (!tcpaResult.isCompliant) {
        result.isCompliant = false;
        const reasons = tcpaResult.reasons || ['Found in TCPA/State DNC list'];
        result.failureReasons.push(...reasons);
      }
    } catch (tcpaError) {
      console.error('TCPA check error - FAILING CLOSED:', tcpaError);
      result.checks.tcpaLitigator = false; // FAIL CLOSED on error
      result.isCompliant = false;
      result.failureReasons.push('TCPA check failed - blocked for safety');
    }

  } catch (error) {
    console.error('Error checking record compliance:', error);
    result.isCompliant = false;
    result.failureReasons.push('Error during compliance check');
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const records = parseCSV(csvText);
    
    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No records found in CSV' },
        { status: 400 }
      );
    }

    console.log(`Processing ${records.length} records for compliance...`);

    // Process all records for compliance
    const results = await Promise.all(
      records.map(record => checkRecordCompliance(record))
    );

    // Separate compliant and non-compliant records
    const compliantRecords = results.filter(r => r.isCompliant).map(r => r.record);
    const nonCompliantRecords = results.filter(r => !r.isCompliant);

    // Generate summary statistics
    const summary = {
      totalRecords: records.length,
      compliantRecords: compliantRecords.length,
      nonCompliantRecords: nonCompliantRecords.length,
      complianceRate: ((compliantRecords.length / records.length) * 100).toFixed(1),
      failureReasons: {} as Record<string, number>
    };

    // Count failure reasons
    nonCompliantRecords.forEach(result => {
      result.failureReasons.forEach(reason => {
        if (!summary.failureReasons[reason]) {
          summary.failureReasons[reason] = 0;
        }
        summary.failureReasons[reason]++;
      });
    });

    // Generate CSV of compliant records
    const compliantCSV = recordToCSV(compliantRecords);

    const response = {
      success: true,
      summary,
      compliantRecords,
      nonCompliantDetails: nonCompliantRecords.map(r => ({
        record: r.record,
        failureReasons: r.failureReasons,
        checks: r.checks
      })),
      compliantCSV
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing batch compliance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process CSV file' },
      { status: 500 }
    );
  }
}
