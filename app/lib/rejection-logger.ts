/**
 * Rejection Logger
 * 
 * Logs rejected lead submissions to the lead_rejections table for ping analysis.
 * Non-blocking implementation to avoid adding latency to lead submission flow.
 */

import { createServerClient } from '@/lib/supabase/server';

export interface RejectionLogData {
  // Core fields
  phone: string;
  incomingListId: string;
  matchedLeadId?: string;
  matchedListId?: string;
  
  // Classification
  rejectionReason: 'duplicate' | 'compliance' | 'dnc' | 'state' | 'phone_validation' | 'other';
  rejectionType: string;
  
  // Context
  incomingVertical?: string;
  matchedVertical?: string;
  daysSinceOriginal?: number;
  
  // Audit
  endpoint: string;
  rejectionDetails?: any;
  requestPayload?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a rejected lead submission
 * 
 * This function is intentionally non-blocking (fire-and-forget) to avoid
 * adding latency to the lead submission API response time.
 * 
 * @param data - Rejection data to log
 * @returns Promise<void> - Does not throw errors, logs failures instead
 */
export async function logRejection(data: RejectionLogData): Promise<void> {
  try {
    const supabase = createServerClient();
    
    // Sanitize PII from request payload before storing
    // Keep only metadata useful for analysis
    const sanitizedMetadata = data.requestPayload ? {
      list_id: data.requestPayload.list_id || data.requestPayload.listId,
      state: data.requestPayload.state,
      dialer_type: data.requestPayload.dialer_type,
      has_email: !!data.requestPayload.email,
      has_trustedform: !!data.requestPayload.trusted_form_cert_url || !!data.requestPayload.trustedFormCertUrl,
      // Store structure without PII
      field_count: Object.keys(data.requestPayload).length,
      timestamp: new Date().toISOString()
    } : null;
    
    // Insert rejection record
    const { error } = await supabase
      .from('lead_rejections')
      .insert({
        phone: data.phone,
        incoming_list_id: data.incomingListId,
        matched_lead_id: data.matchedLeadId || null,
        matched_list_id: data.matchedListId || null,
        rejection_reason: data.rejectionReason,
        rejection_type: data.rejectionType,
        incoming_vertical: data.incomingVertical || null,
        matched_vertical: data.matchedVertical || null,
        days_since_original: data.daysSinceOriginal || null,
        endpoint: data.endpoint,
        rejection_details: data.rejectionDetails || null,
        request_metadata: sanitizedMetadata,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('[REJECTION LOG] Failed to log rejection:', error);
      return;
    }
    
    console.log(`[REJECTION LOG] ✅ Logged ${data.rejectionReason} rejection for phone ${data.phone} from list ${data.incomingListId}`);
  } catch (error) {
    // Non-blocking: Never throw errors that could break the main request flow
    console.error('[REJECTION LOG] Unexpected error logging rejection:', error);
  }
}

/**
 * Helper function to extract vertical from list routing cache or database
 * Used when logging rejections to enrich data with vertical context
 */
export async function getVerticalForRejectionLog(listId: string): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('list_routings')
      .select('vertical')
      .eq('list_id', listId)
      .eq('active', true)
      .single();
    
    if (error || !data?.vertical) {
      return null;
    }
    
    return data.vertical;
  } catch (error) {
    console.error('[REJECTION LOG] Error fetching vertical:', error);
    return null;
  }
}

