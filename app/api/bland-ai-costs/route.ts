import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface BlandAICall {
  call_id: string;
  created_at: string;
  call_length: number;
  price: number;
  completed: boolean;
}

interface BlandAIResponse {
  count: number;
  total_count: number;
  calls: BlandAICall[];
}

// Helper function to get date in EST timezone
function formatDateForBlandAPI(date: Date): string {
  // Convert to EST (UTC-5)
  const estOffset = -5 * 60; // EST is UTC-5
  const estTime = new Date(date.getTime() + (estOffset * 60 * 1000));
  
  const year = estTime.getUTCFullYear();
  const month = String(estTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(estTime.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

async function fetchBlandAICosts(date: string, apiKey: string): Promise<number> {
  let totalCost = 0;
  let hasMoreData = true;
  let fromIndex = 0;
  const limit = 1000;

  try {
    while (hasMoreData) {
      const url = new URL('https://api.bland.ai/v1/calls');
      // Use created_at since it works in direct tests
      url.searchParams.set('created_at', date);
      url.searchParams.set('limit', limit.toString());
      
      // Only add 'from' parameter if we're on a subsequent page
      if (fromIndex > 0) {
        url.searchParams.set('from', fromIndex.toString());
      }

      console.log(`Fetching Bland AI costs for ${date} (from index: ${fromIndex})`);
      console.log(`API URL: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Bland AI API Response Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Bland AI API error: ${response.status} ${response.statusText}`);
        console.error('Error response:', errorText);
        
        // If it's a 400 error, it might be no data for this date
        if (response.status === 400) {
          console.log(`No calls found for date ${date}, returning $0.00`);
          return 0;
        }
        
        throw new Error(`Bland AI API error: ${response.status} - ${errorText}`);
      }

      const data: BlandAIResponse = await response.json();
      console.log(`Found ${data.count} calls for ${date} (from index: ${fromIndex})`);
      console.log(`Total count available: ${data.total_count}`);

      // Sum up the costs from this batch
      const batchCost = data.calls.reduce((sum, call) => sum + (call.price || 0), 0);
      totalCost += batchCost;
      console.log(`Batch cost: $${batchCost.toFixed(4)}, Running total: $${totalCost.toFixed(4)}`);

      // Check if we need to fetch more data - only if we got exactly the limit
      if (data.calls.length === limit && data.total_count > limit) {
        // Move to next page using integer index
        fromIndex += limit;
        console.log(`More data available, fetching next page from index: ${fromIndex}`);
      } else {
        hasMoreData = false;
        console.log(`Finished fetching all calls for ${date}. Total calls: ${data.count}, Total cost: $${totalCost.toFixed(4)}`);
      }
    }

    return totalCost;
  } catch (error) {
    console.error('Error fetching Bland AI costs:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const batchMode = searchParams.get('batch') === 'true';
  const lastCallId = searchParams.get('last_call_id');

  if (!process.env.BLAND_AI_API_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'Bland AI API key not configured',
      totalCost: 0,
      callCount: 0 
    });
  }

  if (!date) {
    return NextResponse.json({ 
      success: false, 
      error: 'Date parameter is required (YYYY-MM-DD format)',
      totalCost: 0,
      callCount: 0 
    });
  }

  try {
    // For batch mode, fetch smaller chunks (1000 calls max per request)
    const batchSize = batchMode ? 1000 : 1000; // API limit is 1000
    let totalCost = 0;
    let totalCalls = 0;
    let processedBatches = 0;
    let fromIndex = lastCallId ? parseInt(lastCallId) : 0;
    const maxBatches = batchMode ? 5 : 100; // Limit batches to prevent timeout

    console.log(`Starting ${batchMode ? 'batch' : 'full'} fetch for date: ${date}`);
    console.log(`Batch size: ${batchSize}, Starting from: ${fromIndex}`);

    while (processedBatches < maxBatches) {
      const url = new URL('https://api.bland.ai/v1/calls');
      url.searchParams.append('created_at', date);
      url.searchParams.append('limit', batchSize.toString());
      
      // Only add 'from' parameter if fromIndex > 0 to avoid timeout issues
      if (fromIndex > 0) {
        url.searchParams.append('from', fromIndex.toString());
      }

      console.log(`Batch ${processedBatches + 1}: Fetching calls from index ${fromIndex}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout per batch

      try {
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': process.env.BLAND_AI_API_KEY,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Bland AI API error: ${response.status} - ${errorText}`);
          
          if (response.status === 504 && processedBatches === 0) {
            // If first batch times out, return error
            return NextResponse.json({ 
              success: false, 
              error: `Bland AI API error: ${response.status} - Gateway timeout`,
              totalCost: 0,
              callCount: 0 
            });
          } else if (response.status === 504) {
            // If later batch times out, return partial results
            console.log(`Timeout on batch ${processedBatches + 1}, returning partial results`);
            break;
          } else {
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        }

        const data = await response.json();
        console.log(`Batch ${processedBatches + 1} response:`, {
          callsInBatch: data.calls?.length || 0,
          hasMore: !!data.calls?.length
        });

        if (!data.calls || data.calls.length === 0) {
          console.log('No more calls found, ending batch processing');
          break;
        }

        // Process calls in this batch
        const batchCost = data.calls.reduce((sum: number, call: any) => {
          const callCost = (call.price || 0) + (call.cost || 0);
          return sum + callCost;
        }, 0);

        totalCost += batchCost;
        totalCalls += data.calls.length;
        processedBatches++;
        fromIndex += data.calls.length;

        console.log(`Batch ${processedBatches} complete: ${data.calls.length} calls, $${batchCost.toFixed(2)}`);

        // If batch returned fewer calls than requested, we've reached the end
        if (data.calls.length < batchSize) {
          console.log('Reached end of data (partial batch returned)');
          break;
        }

      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`Batch ${processedBatches + 1} timed out after 30 seconds`);
          if (processedBatches > 0) {
            // Return partial results if we have some data
            break;
          } else {
            return NextResponse.json({ 
              success: false, 
              error: 'Request timed out - try batch mode or reduce date range',
              totalCost: 0,
              callCount: 0 
            });
          }
        } else {
          throw error;
        }
      }
    }

    const result = {
      success: true,
      totalCost: parseFloat(totalCost.toFixed(2)),
      callCount: totalCalls,
      date,
      batchesProcessed: processedBatches,
      lastProcessedIndex: fromIndex,
      message: batchMode 
        ? `Processed ${processedBatches} batches (${totalCalls} calls) - Use last_call_id=${fromIndex} for next batch`
        : `Processed ${totalCalls} calls across ${processedBatches} batches`
    };

    console.log('Final result:', result);
    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Error fetching Bland AI costs:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      totalCost: 0,
      callCount: 0 
    });
  }
}
