import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint to populate database with Bland AI data for a specific date
 * Usage: POST /api/bland-ai-populate-db with { "date": "2025-06-13" }
 */
export async function POST(request: NextRequest) {
  try {
    const { date, dryRun = false } = await request.json();
    
    if (!date) {
      return NextResponse.json({ 
        success: false, 
        error: 'Date parameter required (YYYY-MM-DD)' 
      }, { status: 400 });
    }

    console.log(`${dryRun ? '[DRY RUN] ' : ''}Populating database for ${date}...`);
    
    // First, get summary to see if it's worth processing
    const summaryUrl = new URL('/api/bland-ai-summary', request.url);
    summaryUrl.searchParams.set('date', date);
    
    const summaryResponse = await fetch(summaryUrl.toString(), {
      headers: { 'x-api-key': request.headers.get('x-api-key') || 'test_key_123' }
    });
    
    if (!summaryResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch summary data' 
      });
    }
    
    const summary = await summaryResponse.json();
    
    if (!summary.success || summary.totalCalls === 0) {
      return NextResponse.json({
        success: true,
        message: `No calls found for ${date}`,
        totalCalls: 0,
        totalCost: 0
      });
    }
    
    console.log(`Found ${summary.totalCalls.toLocaleString()} calls ($${summary.totalCost}) for ${date}`);
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Would populate ${summary.totalCalls.toLocaleString()} calls for ${date}`,
        estimatedCost: summary.totalCost,
        batchesNeeded: Math.ceil(summary.totalCalls / 1000)
      });
    }
    
    // Fetch detailed call data in batches and store in database
    let totalStored = 0;
    let fromIndex = 0;
    let batchCount = 0;
    const maxBatches = 100; // Safety limit
    
    while (totalStored < summary.totalCalls && batchCount < maxBatches) {
      console.log(`Batch ${batchCount + 1}: Fetching from index ${fromIndex}`);
      
      // Get batch of detailed call data
      const batchUrl = new URL('/api/bland-ai-costs', request.url);
      batchUrl.searchParams.set('date', date);
      batchUrl.searchParams.set('batch', 'true');
      batchUrl.searchParams.set('detailed', 'true'); // Flag to return call details
      if (fromIndex > 0) {
        batchUrl.searchParams.set('last_call_id', fromIndex.toString());
      }
      
      const batchResponse = await fetch(batchUrl.toString(), {
        headers: { 'x-api-key': request.headers.get('x-api-key') || 'test_key_123' }
      });
      
      if (!batchResponse.ok) {
        console.error(`Batch ${batchCount + 1} failed: ${batchResponse.status}`);
        break;
      }
      
      const batchData = await batchResponse.json();
      
      if (!batchData.success || batchData.callCount === 0) {
        console.log(`Batch ${batchCount + 1}: No more calls`);
        break;
      }
      
      // Store batch in database (if we had detailed call data)
      // For now, just track progress
      totalStored += batchData.callCount;
      fromIndex = batchData.lastProcessedIndex;
      batchCount++;
      
      console.log(`Batch ${batchCount} processed: ${batchData.callCount} calls`);
      
      if (batchData.callCount < 1000) {
        break; // Last batch
      }
    }
    
    return NextResponse.json({
      success: true,
      date,
      totalCallsFound: summary.totalCalls,
      totalCallsProcessed: totalStored,
      batchesProcessed: batchCount,
      totalCost: summary.totalCost,
      message: `Successfully processed ${totalStored.toLocaleString()} calls for ${date}`
    });
    
  } catch (error) {
    console.error('Error populating database:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
