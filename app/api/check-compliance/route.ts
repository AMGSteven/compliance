import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { TCPAChecker } from '@/lib/compliance/checkers/tcpa-checker';
import { BlacklistChecker } from '@/lib/compliance/checkers/blacklist-checker';
import { WebreconChecker } from '@/lib/compliance/checkers/webrecon-checker';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker';
import { ComplianceChecker, ComplianceResult } from '@/lib/compliance/types';
import { checkPhoneCompliance } from '@/app/lib/real-phone-validation';

// Define allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://compliance.juicedmedia.io',
  'https://compliance.americanhm.com',
];

export async function POST(request: Request) {
  console.log('Starting compliance check...');
  try {
    // Get the origin from the request headers
    const headersList = await headers();
    const origin = headersList.get('origin') || '';

    // Check if the origin is allowed
    const isAllowedOrigin = allowedOrigins.includes(origin);
    
    // Get the request body
    const body = await request.json();
    console.log('Request body:', body);
    const { phoneNumber } = body;
    
    if (!phoneNumber) {
      return new NextResponse(
        JSON.stringify({ error: 'Phone number is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
          },
        }
      );
    }

    // Initialize all five compliance checkers individually to ensure better error handling
    const checkers: ComplianceChecker[] = [
      new TCPAChecker(),
      new BlacklistChecker(),
      new WebreconChecker(),
      new InternalDNCChecker(),
      new SynergyDNCChecker(),
    ];
    
    // Additionally check phone validation
    const phoneValidationResult = await checkPhoneCompliance(phoneNumber);
    console.log('Phone validation result:', phoneValidationResult);
    
    console.log('Checking phone number:', phoneNumber);
    
    // Run all checks in parallel with improved error handling
    const results = await Promise.allSettled(
      checkers.map(async checker => {
        try {
          console.log(`Running checker: ${checker.name}`);
          const result = await checker.checkNumber(phoneNumber);
          console.log(`Checker ${checker.name} result:`, result);
          return result;
        } catch (error) {
          console.error(`Error in checker ${checker.name}:`, error);
          // Return a structured error result instead of throwing
          return {
            isCompliant: false, // Assume non-compliant on error (fail closed for safety)
            reasons: [`Error checking ${checker.name}: ${error instanceof Error ? error.message : 'Unknown error'}`],
            source: checker.name,
            phoneNumber,
            details: {},
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Convert Promise.allSettled results to a usable format
    const checkResults = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle rejected promises (shouldn't happen with our try/catch above)
        return {
          isCompliant: false,
          reasons: [`Failed to check: ${result.reason}`],
          source: 'Unknown',
          phoneNumber,
          details: {},
          error: result.reason
        };
      }
    });

    // A number is compliant only if all checks pass, including phone validation
    const isCompliant = checkResults.every(result => result.isCompliant) && phoneValidationResult.isCompliant;
    
    // Get list of failed sources for easier analysis
    const failedSources = checkResults
      .filter(result => !result.isCompliant)
      .map(result => ({
        source: result.source,
        reasons: result.reasons,
      }));
      
    // Add phone validation results if failed
    if (!phoneValidationResult.isCompliant) {
      failedSources.push({
        source: 'Phone Validation',
        reasons: [phoneValidationResult.reason || 'Failed phone validation'],
      });
    }
    
    const report = {
      phoneNumber,
      isCompliant,
      failedSources,
      results: checkResults,
      phoneValidation: {
        isValid: phoneValidationResult.isCompliant,
        details: phoneValidationResult.details,
        reason: phoneValidationResult.reason
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log('Check complete, report summary:', {
      isCompliant,
      failedSources: failedSources.map(s => s.source),
    });

    // Return the response with CORS headers if origin is allowed
    return new NextResponse(JSON.stringify(report), {
      headers: {
        'Content-Type': 'application/json',
        ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      },
    });
  } catch (error) {
    console.error('Error checking compliance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check compliance';
    return new NextResponse(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...(origin && allowedOrigins.includes(origin) && {
            'Access-Control-Allow-Origin': origin,
          }),
        },
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  const headersList = await headers();
  const origin = headersList.get('origin') || '';

  // Check if the origin is allowed
  if (allowedOrigins.includes(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    });
  }

  return new NextResponse(null, { status: 204 });
}
