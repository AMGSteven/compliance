import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { ComplianceEngine } from '@/lib/compliance/engine';
import { checkForDuplicateLead, checkForDuplicateLeadInVertical } from '@/app/lib/duplicate-lead-check';
import { logRejection } from '@/app/lib/rejection-logger';

// Allowed states for leads (ACA vertical configuration)
const INTERNAL_DIALER_ALLOWED_STATES = ['AL', 'AR', 'AZ', 'FL', 'IA', 'IN', 'KS', 'LA', 'MO', 'MS', 'NE', 'NH', 'OH', 'OK', 'TN', 'UT', 'WI'];
const PITCH_BPO_ALLOWED_STATES = ['AL', 'AR', 'AZ', 'FL', 'IA', 'IN', 'KS', 'LA', 'MO', 'MS', 'NE', 'NH', 'OH', 'OK', 'TN', 'TX', 'UT', 'WI'];

interface PrePingRequest {
  phone: string;
  state?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  list_id?: string;
  dialer_type?: 'internal' | 'pitch_bpo';
}

interface ComplianceCheckResult {
  isCompliant: boolean;
  reason?: string;
  details?: any;
}

interface PrePingResponse {
  success: boolean;
  accepted: boolean;
  rejection_reasons: string[];
  estimated_bid?: number;
  checks: {
    duplicate: ComplianceCheckResult;
    state: ComplianceCheckResult;
    compliance: ComplianceCheckResult;
  };
  processing_time_ms: number;
}

// Utility function to normalize phone number
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// State validation
async function checkStateCompliance(state: string | undefined, dialerType: 'internal' | 'pitch_bpo' = 'internal'): Promise<ComplianceCheckResult> {
  if (!state) {
    return { isCompliant: false, reason: 'State is required' };
  }

  const allowedStates = dialerType === 'pitch_bpo' ? PITCH_BPO_ALLOWED_STATES : INTERNAL_DIALER_ALLOWED_STATES;
  
  if (!allowedStates.includes(state.toUpperCase())) {
    return { 
      isCompliant: false, 
      reason: `State ${state} not allowed for ${dialerType} dialer`,
      details: { allowedStates, dialerType }
    };
  }

  return { isCompliant: true };
}

