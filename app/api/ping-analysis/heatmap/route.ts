/**
 * Ping Analysis - Heatmap API
 * 
 * Returns cross-list duplicate matrix for heat map visualization.
 * Shows which lists have duplicate phone overlaps with each other.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30*24*60*60*1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const vertical = searchParams.get('vertical');  // Optional filter
    const minThreshold = parseFloat(searchParams.get('min_threshold') || '1'); // Minimum duplicate count to show
    
    const supabase = createServerClient();
    
    // Get rejection data with list pairs
    let query = supabase
      .from('lead_rejections')
      .select('incoming_list_id, matched_list_id, phone, incoming_vertical, matched_vertical')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('rejection_reason', 'duplicate')
      .not('matched_list_id', 'is', null);
    
    if (vertical) {
      query = query.eq('incoming_vertical', vertical);
    }
    
    const { data: rejections, error: rejectionError } = await query;
    
    if (rejectionError) {
      console.error('Error fetching heatmap data:', rejectionError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch heatmap data' 
      }, { status: 500 });
    }
    
    // Get list routing information
    const { data: listRoutings, error: routingError } = await supabase
      .from('list_routings')
      .select('list_id, description, partner_name, vertical')
      .eq('active', true);
    
    if (routingError) {
      console.error('Error fetching list routings:', routingError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch list routing data' 
      }, { status: 500 });
    }
    
    // Create routing lookup map
    const routingMap = new Map(listRoutings?.map(r => [r.list_id, r]) || []);
    
    // Build matrix data structure
    const matrix = new Map<string, Map<string, {
      count: number;
      uniquePhones: Set<string>;
    }>>();
    
    rejections?.forEach(r => {
      const incomingId = r.incoming_list_id;
      const matchedId = r.matched_list_id;
      
      if (!matchedId) return;
      
      if (!matrix.has(incomingId)) {
        matrix.set(incomingId, new Map());
      }
      
      const incomingMap = matrix.get(incomingId)!;
      if (!incomingMap.has(matchedId)) {
        incomingMap.set(matchedId, {
          count: 0,
          uniquePhones: new Set()
        });
      }
      
      const cell = incomingMap.get(matchedId)!;
      cell.count++;
      cell.uniquePhones.add(r.phone);
    });
    
    // Calculate totals for percentage calculation
    const listTotals = new Map<string, number>();
    rejections?.forEach(r => {
      listTotals.set(
        r.incoming_list_id,
        (listTotals.get(r.incoming_list_id) || 0) + 1
      );
    });
    
    // Convert to array format for frontend
    const matrixData: any[] = [];
    const listIds = new Set<string>();
    
    matrix.forEach((matchedLists, incomingId) => {
      listIds.add(incomingId);
      const totalForList = listTotals.get(incomingId) || 1;
      
      matchedLists.forEach((stats, matchedId) => {
        listIds.add(matchedId);
        
        const duplicateRate = (stats.count / totalForList) * 100;
        
        // Filter by minimum threshold
        if (stats.count < minThreshold) return;
        
        const incomingRouting = routingMap.get(incomingId);
        const matchedRouting = routingMap.get(matchedId);
        
        matrixData.push({
          incoming_list_id: incomingId,
          incoming_description: incomingRouting?.description || 'Unknown',
          incoming_partner: incomingRouting?.partner_name || 'Unknown',
          incoming_vertical: incomingRouting?.vertical || 'Unknown',
          matched_list_id: matchedId,
          matched_description: matchedRouting?.description || 'Unknown',
          matched_partner: matchedRouting?.partner_name || 'Unknown',
          matched_vertical: matchedRouting?.vertical || 'Unknown',
          duplicate_count: stats.count,
          unique_phones: stats.uniquePhones.size,
          duplicate_rate: duplicateRate
        });
      });
    });
    
    // Get list information for axes
    const lists = Array.from(listIds).map(listId => {
      const routing = routingMap.get(listId);
      return {
        list_id: listId,
        description: routing?.description || 'Unknown List',
        partner_name: routing?.partner_name || 'Unknown',
        vertical: routing?.vertical || 'Unknown'
      };
    }).sort((a, b) => a.description.localeCompare(b.description));
    
    return NextResponse.json({
      success: true,
      data: {
        matrix: matrixData.sort((a, b) => b.duplicate_rate - a.duplicate_rate),
        lists: lists
      },
      metadata: {
        start_date: startDate,
        end_date: endDate,
        vertical_filter: vertical || 'all',
        total_pairs: matrixData.length,
        total_lists: lists.length,
        min_threshold: minThreshold
      }
    });
    
  } catch (error) {
    console.error('Error in ping-analysis heatmap API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

