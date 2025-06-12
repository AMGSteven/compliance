import { NextResponse } from 'next/server';
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker';

// Force dynamic to avoid caching
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get the phone number from the URL query parameter
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required as a query parameter' }, 
        { status: 400 }
      );
    }
    
    console.log(`Testing Synergy DNC checker with phone: ${phone}`);
    
    // Create and test the Synergy DNC checker directly
    const checker = new SynergyDNCChecker();
    const result = await checker.checkNumber(phone);
    
    console.log('Synergy DNC check result:', result);
    
    return NextResponse.json({
      phone,
      testResult: result,
      summary: {
        isOnDNC: !result.isCompliant,
        message: result.isCompliant 
          ? 'Phone number is NOT on Synergy DNC list (compliant)' 
          : 'Phone number IS on Synergy DNC list (non-compliant)'
      }
    });
  } catch (error) {
    console.error('Error testing Synergy DNC checker:', error);
    return NextResponse.json(
      { error: 'Error testing Synergy DNC checker: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