// Shared validation logic for both GET and POST methods
async function performPrePingValidation(body: PrePingRequest, startTime: number): Promise<NextResponse> {
  try {
    // Validate required fields
    if (!body.phone) {
      return NextResponse.json({
        success: false,
        accepted: false,
        error: 'Phone number is required',
        rejection_reasons: ['Missing phone number']
      }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(body.phone);
    
    // Extract list_id for vertical-specific duplicate checking
    const list_id = body.list_id;
    
    console.log(`[Pre-Ping] Starting validation for phone: ${normalizedPhone}, state: ${body.state}`);

    // Initialize results
    const rejectionReasons: string[] = [];
    const checks: PrePingResponse['checks'] = {
      duplicate: { isCompliant: true },
      state: { isCompliant: true },
      compliance: { isCompliant: true }
    };

    // 1. State validation
    const stateCheck = await checkStateCompliance(body.state, body.dialer_type);
    checks.state = stateCheck;
    if (!stateCheck.isCompliant) {
      rejectionReasons.push(stateCheck.reason || 'State validation failed');
      console.log(`[Pre-Ping] State check failed: ${stateCheck.reason}`);
    }

    // 2. Duplicate check (30-day window) - Vertical-specific if list_id provided
    try {
      let duplicateResult;
      
      if (list_id) {
        // Use vertical-specific duplicate check
        duplicateResult = await checkForDuplicateLeadInVertical(normalizedPhone, list_id);
        console.log(`[Pre-Ping] Using vertical-specific duplicate check for list_id: ${list_id}`);
      } else {
        // Fallback to global duplicate check
        duplicateResult = await checkForDuplicateLead(normalizedPhone);
        console.log('[Pre-Ping] Using global duplicate check (no list_id provided)');
      }
      
      checks.duplicate = {
        isCompliant: !duplicateResult.isDuplicate,
        reason: duplicateResult.isDuplicate ? 'Duplicate lead found within 30 days' : undefined,
        details: duplicateResult.isDuplicate ? duplicateResult.details : undefined
      };
      
      if (duplicateResult.isDuplicate) {
        const daysAgo = duplicateResult.details?.daysAgo || 0;
        const vertical = duplicateResult.details?.vertical || 'unknown';
        const checkType = duplicateResult.details?.checkType || 'unknown';
        rejectionReasons.push(`Duplicate lead (last seen ${daysAgo} days ago, vertical: ${vertical}, check: ${checkType})`);
        console.log(`[Pre-Ping] Duplicate check failed: ${daysAgo} days since last lead in vertical: ${vertical} (${checkType})`);
        
        // Log rejection for ping analysis (non-blocking)
        logRejection({
          phone: normalizedPhone,
          incomingListId: list_id || 'unknown',
          matchedLeadId: duplicateResult.details?.matchedLeadId,
          matchedListId: duplicateResult.details?.listId,
          rejectionReason: 'duplicate',
          rejectionType: checkType,
          incomingVertical: vertical,
          matchedVertical: vertical,
          daysSinceOriginal: daysAgo,
          endpoint: '/api/leads/pre-ping',
          rejectionDetails: duplicateResult.details,
          requestPayload: body
        }).catch((err: Error) => console.error('[REJECTION LOG] Logging failed:', err));
      }
    } catch (error) {
      console.error('[Pre-Ping] Duplicate check failed:', error);
      checks.duplicate = { isCompliant: false, reason: 'Duplicate check error' };
      rejectionReasons.push('Unable to verify duplicate status');
    }

    // 3. Run comprehensive compliance checks using ComplianceEngine
    try {
      const complianceEngine = new ComplianceEngine();
      const complianceReport = await complianceEngine.checkPhoneNumber(normalizedPhone);
      
      checks.compliance = {
        isCompliant: complianceReport.isCompliant,
        reason: !complianceReport.isCompliant ? 'Failed compliance checks' : undefined,
        details: complianceReport.results
      };
      
      if (!complianceReport.isCompliant) {
        // Extract specific failure reasons
        const failureReasons = complianceReport.results
          ?.filter(result => !result.isCompliant)
          .map(result => `${result.source}: ${result.reasons?.join(', ') || 'Non-compliant'}`)
          .join('; ');
        
        rejectionReasons.push(failureReasons || 'Compliance validation failed');
        console.log(`[Pre-Ping] Compliance checks failed: ${failureReasons}`);
      }
      
      console.log(`[Pre-Ping] Compliance checks completed. Overall compliant: ${complianceReport.isCompliant}`);
      
    } catch (error) {
      console.error('[Pre-Ping] Compliance engine error:', error);
      // Fail closed - if compliance check fails, reject the lead
      checks.compliance = { isCompliant: false, reason: 'Compliance check error' };
      rejectionReasons.push('Compliance validation failed');
    }

    // Determine acceptance
    const accepted = rejectionReasons.length === 0;
    const processingTime = Date.now() - startTime;

    // Estimate bid based on list_id or default
    let estimatedBid = 0.50; // Default bid
    if (body.list_id && accepted) {
      // Could look up actual bid from routing data if needed
      estimatedBid = 0.50;
    }

    const response: PrePingResponse = {
      success: true,
      accepted,
      rejection_reasons: rejectionReasons,
      estimated_bid: accepted ? estimatedBid : 0.00,
      checks,
      processing_time_ms: processingTime
    };

    console.log(`[Pre-Ping] Completed in ${processingTime}ms - ${accepted ? 'ACCEPTED' : 'REJECTED'} - Reasons: ${rejectionReasons.join(', ')}`);

    return NextResponse.json(response, { 
      status: 200,
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'X-Pre-Ping-Result': accepted ? 'accepted' : 'rejected'
      }
    });

  } catch (error) {
    console.error('[Pre-Ping] Validation error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      accepted: false,
      error: 'Pre-ping validation failed',
      rejection_reasons: ['System error during validation'],
      processing_time_ms: processingTime
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body: PrePingRequest = await request.json();
    
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '') || null;
    
    // Validate API key
    const isValidApiKey = await validateApiKey(apiKey);
    if (!isValidApiKey) {
      return NextResponse.json({
        success: false,
        accepted: false,
        error: 'Invalid or missing API key',
        rejection_reasons: ['Authentication failed']
      }, { status: 401 });
    }

    // Use shared validation logic
    return await performPrePingValidation(body, startTime);

  } catch (error) {
    console.error('[Pre-Ping POST] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      accepted: false,
      error: 'Pre-ping validation failed',
      rejection_reasons: ['System error during validation'],
      processing_time_ms: processingTime
    }, { status: 500 });
  }
}

// GET method - supports pre-ping validation via query parameters
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get query parameters from the URL
    const { searchParams } = new URL(request.url);
    
    // Extract parameters
    const phone = searchParams.get('phone');
    const state = searchParams.get('state');
    const email = searchParams.get('email');
    const firstName = searchParams.get('firstName');
    const lastName = searchParams.get('lastName');
    const list_id = searchParams.get('list_id');
    const dialer_type = searchParams.get('dialer_type') as 'internal' | 'pitch_bpo' | null;
    
    // If no phone parameter, return health check
    if (!phone) {
      return NextResponse.json({
        endpoint: 'pre-ping',
        status: 'active',
        description: 'Lead pre-validation endpoint - supports both GET (query params) and POST (JSON body)',
        timestamp: new Date().toISOString(),
        usage: {
          GET: 'Use query parameters: ?phone=1234567890&state=TX&dialer_type=pitch_bpo',
          POST: 'Send JSON body with phone, state, and other optional fields'
        }
      });
    }
    
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '') || null;
    
    // Validate API key
    const isValidApiKey = await validateApiKey(apiKey);
    if (!isValidApiKey) {
      return NextResponse.json({
        success: false,
        accepted: false,
        error: 'Invalid or missing API key',
        rejection_reasons: ['Authentication failed']
      }, { status: 401 });
    }

    // Create request body object from query parameters
    const body: PrePingRequest = {
      phone,
      state: state || undefined,
      email: email || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      list_id: list_id || undefined,
      dialer_type: dialer_type || 'internal'
    };
    
    // Use the same validation logic as POST
    return await performPrePingValidation(body, startTime);
    
  } catch (error) {
    console.error('[Pre-Ping GET] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      accepted: false,
      error: 'Pre-ping validation failed',
      rejection_reasons: ['System error during validation'],
      processing_time_ms: processingTime
    }, { status: 500 });
  }
}
