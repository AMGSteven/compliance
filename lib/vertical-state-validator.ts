import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Cache for vertical state configs to avoid repeated database queries
const stateConfigCache = new Map<string, { states: Set<string>, timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get allowed states for a specific vertical from the database
 * Results are cached for 5 minutes to improve performance
 */
export async function getAllowedStatesForVertical(vertical: string): Promise<string[]> {
  try {
    // Check cache first
    const cached = stateConfigCache.get(vertical)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Array.from(cached.states)
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('vertical_state_configs')
      .select('state_code')
      .eq('vertical', vertical)
      .eq('is_allowed', true)

    if (error) {
      console.error(`Error fetching allowed states for vertical ${vertical}:`, error)
      // Return fallback states on error
      return getFallbackStatesForVertical(vertical)
    }

    const allowedStates = data?.map(row => row.state_code) || []
    
    // Update cache
    stateConfigCache.set(vertical, {
      states: new Set(allowedStates),
      timestamp: Date.now()
    })

    return allowedStates
  } catch (error) {
    console.error(`Exception fetching allowed states for vertical ${vertical}:`, error)
    return getFallbackStatesForVertical(vertical)
  }
}

/**
 * Check if a state is allowed for a specific vertical
 */
export async function isStateAllowedForVertical(vertical: string, state: string): Promise<boolean> {
  const allowedStates = await getAllowedStatesForVertical(vertical)
  return allowedStates.includes(state.toUpperCase())
}

/**
 * Fallback states if database query fails
 * Uses the current hardcoded allowed states as fallback
 */
function getFallbackStatesForVertical(vertical: string): string[] {
  // Default to current ACA allowed states (union of Internal and Pitch BPO)
  const defaultStates = [
    'AL', 'AR', 'AZ', 'FL', 'GA', 'IN', 'KS', 'KY', 'LA', 'ME', 
    'MI', 'MO', 'MS', 'NC', 'NM', 'OH', 'OK', 'PA', 'SC', 'TN', 
    'TX', 'VA', 'WV'
  ]
  
  console.warn(`Using fallback states for vertical ${vertical}`)
  return defaultStates
}

/**
 * Clear the cache for a specific vertical or all verticals
 */
export function clearVerticalStateCache(vertical?: string) {
  if (vertical) {
    stateConfigCache.delete(vertical)
  } else {
    stateConfigCache.clear()
  }
}

/**
 * Get vertical from list_id by querying list_routings table
 */
export async function getVerticalFromListId(listId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('list_routings')
      .select('vertical')
      .eq('list_id', listId)
      .single()

    if (error || !data) {
      console.error(`Error fetching vertical for list_id ${listId}:`, error)
      return null
    }

    return data.vertical || 'ACA' // Default to ACA if not set
  } catch (error) {
    console.error(`Exception fetching vertical for list_id ${listId}:`, error)
    return null
  }
}
