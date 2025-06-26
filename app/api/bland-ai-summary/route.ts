import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    console.log(`Fetching Bland AI summary for ${date} using batch processing...`);
    
    let totalCost = 0;
    let totalCalls = 0;
    let fromIndex = 0;
    let hasMore = true;
    let batchCount = 0;
    const maxBatches = 10; // Safety limit

    while (hasMore && batchCount < maxBatches) {
      const batchUrl = new URL('/api/bland-ai-costs', request.url);
      batchUrl.searchParams.set('date', date);
      batchUrl.searchParams.set('batch', 'true');
      if (fromIndex > 0) {
        batchUrl.searchParams.set('last_call_id', fromIndex.toString());
      }

      console.log(`Batch ${batchCount + 1}: Fetching from index ${fromIndex}`);

      const response = await fetch(batchUrl.toString(), {
        headers: { 'x-api-key': request.headers.get('x-api-key') || 'test_key_123' }
      });

      if (!response.ok) {
        console.error(`Batch ${batchCount + 1} failed:`, response.status);
        break;
      }

      const batchData = await response.json();
      
      if (!batchData.success || batchData.callCount === 0) {
        console.log(`Batch ${batchCount + 1}: No more calls found`);
        break;
      }

      totalCost += batchData.totalCost;
      totalCalls += batchData.callCount;
      fromIndex = batchData.lastProcessedIndex;
      batchCount++;

      console.log(`Batch ${batchCount} complete: +${batchData.callCount} calls, +$${batchData.totalCost}`);

      // If we got fewer than 1000 calls, we've reached the end
      if (batchData.callCount < 1000) {
        hasMore = false;
      }
    }

    const result = {
      success: true,
      date,
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalCalls,
      batchesProcessed: batchCount,
      costPerCall: totalCalls > 0 ? parseFloat((totalCost / totalCalls).toFixed(4)) : 0,
      summary: `Processed ${totalCalls.toLocaleString()} calls across ${batchCount} batches`
    };

    console.log('Summary result:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in summary endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalCost: 0,
      totalCalls: 0
    });
  }
}
