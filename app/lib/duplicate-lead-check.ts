// Utility to check if a lead has been submitted within the past 30 days
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Enterprise-grade cache for list_id to vertical mapping with TTL and error handling
interface CachedVertical {
  vertical: string;
  cachedAt: number;
  attempts: number; // Track failed lookup attempts
}

const verticalCache = new Map<string, CachedVertical>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (verticals never change)
const MAX_CACHE_SIZE = 10000; // Prevent memory leaks
const MAX_FAILED_ATTEMPTS = 3; // Stop retrying failed lookups

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  details?: {
    originalSubmissionDate?: string;
    daysAgo?: number;
    foundInTable?: 'leads' | 'contacts';
    vertical?: string;
    listId?: string;
    checkType?: 'vertical-specific' | 'global' | 'fallback';
  };
}

/**
 * Enterprise-grade cache management with memory limits and cleanup
 */
function cleanupCache(): void {
  if (verticalCache.size <= MAX_CACHE_SIZE) return;
  
  // Remove oldest entries when cache is full
  const sortedEntries = Array.from(verticalCache.entries())
    .sort(([,a], [,b]) => a.cachedAt - b.cachedAt);
  
  const toDelete = sortedEntries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2)); // Remove 20%
  toDelete.forEach(([key]) => verticalCache.delete(key));
  
  console.log(`[DEDUPE CACHE] Cleaned up ${toDelete.length} entries, cache size: ${verticalCache.size}`);
}

/**
 * Get vertical for list_id with enterprise-grade caching and error handling
 */
async function getVerticalForListId(listId: string): Promise<string | null> {
  try {
    // Check cache first
    const cached = verticalCache.get(listId);
    const now = Date.now();
    
    if (cached) {
      // Return cached value if still valid
      if ((now - cached.cachedAt) < CACHE_TTL) {
        return cached.vertical;
      }
      
      // Don't retry failed lookups too frequently
      if (cached.attempts >= MAX_FAILED_ATTEMPTS && (now - cached.cachedAt) < (CACHE_TTL / 4)) {
        console.log(`[DEDUPE CACHE] Skipping retry for failed list_id: ${listId} (${cached.attempts} attempts)`);
        return null;
      }
    }
    
    // Fetch from database
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('list_routings')
      .select('vertical')
      .eq('list_id', listId)
      .eq('active', true)
      .single();
    
    if (error || !data?.vertical) {
      // Cache the failure to avoid repeated lookups
      const attempts = (cached?.attempts || 0) + 1;
      verticalCache.set(listId, {
        vertical: '', // Empty string indicates failed lookup
        cachedAt: now,
        attempts
      });
      
      console.warn(`[DEDUPE CACHE] Failed to get vertical for list_id: ${listId}, attempt ${attempts}:`, error?.message);
      return null;
    }
    
    // Cache the successful result
    verticalCache.set(listId, {
      vertical: data.vertical,
      cachedAt: now,
      attempts: 0
    });
    
    // Periodic cache cleanup
    if (verticalCache.size > MAX_CACHE_SIZE) {
      cleanupCache();
    }
    
    console.log(`[DEDUPE CACHE] Cached vertical for list_id ${listId}: ${data.vertical}`);
    return data.vertical;
    
  } catch (error) {
    console.error(`[DEDUPE CACHE] Error getting vertical for list_id: ${listId}:`, error);
    return null;
  }
}

/**
 * ENTERPRISE-GRADE: Vertical-specific duplicate check with full error handling
 * @param phoneNumber The phone number to check
 * @param listId The list_id to determine vertical context
 * @returns Object indicating if duplicate was found and details
 */
export async function checkForDuplicateLeadInVertical(
  phoneNumber: string, 
  listId: string
): Promise<DuplicateCheckResult> {
  // Input validation
  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  
  if (!cleanedPhone || cleanedPhone.length < 10) {
    console.log(`[VERTICAL DEDUPE] Invalid phone number: ${phoneNumber}`);
    return { isDuplicate: false };
  }
  
  if (!listId) {
    console.warn(`[VERTICAL DEDUPE] No list_id provided, falling back to global check`);
    return await checkForDuplicateLead(phoneNumber);
  }
  
  try {
    // Get vertical for this list_id
    const vertical = await getVerticalForListId(listId);
    
    if (!vertical) {
      console.warn(`[VERTICAL DEDUPE] Could not determine vertical for list_id: ${listId}, falling back to global check`);
      const result = await checkForDuplicateLead(phoneNumber);
      if (result.details) {
        result.details.checkType = 'fallback';
        result.details.listId = listId;
      }
      return result;
    }
    
    // Perform vertical-specific duplicate check
    const supabase = createServerClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
    
    console.log(`[VERTICAL DEDUPE] Checking phone ${cleanedPhone} in vertical "${vertical}" after ${thirtyDaysAgoStr}`);
    
    // Query leads with the same phone number first, then filter by vertical
    const { data, error } = await supabase
      .from('leads')
      .select('created_at, list_id')
      .eq('phone', cleanedPhone)
      .gte('created_at', thirtyDaysAgoStr)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`[VERTICAL DEDUPE] Database error:`, error);
      // Fallback to global check on database error
      console.warn(`[VERTICAL DEDUPE] Falling back to global check due to database error`);
      const result = await checkForDuplicateLead(phoneNumber);
      if (result.details) {
        result.details.checkType = 'fallback';
        result.details.listId = listId;
      }
      return result;
    }
    
    if (!data || data.length === 0) {
      console.log(`[VERTICAL DEDUPE] No leads found for phone ${cleanedPhone} in last 30 days`);
      return { 
        isDuplicate: false,
        details: {
          checkType: 'vertical-specific',
          vertical,
          listId
        }
      };
    }
    
    // Filter leads by vertical - check each lead's list_id against list_routings
    let verticalDuplicate = null;
    
    for (const lead of data) {
      if (lead.list_id) {
        const leadVertical = await getVerticalForListId(lead.list_id);
        if (leadVertical === vertical) {
          verticalDuplicate = lead;
          break; // Found the most recent duplicate in this vertical
        }
      }
    }
    
    if (!verticalDuplicate) {
      console.log(`[VERTICAL DEDUPE] No duplicate found for ${cleanedPhone} in vertical "${vertical}" (checked ${data.length} leads)`);
      return { 
        isDuplicate: false,
        details: {
          checkType: 'vertical-specific',
          vertical,
          listId
        }
      };
    }
    
    // Duplicate found in the same vertical
    const duplicate = verticalDuplicate;
    const submissionDate = new Date(duplicate.created_at);
    const daysAgo = Math.floor((Date.now() - submissionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`[VERTICAL DEDUPE] Found duplicate in vertical "${vertical}": ${cleanedPhone}, submitted ${daysAgo} days ago`);
    
    return {
      isDuplicate: true,
      details: {
        originalSubmissionDate: submissionDate.toISOString(),
        daysAgo,
        foundInTable: 'leads',
        vertical,
        listId: duplicate.list_id,
        checkType: 'vertical-specific'
      }
    };
    
  } catch (error) {
    console.error(`[VERTICAL DEDUPE] Unexpected error:`, error);
    // Ultimate fallback to global check
    console.warn(`[VERTICAL DEDUPE] Falling back to global check due to unexpected error`);
    const result = await checkForDuplicateLead(phoneNumber);
    if (result.details) {
      result.details.checkType = 'fallback';
      result.details.listId = listId;
    }
    return result;
  }
}

