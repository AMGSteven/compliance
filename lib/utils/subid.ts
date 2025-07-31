/**
 * Shared SUBID utility functions for consistent SUBID handling across the application
 */

/**
 * Normalize SUBID key variations for consistent analytics and bidding
 * Handles various SUBID key formats and JSON string parsing from Supabase
 */
export function normalizeSubIdKey(customFields: any): string | null {
  if (!customFields) return null;
  
  // Handle custom_fields that come as JSON strings from Supabase
  let parsedFields: any;
  
  if (typeof customFields === 'string') {
    try {
      parsedFields = JSON.parse(customFields);
    } catch (error) {
      console.error('Failed to parse custom_fields JSON:', error);
      return null;
    }
  } else if (typeof customFields === 'object') {
    parsedFields = customFields;
  } else {
    return null;
  }
  
  // Check common SUBID key variations (case-insensitive)
  const subidKeys = ['subid', 'sub_id', 'SUBID', 'SUB_ID', 'SubId', 'subId'];
  
  for (const key of subidKeys) {
    const value = parsedFields[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
  }
  
  return null;
}

/**
 * Extract SUBID from lead data for bidding engine
 * @param leadData - Lead object with custom_fields
 * @returns Normalized SUBID string or null
 */
export function extractSubIdFromLead(leadData: any): string | null {
  return normalizeSubIdKey(leadData?.custom_fields);
} 