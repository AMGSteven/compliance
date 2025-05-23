/**
 * API endpoint for phone validation using RealPhoneValidation
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { validatePhoneNumber } from '../../../lib/real-phone-validation';

export const dynamic = 'force-dynamic';

interface PhoneRequest {
  phone_number: string;
  api_key?: string;
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: PhoneRequest = await request.json();
    const { phone_number, api_key } = body;
    
    // Basic validation
    if (!phone_number) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }
    
    // API key validation (simple check for demo)
    if (api_key !== 'test_key_123' && api_key !== '2699AA84-6478-493F-BF14-299F89BA9719') {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
    
    // Call RealPhoneValidation API
    const validationResult = await validatePhoneNumber(phone_number);
    
    // Try to log the validation in the database
    try {
      const supabase = createServerClient();
      
      // Try to log the validation attempt to the validation_logs table if it exists
      try {
        await supabase
          .from('validation_logs')
          .insert({
            phone_number,
            validation_type: 'real_phone_validation',
            validation_result: validationResult.isValid,
            raw_status: validationResult.rawStatus,
            details: validationResult
          });
      } catch (dbError) {
        console.log('Could not log validation to database:', dbError);
        // Non-fatal error, continue with response
      }
    } catch (supabaseError) {
      console.error('Supabase client error:', supabaseError);
      // Non-fatal error, continue with response
    }
    
    // Return the validation result
    return NextResponse.json({
      validation_result: validationResult.isValid,
      compliance_status: validationResult.complianceStatus,
      phone_type: validationResult.isCell ? 'cell' : (validationResult.isLandline ? 'landline' : 'unknown'),
      carrier: validationResult.carrier,
      risk_level: validationResult.riskLevel,
      details: {
        raw_status: validationResult.rawStatus,
        is_explicitly_accepted: validationResult.isExplicitlyAccepted,
        reject_reason: validationResult.rejectReason,
        error: validationResult.error
      }
    });
    
  } catch (error) {
    console.error('Phone validation API error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error during phone validation' },
      { status: 500 }
    );
  }
}
