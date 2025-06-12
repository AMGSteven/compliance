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
    
    console.log(`Debug Synergy DNC API with phone: ${phone}`);
    
    // Make a direct call to the Synergy DNC API
    const apiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller_id: phone
      }),
    });
    
    // Get the raw API response
    const apiResponse = await response.json();
    console.log('Synergy DNC API raw response:', apiResponse);
    
    // Also test with our checker implementation
    const checker = new SynergyDNCChecker();
    const checkerResult = await checker.checkNumber(phone);
    
    return NextResponse.json({
      phone,
      rawApiResponse: apiResponse,
      checkerResult: checkerResult,
      interpretation: {
        isOnDNC: apiResponse?.on_dnc === true,
        isCompliant: checkerResult.isCompliant,
        explanation: checkerResult.isCompliant 
          ? 'Number is NOT on Synergy DNC list' 
          : 'Number IS on Synergy DNC list'
      }
    });
  } catch (error) {
    console.error('Error testing Synergy DNC API:', error);
    return NextResponse.json(
      { error: 'Error testing Synergy DNC API: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
