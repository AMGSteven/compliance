// Supabase Edge Function for Daily Revenue Reports
// Runs at 6PM ET weekdays and sends comprehensive KPI reports to Slack
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Slack webhook URL
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';

// Interface for KPI data
interface DailyKPIs {
  totalLeadCosts: number;
  totalLeads: number;
  totalWeekdayLeads: number;
  totalWeekendLeads: number;
  totalSynergyPayout: number;
  totalSynergyIssuedLeads: number;
  totalTransfers: number;
  activeLists: number;
  blandAICosts: number;
  pitchPerfectCosts: number;
  netProfit: number;
  averageCostPerAcquisition: number;
  issuedRate: number;
  transferRate: number;
  // System health metrics
  mathematicalConsistency: boolean;
  dataIntegrityIssues: string[];
  queryPerformance: number;
}

/**
 * Collect all KPIs using direct Supabase queries with unified architecture
 */
async function collectDailyKPIs(supabase: any, reportDate: string): Promise<DailyKPIs> {
  console.log('📊 Collecting KPIs using unified SQL architecture...');
  const queryStart = Date.now();
  
  const dataIntegrityIssues: string[] = [];
  
  // Step 1: Get active list routings
  console.log('🔍 Fetching active list routings...');
  const { data: listRoutings, error: routingsError } = await supabase
    .from('list_routings')
    .select('list_id, description, bid, active, campaign_id')
    .eq('active', true)
    .gt('bid', 0);

  if (routingsError) {
    throw new Error(`Failed to fetch list routings: ${routingsError.message}`);
  }
  
  const activeLists = listRoutings.length;
  console.log(`✅ Found ${activeLists} active list routings`);

  // Create mapping for quick lookup
  const routingMap: Record<string, any> = {};
  listRoutings.forEach((routing: any) => {
    routingMap[routing.list_id] = routing;
  });

  // Step 2: Use the unified SQL function for consistent lead counting
  console.log('📈 Using unified SQL function for consistent lead counting...');
  
  let totalLeadCosts = 0;
  let totalLeads = 0;
  let totalWeekdayLeads = 0;
  let totalWeekendLeads = 0;
  let totalSynergyIssuedLeads = 0;
  let totalSynergyPayout = 0;
  let totalTransfers = 0;
  let mathematicalConsistency = true;

  // Use the unified function for each list
  const leadCountPromises = Object.keys(routingMap).map(async (listId) => {
    try {
      // Call unified counting function
      const { data: results, error } = await supabase.rpc('get_lead_counts_unified', {
        p_list_id: listId,
        p_start_date: reportDate,
        p_end_date: reportDate,
        p_use_postback_date: false,
        p_policy_status: null,
        p_transfer_status: null,
        p_status: null,
        p_search: null,
        p_weekend_only: false,
        p_page: 1,
        p_page_size: 1
      });

      if (error || !results || results.length === 0) {
        console.warn(`⚠️ No unified results for ${listId}: ${error?.message || 'No data'}`);
        return {
          listId,
          totalCount: 0,
          weekdayCount: 0,
          weekendCount: 0,
          leadCosts: 0,
          issuedCount: 0,
          transferCount: 0,
          consistent: true
        };
      }

      const result = results[0];
      const routing = routingMap[listId];
      
      // Check mathematical consistency
      const weekdayCount = parseInt(result.weekday_count) || 0;
      const weekendCount = parseInt(result.weekend_count) || 0;
      const totalCount = parseInt(result.total_count) || 0;
      const consistent = (weekdayCount + weekendCount) === totalCount;
      
      if (!consistent) {
        dataIntegrityIssues.push(`List ${listId}: Math inconsistency (${weekdayCount}+${weekendCount}≠${totalCount})`);
      }

      // Get issued leads count using the same function
      const { data: issuedResults } = await supabase.rpc('get_lead_counts_unified', {
        p_list_id: listId,
        p_start_date: reportDate,
        p_end_date: reportDate,
        p_use_postback_date: true,
        p_policy_status: 'issued',
        p_transfer_status: null,
        p_status: null,
        p_search: null,
        p_weekend_only: false,
        p_page: 1,
        p_page_size: 1
      });
      
      const issuedCount = issuedResults && issuedResults.length > 0 ? 
        parseInt(issuedResults[0].total_count) || 0 : 0;

      // Get transfer count
      const { data: transferResults } = await supabase.rpc('get_lead_counts_unified', {
        p_list_id: listId,
        p_start_date: reportDate,
        p_end_date: reportDate,
        p_use_postback_date: false,
        p_policy_status: null,
        p_transfer_status: true,
        p_status: null,
        p_search: null,
        p_weekend_only: false,
        p_page: 1,
        p_page_size: 1
      });
      
      const transferCount = transferResults && transferResults.length > 0 ? 
        parseInt(transferResults[0].total_count) || 0 : 0;

      const leadCosts = totalCount * routing.bid;
      
      console.log(`📊 List ${listId}: ${totalCount} leads (${weekdayCount}W/${weekendCount}E), ${issuedCount} issued, ${transferCount} transfers`);
      
      return {
        listId,
        totalCount,
        weekdayCount,
        weekendCount,
        leadCosts,
        issuedCount,
        transferCount,
        consistent
      };

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error processing ${listId}:`, error);
      dataIntegrityIssues.push(`List ${listId}: Query error - ${errorMsg}`);
      return {
        listId,
        totalCount: 0,
        weekdayCount: 0,
        weekendCount: 0,
        leadCosts: 0,
        issuedCount: 0,
        transferCount: 0,
        consistent: false
      };
    }
  });

  const leadCounts = await Promise.all(leadCountPromises);
  
  // Aggregate all results
  leadCounts.forEach(({ totalCount, weekdayCount, weekendCount, leadCosts, issuedCount, transferCount, consistent }) => {
    totalLeads += totalCount;
    totalWeekdayLeads += weekdayCount;
    totalWeekendLeads += weekendCount;
    totalLeadCosts += leadCosts;
    totalSynergyIssuedLeads += issuedCount;
    totalSynergyPayout += issuedCount * 120; // $120 per issued policy
    totalTransfers += transferCount;
    
    if (!consistent) {
      mathematicalConsistency = false;
    }
  });

  console.log(`📊 Aggregated totals: ${totalLeads} leads (${totalWeekdayLeads}W/${totalWeekendLeads}E), ${totalSynergyIssuedLeads} issued, ${totalTransfers} transfers`);

  // Step 3: Get AI costs using direct database queries
  console.log('🤖 Collecting AI costs from database...');
  
  // Bland AI costs
  const { data: blandCosts } = await supabase
    .from('bland_ai_costs')
    .select('cost_amount')
    .gte('created_at', `${reportDate}T00:00:00-05:00`)
    .lte('created_at', `${reportDate}T23:59:59-05:00`);
  
  const blandAICosts = blandCosts?.reduce((sum: number, record: any) => 
    sum + (record.cost_amount || 0), 0) || 0;

  // Pitch Perfect costs
  const { data: ppCosts } = await supabase
    .from('pitch_perfect_costs')
    .select('billable_cost')
    .eq('billable_status', 'billable')
    .gte('created_at', `${reportDate}T00:00:00-05:00`)
    .lte('created_at', `${reportDate}T23:59:59-05:00`);
    
  const pitchPerfectCosts = ppCosts?.reduce((sum: number, record: any) => 
    sum + (record.billable_cost || 0), 0) || 0;

  // Step 4: Calculate derived metrics
  const netProfit = totalSynergyPayout - totalLeadCosts - blandAICosts - pitchPerfectCosts;
  const averageCostPerAcquisition = totalSynergyIssuedLeads > 0 ? totalLeadCosts / totalSynergyIssuedLeads : 0;
  const issuedRate = totalLeads > 0 ? (totalSynergyIssuedLeads / totalLeads) * 100 : 0;
  const transferRate = totalLeads > 0 ? (totalTransfers / totalLeads) * 100 : 0;
  const queryPerformance = Date.now() - queryStart;

  console.log(`✅ KPI collection complete in ${queryPerformance}ms with ${dataIntegrityIssues.length} integrity issues`);

  return {
    totalLeadCosts,
    totalLeads,
    totalWeekdayLeads,
    totalWeekendLeads,
    totalSynergyPayout,
    totalSynergyIssuedLeads,
    totalTransfers,
    activeLists,
    blandAICosts,
    pitchPerfectCosts,
    netProfit,
    averageCostPerAcquisition,
    issuedRate,
    transferRate,
    mathematicalConsistency,
    dataIntegrityIssues,
    queryPerformance
  };
}

/**
 * Format KPIs into a beautiful Slack message
 */
function formatSlackMessage(kpis: DailyKPIs, reportDate: string): any {
  const profitEmoji = kpis.netProfit >= 0 ? '💚' : '❤️‍🔥';
  const healthEmoji = kpis.mathematicalConsistency && kpis.dataIntegrityIssues.length === 0 ? '🟢' : '🟡';
  
  return {
    text: `📊 Daily Revenue Report - ${reportDate}`,
    attachments: [
      {
        color: kpis.mathematicalConsistency && kpis.dataIntegrityIssues.length === 0 ? 'good' : 
               kpis.dataIntegrityIssues.length > 0 ? 'warning' : 'good',
        fields: [
          {
            title: '💰 Revenue Metrics',
            value: 
              `• *Total Lead Costs:* $${kpis.totalLeadCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
              `• *Total Synergy Payout:* $${kpis.totalSynergyPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
              `• *Net Profit:* ${profitEmoji} $${kpis.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            short: true
          },
          {
            title: '📈 Lead Metrics', 
            value:
              `• *Total Leads:* ${kpis.totalLeads.toLocaleString()}\n` +
              `• *Weekday Leads:* ${kpis.totalWeekdayLeads.toLocaleString()}\n` +
              `• *Weekend Leads:* ${kpis.totalWeekendLeads.toLocaleString()}`,
            short: true
          },
          {
            title: '🎯 Performance Metrics',
            value:
              `• *Policies Issued:* ${kpis.totalSynergyIssuedLeads.toLocaleString()}\n` +
              `• *Issued Rate:* ${kpis.issuedRate.toFixed(2)}%\n` +
              `• *Average CPA:* $${kpis.averageCostPerAcquisition.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            short: true
          },
          {
            title: '🔄 Transfer Metrics',
            value:
              `• *Total Transfers:* ${kpis.totalTransfers.toLocaleString()}\n` +
              `• *Transfer Rate:* ${kpis.transferRate.toFixed(2)}%\n` +
              `• *Active Lists:* ${kpis.activeLists}`,
            short: true
          },
          {
            title: '🤖 AI Costs',
            value:
              `• *Bland AI:* $${kpis.blandAICosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
              `• *Pitch Perfect:* $${kpis.pitchPerfectCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
              `• *Total AI:* $${(kpis.blandAICosts + kpis.pitchPerfectCosts).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            short: true
          },
          {
            title: `🔧 System Health ${healthEmoji}`,
            value:
              `• *Math Consistency:* ${kpis.mathematicalConsistency ? '✅ Passed' : '❌ Failed'}\n` +
              `• *Data Issues:* ${kpis.dataIntegrityIssues.length}\n` +
              `• *Query Time:* ${kpis.queryPerformance}ms`,
            short: true
          }
        ],
        footer: `Generated by Enterprise Revenue Tracking | EST Timezone Consistent | Unified SQL Architecture`,
        footer_icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
}

/**
 * Send the formatted message to Slack
 */
async function sendSlackNotification(message: any): Promise<void> {
  console.log('📤 Sending report to Slack...');
  
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send Slack notification: ${response.status} ${errorText}`);
  }

  console.log('✅ Slack notification sent successfully');
}

/**
 * Send error notification to Slack
 */
async function sendErrorNotification(errorMessage: string): Promise<void> {
  try {
    const errorMsg = {
      text: '🚨 Daily Revenue Report - ERROR',
      attachments: [
        {
          color: 'danger',
          fields: [
            {
              title: 'Error Details',
              value: `❌ *Error:* ${errorMessage}\n⏰ *Time:* ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`,
              short: false
            }
          ],
          footer: 'Enterprise Revenue Tracking System - Error Handler',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorMsg)
    });
  } catch (err) {
    console.error('Failed to send error notification:', err);
  }
}

/**
 * Enterprise-grade daily revenue report edge function
 * Collects KPIs directly from Supabase and sends formatted reports to Slack
 */
serve(async (req: Request) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Daily Revenue Report Edge Function - Starting...');
    
    // Get today's date in EST timezone
    const now = new Date();
    const estFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const estDate = estFormatter.format(now);
    const [month, day, year] = estDate.split('/');
    const todayStr = `${year}-${month}-${day}`;
    
    console.log(`📅 Generating report for: ${todayStr} (EST)`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if today is a weekday (Monday-Friday)
    const dayOfWeek = now.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (!isWeekday) {
      console.log('⏭️ Skipping report - not a weekday');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Not a weekday',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
      }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Collect KPIs using direct database queries
    const kpis = await collectDailyKPIs(supabase, todayStr);
    
    // Format and send Slack message
    const slackMessage = formatSlackMessage(kpis, todayStr);
    await sendSlackNotification(slackMessage);
    
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Daily Revenue Report completed in ${executionTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      executionTime: `${executionTime}ms`,
      reportDate: todayStr,
      kpis: {
        totalLeads: kpis.totalLeads,
        totalLeadCosts: kpis.totalLeadCosts,
        netProfit: kpis.netProfit,
        mathematicalConsistency: kpis.mathematicalConsistency,
        activeLists: kpis.activeLists
      },
      message: 'Daily revenue report sent successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('🚨 Daily Revenue Report Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Send error notification to Slack
    await sendErrorNotification(errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});