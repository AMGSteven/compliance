import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Check if a dialer is approved for a specific list ID
 * @param listId The list ID to check
 * @param dialerType The dialer type (1=Internal, 2=Pitch BPO, 3=Convoso)
 * @returns Promise<boolean> true if approved, false if denied
 */
export async function isDialerApproved(listId: string, dialerType: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('dialer_approvals')
      .select('approved')
      .eq('list_id', listId)
      .eq('dialer_type', dialerType)
      .single();

    if (error) {
      console.warn(`No dialer approval record found for list_id: ${listId}, dialer_type: ${dialerType}. Defaulting to approved.`);
      return true; // Default to approved if no record exists (backward compatibility)
    }

    return data.approved === true;
  } catch (error) {
    console.error('Error checking dialer approval:', error);
    return true; // Default to approved on error (fail-safe)
  }
}

/**
 * Validate that all requested dialer configurations are approved
 * @param listId The list ID to check
 * @param dialerTypes Array of dialer types to validate
 * @returns Promise<{isValid: boolean, deniedDialers: number[]}> 
 */
export async function validateDialerApprovals(
  listId: string, 
  dialerTypes: number[]
): Promise<{isValid: boolean, deniedDialers: number[]}> {
  const deniedDialers: number[] = [];
  
  for (const dialerType of dialerTypes) {
    const isApproved = await isDialerApproved(listId, dialerType);
    if (!isApproved) {
      deniedDialers.push(dialerType);
    }
  }
  
  return {
    isValid: deniedDialers.length === 0,
    deniedDialers
  };
}

/**
 * Get dialer type name for display purposes
 */
export function getDialerTypeName(dialerType: number): string {
  switch (dialerType) {
    case 1: return 'Internal Dialer';
    case 2: return 'Pitch BPO';
    case 3: return 'Convoso';
    default: return `Unknown Dialer (${dialerType})`;
  }
}
