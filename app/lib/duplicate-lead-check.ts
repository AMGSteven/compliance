// Utility to check if a lead has been submitted within the past 30 days
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  details?: {
    originalSubmissionDate?: string;
    daysAgo?: number;
  };
}

/**
 * Check if a phone number exists in the leads database within the past 30 days
 * @param phoneNumber The phone number to check
 * @returns Object indicating if duplicate was found and details
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
            daysAgo
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
          daysAgo
        }
      };
    }

    // No duplicate found
    return { isDuplicate: false };
  } catch (error) {
    // Log error but don't block lead submission on check failure
    console.error(`[DUPLICATE CHECK] Error checking for duplicate lead:`, error);
    return { isDuplicate: false };
  }
}