/**
 * LEGACY: Check if a phone number exists in the leads database within the past 30 days
 * @param phoneNumber The phone number to check
 * @returns Object indicating if duplicate was found and details
 * @deprecated Use checkForDuplicateLeadInVertical when listId is available
 */
export async function checkForDuplicateLead(phoneNumber: string): Promise<DuplicateCheckResult> {
  // Clean the phone number to ensure consistent format
  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  
  if (!cleanedPhone || cleanedPhone.length < 10) {
    // Invalid phone number, can't check for duplicates
    console.log(`[DUPLICATE CHECK] Invalid phone number: ${phoneNumber}`);
    return { isDuplicate: false };
  }

  try {
    // Create Supabase client using the server function
    const supabase = createServerClient();

    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    console.log(`[DUPLICATE CHECK] Checking for phone ${cleanedPhone} after ${thirtyDaysAgoStr}`);

    // First try 'leads' table
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('created_at')
      .eq('phone', cleanedPhone)
      .gte('created_at', thirtyDaysAgoStr)
      .order('created_at', { ascending: false })
      .limit(1);

    // If no results or error, try 'contacts' table as fallback
    if ((leadsError || !leadsData || leadsData.length === 0)) {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('created_at')
        .eq('phone', cleanedPhone)
        .gte('created_at', thirtyDaysAgoStr)
        .order('created_at', { ascending: false })
        .limit(1);

      if (contactsError || !contactsData || contactsData.length === 0) {
        // No duplicate found in either table
        console.log(`[DUPLICATE CHECK] No duplicate found for ${cleanedPhone}`);
        return { isDuplicate: false };
      }

      // Duplicate found in contacts table
      if (contactsData.length > 0) {
        const submissionDate = new Date(contactsData[0].created_at);
        const daysAgo = Math.floor((Date.now() - submissionDate.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`[DUPLICATE CHECK] Found duplicate in contacts table: ${cleanedPhone}, submitted ${daysAgo} days ago`);
        
        return {
          isDuplicate: true,
          details: {
            originalSubmissionDate: submissionDate.toISOString(),
            daysAgo,
            foundInTable: 'contacts',
            checkType: 'global'
          }
        };
      }
    }

    // Duplicate found in leads table
    if (leadsData && leadsData.length > 0) {
      const submissionDate = new Date(leadsData[0].created_at);
      const daysAgo = Math.floor((Date.now() - submissionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`[DUPLICATE CHECK] Found duplicate in leads table: ${cleanedPhone}, submitted ${daysAgo} days ago`);
      
      return {
        isDuplicate: true,
        details: {
          originalSubmissionDate: submissionDate.toISOString(),
          daysAgo,
          foundInTable: 'leads',
          checkType: 'global'
        }
      };
    }

    // No duplicate found
    return { 
      isDuplicate: false,
      details: {
        checkType: 'global'
      }
    };
  } catch (error) {
    // Log error but don't block lead submission on check failure
    console.error(`[DUPLICATE CHECK] Error checking for duplicate lead:`, error);
    return { isDuplicate: false };
  }
}

/**
 * ENTERPRISE MONITORING: Get cache statistics for production monitoring
 * @returns Cache performance metrics
 */
export function getDedupeCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let failedEntries = 0;
  
  for (const [listId, cached] of verticalCache.entries()) {
    const age = now - cached.cachedAt;
    
    if (age > CACHE_TTL) {
      expiredEntries++;
    } else if (cached.vertical === '') {
      failedEntries++;
    } else {
      validEntries++;
    }
  }
  
  return {
    totalEntries: verticalCache.size,
    validEntries,
    expiredEntries,
    failedEntries,
    cacheHitRatio: validEntries / Math.max(1, verticalCache.size),
    memoryUsage: `${Math.round(verticalCache.size * 100 / MAX_CACHE_SIZE)}%`,
    oldestEntry: verticalCache.size > 0 ? 
      Math.min(...Array.from(verticalCache.values()).map(v => v.cachedAt)) : null
  };
}
