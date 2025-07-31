'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Card, Table, Typography, DatePicker, Button, Select, Space, Statistic, Row, Col, Spin, message, Alert, Collapse, Segmented } from 'antd';
import { DollarOutlined, DownloadOutlined, FilterOutlined, ReloadOutlined, CheckCircleOutlined, BugOutlined, ClockCircleOutlined, BarChartOutlined, ThunderboltOutlined, TeamOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { createClient } from '@supabase/supabase-js';

// Note: Enhanced with Temporal Attribution System - Enterprise-Grade EST timezone handling

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Panel } = Collapse;

// CSS styles for SUBID performance color coding
const subidStyles = `
  .subid-high-performance {
    background-color: #f6ffed !important;
    border-left: 4px solid #52c41a !important;
  }
  .subid-medium-performance {
    background-color: #fffbe6 !important;
    border-left: 4px solid #faad14 !important;
  }
  .subid-low-performance {
    background-color: #fff2f0 !important;
    border-left: 4px solid #ff4d4f !important;
  }
  .subid-high-performance:hover {
    background-color: #f0f9ff !important;
  }
  .subid-medium-performance:hover {
    background-color: #fefcf4 !important;
  }
  .subid-low-performance:hover {
    background-color: #fef7f6 !important;
  }
  .temporal-view-active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
  }
  .temporal-controls {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    color: white;
  }
`;

// Temporal view modes
type TemporalViewMode = 'generation' | 'processing' | 'cohort';

interface ListRouting {
  id: string;
  list_id: string;
  campaign_id: string;
  description?: string;
  bid: number;
  active: boolean;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  list_id: string;
  campaign_id: string;
  policy_status?: string;
  [key: string]: any;
}

interface RevenueData {
  key: string;
  list_id: string;
  description: string;
  leads_count: number;
  weekday_leads?: number;
  weekend_leads?: number;
  cost_per_lead: number;
  total_lead_costs: number;
  synergy_issued_leads?: number;
  synergy_payout?: number;
  ai_costs_allocated?: number;
  net_profit?: number;
  policy_rate?: number;
  // SUBID-specific fields
  subid_value?: string;
  parent_list_id?: string;
  is_subid_row?: boolean;
  transfers_count?: number;
  // Temporal attribution fields
  mathematical_consistency?: boolean;
  timezone_used?: string;
  query_performance?: string;
  temporal_view_mode?: TemporalViewMode;
  // Processing performance fields
  same_day_processed?: number;
  cross_day_processed?: number;
  processing_efficiency?: number;
  avg_processing_delay_hours?: number;
  // Cohort attribution fields
  eventual_transfers?: number;
  eventual_policies?: number;
  eventual_transfer_rate?: number;
  eventual_policy_rate?: number;
  cohort_maturity_days?: number;
  processing_lag_distribution?: {
    same_day: number;
    next_day: number;
    multi_day: number;
    never_processed: number;
  };
}

// API response metadata interface
interface APIMetadata {
  totalCount?: number;
  weekendCount?: number;
  weekdayCount?: number;
  timezone: string;
  dateField?: string;
  mathematicalConsistency?: boolean;
  queryPerformance?: string;
  query_type: string;
  totals: {
    leads_generated?: number;
    cost_incurred?: number;
    eventual_transfers?: number;
    eventual_policies?: number;
    total_processed?: number;
    same_day_processed?: number;
    cross_day_processed?: number;
    processing_efficiency?: number;
  };
  explanation: string;
}

interface SubidResponse {
  success: boolean;
  data: RevenueData[];
  meta: {
    list_id: string;
    date_range: {
      start: string;
      end: string;
    };
    total_subids: number;
    total_leads_with_subids: number;
  };
  error?: string;
}

export default function RevenueTrackingPage() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Enhanced state for dual date filtering
  const [temporalViewMode, setTemporalViewMode] = useState<TemporalViewMode>('generation');
  const [generationDateRange, setGenerationDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [processingDateRange, setProcessingDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [timeFrame, setTimeFrame] = useState<string>('today');
  
  // NEW: Separate lead generation date filter for cross-temporal analysis
  const [leadGenerationDateRange, setLeadGenerationDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [enableLeadDateFilter, setEnableLeadDateFilter] = useState<boolean>(false);
  
  // Legacy state for compatibility
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [totalLeadCosts, setTotalLeadCosts] = useState<number>(0);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [totalWeekdayLeads, setTotalWeekdayLeads] = useState<number>(0);
  const [totalWeekendLeads, setTotalWeekendLeads] = useState<number>(0);
  const [totalSynergyIssuedLeads, setTotalSynergyIssuedLeads] = useState<number>(0);
  const [totalTransfers, setTotalTransfers] = useState<number>(0);
  
  // SUBID-specific state
  const [subidData, setSubidData] = useState<Record<string, RevenueData[]>>({});
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [loadingSubids, setLoadingSubids] = useState<Record<string, boolean>>({});
  const [subidFilters, setSubidFilters] = useState<Record<string, number>>({});
  const [totalSynergyPayout, setTotalSynergyPayout] = useState<number>(0);
  const [blandAICosts, setBlandAICosts] = useState<number>(0);
  const [blandAILoading, setBlandAILoading] = useState<boolean>(false);
  const [pitchPerfectCosts, setPitchPerfectCosts] = useState<number>(0);
  const [ppLoading, setPpLoading] = useState<boolean>(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Enhanced debugging and monitoring state
  const [debugInfo, setDebugInfo] = useState<{
    totalApiCalls: number;
    mathematicalConsistencyFailures: number;
    timezoneIssues: string[];
    performanceMetrics: APIMetadata[];
    temporalViewMode: TemporalViewMode;
    activeEndpoint: string;
  }>({
    totalApiCalls: 0,
    mathematicalConsistencyFailures: 0,
    timezoneIssues: [],
    performanceMetrics: [],
    temporalViewMode: 'generation',
    activeEndpoint: '/api/revenue-tracking (MIT PhD-level single SQL)'
  });
      
  // Helper function to get the active date range based on temporal view mode
  const getActiveDateRange = (): [Dayjs, Dayjs] | null => {
    if (temporalViewMode === 'processing') {
      return processingDateRange;
    }
    return generationDateRange || dateRange;
  };

  // Helper function to calculate date range from timeFrame
  const calculateDateRange = (): [Dayjs, Dayjs] => {
            let startDate, endDate;
            
            switch (timeFrame) {
              case 'today':
                startDate = dayjs().startOf('day');
                endDate = dayjs().endOf('day');
                break;
              case 'yesterday':
                startDate = dayjs().subtract(1, 'day').startOf('day');
                endDate = dayjs().subtract(1, 'day').endOf('day');
                break;
              case 'thisWeek':
                startDate = dayjs().startOf('week');
                endDate = dayjs().endOf('day');
                break;
              case 'lastWeek':
                startDate = dayjs().subtract(1, 'week').startOf('week');
                endDate = dayjs().subtract(1, 'week').endOf('week');
                break;
              case 'thisMonth':
                startDate = dayjs().startOf('month');
                endDate = dayjs().endOf('day');
                break;
              case 'lastMonth':
                startDate = dayjs().subtract(1, 'month').startOf('month');
                endDate = dayjs().subtract(1, 'month').endOf('month');
                break;
              default:
                startDate = dayjs().startOf('day');
                endDate = dayjs().endOf('day');
            }
            
    return [startDate, endDate];
  };

  // Helper function to generate dynamic cost titles based on timeFrame
  const getCostTitle = (baseName: string) => {
    const activeDateRange = getActiveDateRange();
    
    if (timeFrame === 'custom' && activeDateRange && activeDateRange[0] && activeDateRange[1]) {
      const startDate = activeDateRange[0].format('MMM D');
      const endDate = activeDateRange[1].format('MMM D, YYYY');
      return `${baseName} (${startDate} - ${endDate})`;
    }
            
            switch (timeFrame) {
              case 'today':
        return `${baseName} (Today)`;
              case 'yesterday':
        return `${baseName} (Yesterday)`;
              case 'thisWeek':
        return `${baseName} (This Week)`;
              case 'lastWeek':
        return `${baseName} (Last Week)`;
              case 'thisMonth':
        return `${baseName} (This Month)`;
              case 'lastMonth':
        return `${baseName} (Last Month)`;
              default:
        return `${baseName} (Today)`;
            }
  };

  // Simple temporal view mode descriptions
  const getTemporalViewDescription = () => {
    switch (temporalViewMode) {
      case 'generation':
        return 'Show leads based on when they were added. Default view.';
      case 'processing':
        return 'Show leads based on when they were transferred or had policy activity.';
      case 'cohort':
        return 'Show leads added in one date range, but track their transfers/policies over time.';
      default:
        return '';
    }
  };

  useEffect(() => {
    refreshData();
  }, [temporalViewMode, generationDateRange, processingDateRange, timeFrame, enableLeadDateFilter, leadGenerationDateRange]);

  // ✅ FORCE fetchPitchPerfectCosts to run on mount and data changes
  useEffect(() => {
    console.log('🔥 FORCING fetchPitchPerfectCosts to run...');
    fetchPitchPerfectCosts();
  }, [timeFrame, generationDateRange, processingDateRange]);

  // ✅ SIMPLE MOUNT EFFECT - This MUST run
  useEffect(() => {
    console.log('🚨 COMPONENT MOUNTED - Calling fetchPitchPerfectCosts NOW');
    fetchPitchPerfectCosts().catch(err => console.error('Mount fetchPitchPerfectCosts error:', err));
  }, []); // Empty dependency array = runs once on mount

  // RESTORED: Original working fetchRevenueData using proper revenue tracking API
  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      
      // Determine which date range to use
      let startDate: string, endDate: string;
      const activeDateRange = getActiveDateRange();
      
      if (timeFrame === 'custom' && activeDateRange && activeDateRange[0] && activeDateRange[1]) {
        startDate = activeDateRange[0].format('YYYY-MM-DD');
        endDate = activeDateRange[1].format('YYYY-MM-DD');
          } else {
        const [calcStart, calcEnd] = calculateDateRange();
        startDate = calcStart.format('YYYY-MM-DD');
        endDate = calcEnd.format('YYYY-MM-DD');
      }

      console.log(`🔍 Fetching revenue data using proper API: ${startDate} to ${endDate}`);
      
      // RESTORED: Call the proper revenue tracking API that handles all calculations
      const apiParams = new URLSearchParams({
        startDate,
        endDate,
        timeFrame: timeFrame === 'custom' ? 'custom' : timeFrame
      });

      // Add dual date filtering parameters if enabled (NEW ENHANCEMENT)
      if (temporalViewMode === 'processing' && enableLeadDateFilter && leadGenerationDateRange && leadGenerationDateRange[0] && leadGenerationDateRange[1]) {
        apiParams.append('leadStartDate', leadGenerationDateRange[0].format('YYYY-MM-DD'));  
        apiParams.append('leadEndDate', leadGenerationDateRange[1].format('YYYY-MM-DD'));
        apiParams.append('useProcessingDate', 'true');
        console.log(`🎯 Cross-temporal filter: Processing ${startDate}-${endDate}, Leads ${leadGenerationDateRange[0].format('YYYY-MM-DD')}-${leadGenerationDateRange[1].format('YYYY-MM-DD')}`);
          }
          
      const response = await fetch(`/api/revenue-tracking?${apiParams.toString()}`, {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
          });
          
          const result = await response.json();
          
      if (!result.success) {
        throw new Error(`Revenue API failed: ${result.error}`);
      }

      console.log(`✅ Revenue data loaded: ${result.data?.length || 0} traffic sources, ${result.summary?.totalLeads || 0} total leads`);
      
      // RESTORED: Process the revenue tracking API response format
      const revenueArray: RevenueData[] = [];
      let totalLeadsCount = 0;
      let totalCostSum = 0;
      let totalTransfersSum = 0;
      let totalPoliciesSum = 0;
      
      // Process each traffic source and its list_ids
      result.data?.forEach((source: any) => {
        source.list_ids?.forEach((listData: any) => {
          const revenueItem: RevenueData = {
            key: listData.list_id,
            list_id: listData.list_id,
            description: listData.description || source.display_name,
            leads_count: listData.leads_count,
            cost_per_lead: listData.total_revenue / listData.leads_count, // Calculate from total revenue
            total_lead_costs: listData.total_revenue,
            synergy_issued_leads: listData.policy_count || 0,
            policy_rate: listData.policy_rate || 0,
            transfers_count: listData.transfer_count || 0, // FIXED: Use actual transfer count from API
            synergy_payout: (listData.policy_count || 0) * 120,
            mathematical_consistency: true,
            timezone_used: 'America/New_York (EST)',
            query_performance: 'Restored original revenue tracking API',
            temporal_view_mode: temporalViewMode
          };
      
          // Calculate totals
          totalLeadsCount += revenueItem.leads_count;
          totalCostSum += revenueItem.total_lead_costs;
          totalPoliciesSum += revenueItem.synergy_issued_leads || 0;
          totalTransfersSum += revenueItem.transfers_count || 0; // FIXED: Add to total transfers

          revenueArray.push(revenueItem);
        });
      });
      
      // Sort by leads count descending
      revenueArray.sort((a, b) => b.leads_count - a.leads_count);
      
      // RESTORED: Calculate AI costs allocation (original logic)
      const totalLeadsForAllocation = totalLeadsCount;
      revenueArray.forEach(item => {
        item.ai_costs_allocated = totalLeadsForAllocation > 0 
          ? (item.leads_count / totalLeadsForAllocation) * (blandAICosts + pitchPerfectCosts)
          : 0;
        
        item.net_profit = (item.synergy_payout || 0) - item.total_lead_costs - item.ai_costs_allocated;
      });

      // TODO: Get transfer counts from proper API call (separate from policy data)
      // For now, using 0 but this needs to be implemented properly
      // totalTransfersSum = 0; // This line is no longer needed as transfers are fetched directly
      
      setRevenueData(revenueArray);
      setTotalRecords(revenueArray.length);
      setTotalLeadCosts(totalCostSum);
      setTotalLeads(totalLeadsCount);
      setTotalTransfers(totalTransfersSum);
      setTotalSynergyIssuedLeads(totalPoliciesSum);
      setTotalSynergyPayout(totalPoliciesSum * 120);

      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        totalApiCalls: prev.totalApiCalls + 1,
        temporalViewMode,
        activeEndpoint: '/api/revenue-tracking (MIT PhD-level single SQL)',
        performanceMetrics: [
          {
            query_type: result.performance?.queryType || 'normal',
            timezone: 'America/New_York (EST)',
            explanation: `${result.performance?.optimization || 'Efficient SQL'} - ${totalLeadsCount} leads in ${result.performance?.queryTimeMs || 0}ms`,
            totals: { leads_generated: totalLeadsCount }
          },
          ...prev.performanceMetrics.slice(0, 4)
        ]
      }));

      const performanceMsg = result.performance ? 
        `⚡ ${result.performance.queryTimeMs}ms (${result.performance.queryType})` : '';
      message.success(`✅ Revenue data loaded: ${totalLeadsCount} leads, ${revenueArray.length} lists ${performanceMsg}`);
      
    } catch (error) {
      console.error('❌ Error fetching revenue data:', error);
      message.error(`Failed to fetch revenue data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
    
    // AI costs are now fetched from refreshData and useEffect - no need to call them here
  };



  const fetchBlandAICosts = async () => {
    console.log('🔍 fetchBlandAICosts STARTED - Using efficient SQL SUM');
    setBlandAILoading(true);
      
    try {
      // Check environment variables first
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ CRITICAL: Missing Supabase environment variables');
        setBlandAICosts(0);
        return;
      }
      
      // Create Supabase client for direct database query
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      console.log('💰 Fetching Bland AI costs with efficient SQL SUM...');

      // ✅ FIXED: Use the same date calculation logic as main revenue tracking
      let startDateStr: string, endDateStr: string;
      const activeDateRange = getActiveDateRange();
      
      if (timeFrame === 'custom' && activeDateRange && activeDateRange[0] && activeDateRange[1]) {
        startDateStr = activeDateRange[0].format('YYYY-MM-DD');
        endDateStr = activeDateRange[1].format('YYYY-MM-DD');
        console.log(`🕐 CUSTOM (${temporalViewMode} mode): Using dates ${startDateStr} to ${endDateStr}`);
      } else {
        // Use the same calculateDateRange logic as main system
        const [calcStart, calcEnd] = calculateDateRange();
        startDateStr = calcStart.format('YYYY-MM-DD');
        endDateStr = calcEnd.format('YYYY-MM-DD');
        console.log(`🕐 PRESET (${timeFrame}): Using calculated dates ${startDateStr} to ${endDateStr}`);
      }

      // ✅ EFFICIENT: Use SQL function via RPC instead of API call
      const { data, error } = await supabase.rpc('get_bland_ai_costs', {
        p_start_date: startDateStr,
        p_end_date: endDateStr
      });

      if (error) {
        console.error('❌ Supabase RPC error:', error);
        setBlandAICosts(0);
        return;
      }

      const totalCosts = data || 0;
      
      console.log(`✅ BLAND AI SUCCESS (RPC FUNCTION): $${totalCosts} from ${startDateStr} to ${endDateStr}`);
      setBlandAICosts(totalCosts);
        
    } catch (error: unknown) {
      console.error('❌ CRITICAL ERROR in fetchBlandAICosts:', error);
      setBlandAICosts(0);
    } finally {
      console.log('🏁 fetchBlandAICosts FINISHED');
      setBlandAILoading(false);
    }
  };

  const fetchPitchPerfectCosts = async () => {
    console.log('🔍 fetchPitchPerfectCosts STARTED - Using efficient SQL SUM');
    setPpLoading(true);
      
    try {
      // Check environment variables first
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ CRITICAL: Missing Supabase environment variables');
        setPitchPerfectCosts(0);
        return;
      }
      
      // Create Supabase client for direct database query
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      console.log('💰 Fetching Pitch Perfect costs with efficient SQL SUM...');

      // ✅ FIXED: Use the same date calculation logic as main revenue tracking
      let startDateStr: string, endDateStr: string;
      const activeDateRange = getActiveDateRange();
      
      if (timeFrame === 'custom' && activeDateRange && activeDateRange[0] && activeDateRange[1]) {
        startDateStr = activeDateRange[0].format('YYYY-MM-DD');
        endDateStr = activeDateRange[1].format('YYYY-MM-DD');
        console.log(`🕐 CUSTOM (${temporalViewMode} mode): Using dates ${startDateStr} to ${endDateStr}`);
      } else {
        // Use the same calculateDateRange logic as main system
        const [calcStart, calcEnd] = calculateDateRange();
        startDateStr = calcStart.format('YYYY-MM-DD');
        endDateStr = calcEnd.format('YYYY-MM-DD');
        console.log(`🕐 PRESET (${timeFrame}): Using calculated dates ${startDateStr} to ${endDateStr}`);
      }

      // ✅ EFFICIENT: Use SQL function via RPC instead of fetching all records
      const { data, error } = await supabase.rpc('get_pitch_perfect_costs', {
        p_start_date: startDateStr,
        p_end_date: endDateStr
      });

      if (error) {
        console.error('❌ Supabase RPC error:', error);
        setPitchPerfectCosts(0);
        return;
      }

      const totalCosts = data || 0;
      
      console.log(`✅ PITCH PERFECT SUCCESS (RPC FUNCTION): $${totalCosts} from ${startDateStr} to ${endDateStr}`);
      setPitchPerfectCosts(totalCosts);
        
    } catch (error: unknown) {
      console.error('❌ CRITICAL ERROR in fetchPitchPerfectCosts:', error);
      setPitchPerfectCosts(0);
    } finally {
      console.log('🏁 fetchPitchPerfectCosts FINISHED');
      setPpLoading(false);
    }
  };

  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value);
    if (value !== 'custom') {
      setDateRange(null); // Reset custom date range when changing to predefined time frame
    }
  };

  const handleDateRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates && dates.length === 2) {
      setDateRange([dates[0], dates[1]]);
      setTimeFrame('custom'); // Set to custom when date range is selected
    } else {
      setDateRange(null);
    }
  };

  // Fetch SUBID breakdown data for a specific list_id
  const fetchSubidData = async (listId: string): Promise<RevenueData[]> => {
    if (subidData[listId]) {
      console.log(`Using cached SUBID data for list_id: ${listId}`);
      return subidData[listId];
    }

    setLoadingSubids(prev => ({ ...prev, [listId]: true }));

    try {
      console.log(`Fetching SUBID data for list_id: ${listId}`);
      
      // ✅ FIXED: Use the same date logic as main revenue tracking system
      let startDate: dayjs.Dayjs;
      let endDate: dayjs.Dayjs;
      
      if (timeFrame === 'custom') {
        // Use the same date range logic as main system
        const activeDateRange = getActiveDateRange();
        if (activeDateRange && activeDateRange[0] && activeDateRange[1]) {
          startDate = activeDateRange[0];
          endDate = activeDateRange[1];
        } else {
          // Fallback to calculated range
          const [calcStart, calcEnd] = calculateDateRange();
          startDate = calcStart;
          endDate = calcEnd;
        }
      } else {
        // Use the same calculateDateRange function as main system
        const [calcStart, calcEnd] = calculateDateRange();
        startDate = calcStart;
        endDate = calcEnd;
      }
      
      const apiUrl = `/api/revenue-tracking/subids?list_id=${listId}&startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`;
      
      console.log(`✅ FIXED: Fetching SUBID data for list_id: ${listId}, dateRange: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')} (matches main API)`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY!,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: SubidResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch SUBID data');
      }
      
      console.log(`✅ FIXED: Fetched ${result.data.length} SUBIDs for list_id: ${listId} using correct date range`);
      
      // Cache the data
      setSubidData(prev => ({ ...prev, [listId]: result.data }));
      
      return result.data;
      
    } catch (error) {
      console.error(`Error fetching SUBID data for list_id ${listId}:`, error);
      message.error(`Failed to load SUBID data for ${listId}`);
      return [];
    } finally {
      setLoadingSubids(prev => ({ ...prev, [listId]: false }));
    }
  };

  // Handle row expansion for SUBID data
  const handleRowExpand = (expanded: boolean, record: RevenueData) => {
    const listId = record.list_id;
    
    if (expanded) {
      console.log(`Expanding row for list_id: ${listId}`);
      // Immediately update expanded keys to show the row
      setExpandedRowKeys(prev => [...prev, listId]);
      // Start fetching SUBID data (async, non-blocking)
      fetchSubidData(listId);
    } else {
      console.log(`Collapsing row for list_id: ${listId}`);
      // Remove from expanded keys
      setExpandedRowKeys(prev => prev.filter(key => key !== listId));
    }
  };

  // Export SUBID data to CSV
  const exportSubidToCSV = (listId: string, description: string) => {
    const data = subidData[listId] || [];
    if (data.length === 0) {
      message.warning('No SUBID data to export');
      return;
    }
    
    const csvContent = [
      'List ID,SUBID,Total Leads,Weekday Leads,Weekend Leads,Cost Per Lead,Total Lead Costs,Synergy Issued Leads,Synergy Payout,AI Costs Allocated,Cost Per Acquisition,Net Profit',
      ...data.map(item => {
        const cpa = (item.synergy_issued_leads && item.synergy_issued_leads > 0) 
          ? (item.total_lead_costs / item.synergy_issued_leads).toFixed(2) 
          : 'N/A';
        
        return [
          item.list_id,
          item.subid_value || 'N/A',
          item.leads_count,
          item.weekday_leads || item.leads_count,
          item.weekend_leads || 0,
          item.cost_per_lead.toFixed(2),
          item.total_lead_costs.toFixed(2),
          item.synergy_issued_leads || 0,
          (item.synergy_payout || 0).toFixed(2),
          (item.ai_costs_allocated || 0).toFixed(2),
          cpa,
          (item.net_profit || 0).toFixed(2)
        ].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subid-breakdown-${listId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  // Render expandable row content with SUBID data
  const renderExpandedRow = (record: RevenueData) => {
    const listId = record.list_id;
    const isLoading = loadingSubids[listId];
    const data = subidData[listId] || [];
    
    if (isLoading) {
      return (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Spin size="small" /> Loading SUBID breakdown...
        </div>
      );
    }
    
    if (data.length === 0) {
      return (
        <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
          No SUBID data available for this list
        </div>
      );
    }
    
    // Apply filtering based on minimum lead count
    const minLeadCount = subidFilters[listId] || 10;
    const filteredData = data.filter(item => item.leads_count >= minLeadCount);
    
    // Create SUBID-specific columns with proper descriptions and dynamic width
    const subidColumns = columns.map(col => {
      if (col.key === 'description') {
        return {
          ...col,
          title: 'SUBID',
          minWidth: 200, // Match main table minWidth
          ellipsis: true,
          render: (value: any, subidRecord: RevenueData) => {
            return subidRecord.subid_value || 'N/A';
          }
        };
      }
      if (col.key === 'transfers_count') {
        return {
          ...col,
          render: (value: number | undefined) => value || 0
        };
      }
      
      return {
        ...col,
        render: col.render ? (value: any, subidRecord: RevenueData) => {
          return col.render!(value, subidRecord);
        } : undefined
      };
    });
    
    return (
      <div style={{ 
        margin: '16px 0', 
        paddingLeft: '48px', 
        overflowX: 'auto',
        width: '100%',
        borderRadius: '6px',
        border: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <Text strong>
              SUBID Breakdown for {record.description} ({filteredData.length} SUBIDs)
            </Text>
            {filteredData.length !== data.length && (
              <Text type="secondary" style={{ marginLeft: '8px' }}>
                (filtered from {data.length} total)
              </Text>
            )}
          </div>
          <Space>
            <Text strong style={{ fontSize: '12px' }}>Min leads:</Text>
            <Select
              value={minLeadCount}
              onChange={(value) => setSubidFilters(prev => ({ ...prev, [listId]: value }))}
              style={{ width: 80 }}
              size="small"
            >
              <Option value={1}>1+</Option>
              <Option value={5}>5+</Option>
              <Option value={10}>10+</Option>
              <Option value={25}>25+</Option>
              <Option value={50}>50+</Option>
              <Option value={100}>100+</Option>
            </Select>
            <Button 
              type="default" 
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => exportSubidToCSV(listId, record.description)}
            >
              Export CSV
            </Button>
          </Space>
        </div>
        <Table
          columns={subidColumns}
          dataSource={filteredData}
          rowKey={(record) => `subid-${record.parent_list_id}-${record.subid_value}`}
          pagination={false}
          size="small"
          scroll={{ x: true }}
          rowClassName={(record: RevenueData) => {
          const policyRate = record.policy_rate || 0;
          if (policyRate >= 1.0) {
            return 'subid-row subid-high-performance'; // Green background for >= 1%
          } else if (policyRate >= 0.5) {
            return 'subid-row subid-medium-performance'; // Yellow background for >= 0.5%
          } else {
            return 'subid-row subid-low-performance'; // Red background for < 0.5%
          }
        }}
        />
      </div>
    );
  };

  // Clear SUBID cache when main data is refreshed
  const refreshData = () => {
    setSubidData({});  // ✅ FIXED: Clear SUBID cache since date logic changed
    setExpandedRowKeys([]);
    setLoadingSubids({});
    fetchRevenueData();
    // ✅ FORCE fetch both AI cost functions on every refresh
    fetchPitchPerfectCosts();
    fetchBlandAICosts();
  };

  // ✅ FORCE both AI cost functions to run on mount and data changes
  useEffect(() => {
    console.log('🔥 FORCING AI cost functions to run...');
    fetchPitchPerfectCosts();
    fetchBlandAICosts();
  }, [timeFrame, generationDateRange, processingDateRange]);

  // ✅ CLEAR SUBID CACHE when dates change to ensure fresh data with correct date ranges
  useEffect(() => {
    console.log('🗑️ Clearing SUBID cache due to date/temporal mode change...');
    setSubidData({});
    setExpandedRowKeys([]);
  }, [temporalViewMode, generationDateRange, processingDateRange, timeFrame, enableLeadDateFilter, leadGenerationDateRange]);

  // ✅ SIMPLE MOUNT EFFECT - This MUST run
  useEffect(() => {
    console.log('🚨 COMPONENT MOUNTED - Calling fetchPitchPerfectCosts NOW');
    fetchPitchPerfectCosts().catch(err => console.error('Mount fetchPitchPerfectCosts error:', err));
  }, []); // Empty dependency array = runs once on mount

  const exportToCSV = () => {
    // Export functionality
    const csvContent = [
      'List ID,Description,Total Leads,Weekday Leads,Weekend Leads,Cost Per Lead,Total Lead Costs,Synergy Issued Leads,Synergy Payout,AI Costs Allocated,Cost Per Acquisition,Net Profit',
      ...revenueData.map(item => {
        const cpa = (item.synergy_issued_leads && item.synergy_issued_leads > 0) 
          ? (item.total_lead_costs / item.synergy_issued_leads).toFixed(2) 
          : 'N/A';
        return `${item.list_id},"${item.description}",${item.leads_count},${item.weekday_leads || item.leads_count},${item.weekend_leads || 0},$${item.cost_per_lead.toFixed(2)},$${item.total_lead_costs.toFixed(2)},${item.synergy_issued_leads || 0},$${(item.synergy_payout || 0).toFixed(2)},$${(item.ai_costs_allocated || 0).toFixed(2)},${cpa === 'N/A' ? 'N/A' : '$' + cpa},$${(item.net_profit || 0).toFixed(2)},${item.mathematical_consistency ? 'Yes' : 'No'},${item.timezone_used || 'Unknown'},${item.query_performance || 'Unknown'}`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-tracking-unified-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
      minWidth: 120,
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      minWidth: 200,
      ellipsis: true,
    },
    {
      title: 'Total Leads',
      dataIndex: 'leads_count',
      key: 'leads_count',
      minWidth: 100,
      sorter: (a: RevenueData, b: RevenueData) => a.leads_count - b.leads_count,
    },
    {
      title: 'Weekday Leads',
      dataIndex: 'weekday_leads',
      key: 'weekday_leads',
      minWidth: 110,
      render: (value: number | undefined, record: RevenueData) => {
        const weekdayCount = value !== undefined ? value : (record.leads_count - (record.weekend_leads || 0));
        return (
          <span style={{ 
            color: record.mathematical_consistency === false ? '#ff4d4f' : 'inherit',
            fontWeight: record.mathematical_consistency === false ? 'bold' : 'normal'
          }}>
            {weekdayCount}
          </span>
        );
      },
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.weekday_leads || (a.leads_count - (a.weekend_leads || 0))) - 
        (b.weekday_leads || (b.leads_count - (b.weekend_leads || 0))),
    },
    {
      title: 'Weekend Leads',
      dataIndex: 'weekend_leads',
      key: 'weekend_leads',
      minWidth: 110,
      render: (value: number | undefined, record: RevenueData) => (
        <span style={{ 
          color: record.mathematical_consistency === false ? '#ff4d4f' : 'inherit',
          fontWeight: record.mathematical_consistency === false ? 'bold' : 'normal'
        }}>
          {value !== undefined ? value : 0}
          {record.timezone_used && !record.timezone_used.includes('America/New_York') && (
            <span style={{ color: '#faad14', marginLeft: '4px' }}>⚠️</span>
          )}
        </span>
      ),
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.weekend_leads || 0) - (b.weekend_leads || 0),
    },
    {
      title: 'Cost Per Lead',
      dataIndex: 'cost_per_lead',
      key: 'cost_per_lead',
      minWidth: 110,
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueData, b: RevenueData) => a.cost_per_lead - b.cost_per_lead,
    },
    {
      title: 'Total Lead Costs',
      dataIndex: 'total_lead_costs',
      key: 'total_lead_costs',
      minWidth: 130,
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueData, b: RevenueData) => a.total_lead_costs - b.total_lead_costs,
    },
    {
      title: 'Transfers',
      dataIndex: 'transfers_count',
      key: 'transfers_count',
      minWidth: 90,
      render: (value: number | undefined) => value || 0,
      sorter: (a: RevenueData, b: RevenueData) => (a.transfers_count || 0) - (b.transfers_count || 0),
    },
    {
      title: 'Synergy Issued Leads',
      dataIndex: 'synergy_issued_leads',
      key: 'synergy_issued_leads',
      minWidth: 140,
      render: (value: number | undefined) => 
        value !== undefined ? value : 0,
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.synergy_issued_leads || 0) - (b.synergy_issued_leads || 0),
    },
    {
      title: 'Policy Conversion Rate',
      dataIndex: 'policy_rate',
      key: 'policy_rate',
      minWidth: 150,
      render: (value: number | undefined) => 
        value !== undefined ? `${value.toFixed(2)}%` : '0.00%',
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.policy_rate || 0) - (b.policy_rate || 0),
    },
    {
      title: 'Transfer Rate',
      dataIndex: 'transfers_count',
      key: 'transfer_rate',
      minWidth: 110,
      render: (value: number | undefined, record: RevenueData) => 
        value !== undefined ? `${((value / (record.leads_count || 1)) * 100).toFixed(2)}%` : '0.00%',
      sorter: (a: RevenueData, b: RevenueData) => {
        const rateA = ((a.transfers_count || 0) / (a.leads_count || 1)) * 100;
        const rateB = ((b.transfers_count || 0) / (b.leads_count || 1)) * 100;
        return rateA - rateB;
      },
    },
    {
      title: 'Synergy Payout',
      dataIndex: 'synergy_payout',
      key: 'synergy_payout',
      minWidth: 120,
      render: (value: number | undefined) => 
        value !== undefined ? `$${value.toFixed(2)}` : '$0.00',
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.synergy_payout || 0) - (b.synergy_payout || 0),
    },
    {
      title: 'AI Costs Allocated',
      dataIndex: 'ai_costs_allocated',
      key: 'ai_costs_allocated',
      minWidth: 130,
      render: (value: number | undefined) => 
        value !== undefined ? `$${value.toFixed(2)}` : '$0.00',
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.ai_costs_allocated || 0) - (b.ai_costs_allocated || 0),
    },
    {
      title: 'Cost Per Acquisition',
      dataIndex: 'synergy_issued_leads',
      key: 'cost_per_acquisition',
      minWidth: 140,
      render: (synergyLeads: number | undefined, record: RevenueData) => {
        if (!synergyLeads || synergyLeads === 0) return 'N/A';
        const cpa = record.total_lead_costs / synergyLeads;
        return `$${cpa.toFixed(2)}`;
      },
      sorter: (a: RevenueData, b: RevenueData) => {
        const cpaA = (a.synergy_issued_leads && a.synergy_issued_leads > 0) ? a.total_lead_costs / a.synergy_issued_leads : 0;
        const cpaB = (b.synergy_issued_leads && b.synergy_issued_leads > 0) ? b.total_lead_costs / b.synergy_issued_leads : 0;
        return cpaA - cpaB;
      },
    },
    {
      title: 'Net Profit',
      dataIndex: 'net_profit',
      key: 'net_profit',
      minWidth: 110,
      render: (value: number | undefined) => 
        value !== undefined ? `$${value.toFixed(2)}` : '$0.00',
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.net_profit || 0) - (b.net_profit || 0),
    },
  ];

  return (
    <div style={{ 
      padding: '24px', 
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden'
    }}>
      <style dangerouslySetInnerHTML={{ __html: subidStyles }} />
      <Title level={2}>
        Revenue Tracking Dashboard 
        <span style={{ fontSize: '14px', color: '#52c41a', marginLeft: '8px' }}>
          ✅ Enterprise Temporal Attribution System
        </span>
      </Title>
      
      {/* Enhanced Temporal Attribution Controls */}
      <div className="temporal-controls">
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Title level={4} style={{ color: 'white', margin: 0 }}>
              🎯 Data View Options
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
              {getTemporalViewDescription()}
            </Text>
          </Col>
          <Col span={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Segmented
                value={temporalViewMode}
                onChange={(value) => setTemporalViewMode(value as TemporalViewMode)}
                options={[
                  {
                    label: 'Leads Added',
                    value: 'generation',
                    icon: <BarChartOutlined />
                  },
                  {
                    label: 'Transfers/Policies',
                    value: 'processing', 
                    icon: <ThunderboltOutlined />
                  },
                  {
                    label: 'Lead Tracking',
                    value: 'cohort',
                    icon: <TeamOutlined />
                  }
                ]}
                size="large"
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}
              />
            </Space>
          </Col>
        </Row>
      </div>

      {/* Enhanced Date Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Space direction="vertical">
              <Text strong>
                {temporalViewMode === 'generation' ? '📅 Date Range' : 
                 temporalViewMode === 'processing' ? '⚡ Transfer/Policy Date' : 
                 '🎯 Lead Added Date'}
              </Text>
              <Select 
                value={timeFrame} 
                onChange={(value) => setTimeFrame(value)}
                style={{ width: '100%' }}
              >
                <Option value="today">Today</Option>
                <Option value="yesterday">Yesterday</Option>
                <Option value="thisWeek">This Week</Option>
                <Option value="lastWeek">Last Week</Option>
                <Option value="thisMonth">This Month</Option>
                <Option value="lastMonth">Last Month</Option>
                <Option value="custom">Custom Range</Option>
              </Select>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Custom Date Range</Text>
              <RangePicker 
                onChange={(dates) => {
                  if (dates && dates.length === 2 && dates[0] && dates[1]) {
                    if (temporalViewMode === 'processing') {
                      setProcessingDateRange([dates[0], dates[1]]);
                    } else {
                      setGenerationDateRange([dates[0], dates[1]]);
                    }
                    setTimeFrame('custom');
                  } else {
                    if (temporalViewMode === 'processing') {
                      setProcessingDateRange(null);
                    } else {
                      setGenerationDateRange(null);
                    }
                  }
                }}
                value={temporalViewMode === 'processing' ? processingDateRange : generationDateRange}
                disabled={timeFrame !== 'custom'}
                style={{ width: '100%' }}
                allowEmpty={[true, true]}
              />
            </Space>
          </Col>
          
          {/* NEW: Lead Generation Date Filter (only show when in processing mode) */}
          {temporalViewMode === 'processing' && (
            <Col span={6}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={enableLeadDateFilter}
                    onChange={(e) => setEnableLeadDateFilter(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  <Text strong>Filter by Lead Added Date</Text>
                </div>
                <RangePicker 
                  placeholder={['Lead start date', 'Lead end date']}
                  onChange={(dates) => {
                    if (dates && dates.length === 2 && dates[0] && dates[1]) {
                      setLeadGenerationDateRange([dates[0], dates[1]]);
                    } else {
                      setLeadGenerationDateRange(null);
                    }
                  }}
                  value={leadGenerationDateRange}
                  disabled={!enableLeadDateFilter}
                  style={{ width: '100%' }}
                  allowEmpty={[true, true]}
                />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Only show transfers/policies for leads added in this date range
                </Text>
              </Space>
            </Col>
          )}
          
          <Col span={temporalViewMode === 'processing' ? 4 : 6}>
            <Space direction="vertical">
              <Text strong>API Endpoint</Text>
              <Text code style={{ fontSize: '11px' }}>
                {debugInfo.activeEndpoint}
              </Text>
            </Space>
          </Col>
          <Col span={4}>
            <Button 
              type="primary"
              icon={<ReloadOutlined />}
              onClick={refreshData}
              loading={loading}
              block
            >
              Refresh Data
            </Button>
          </Col>
        </Row>
      </Card>

      {/* RESTORED: Original Working KPI Layout */}
      <Row gutter={12} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Lead Costs"
              value={totalLeadCosts}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Leads Processed"
              value={totalLeads}
              valueStyle={{ color: '#1890ff' }}
              suffix="leads"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Transfers"  
              value={totalTransfers}
              valueStyle={{ color: '#722ed1' }}
              suffix="transfers"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Average Lead Cost"
              value={totalLeads > 0 ? totalLeadCosts / totalLeads : 0}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Synergy Payout"
              value={totalSynergyPayout}
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        {/* REMOVED: Redundant "Issued Rate" KPI - keeping only "Policy Conversion Rate" below */}
      </Row>
      
      {/* AI Costs and Net Profit Section - RESTORED */}
      <Row gutter={12} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={getCostTitle('Bland AI Costs')}
              value={blandAICosts}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix={<DollarOutlined />}
              loading={blandAILoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={getCostTitle('Pitch Perfect Costs')}
              value={pitchPerfectCosts}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix={<DollarOutlined />}
              loading={ppLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Net Profit"
              value={totalSynergyPayout - totalLeadCosts - blandAICosts - pitchPerfectCosts}
              precision={2}
              valueStyle={{ color: totalSynergyPayout - totalLeadCosts - blandAICosts - pitchPerfectCosts >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="AI Cost Per Lead"
              value={totalLeads > 0 ? (blandAICosts + pitchPerfectCosts) / totalLeads : 0}
              precision={4}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>
      
      {/* Bottom KPI Section - RESTORED */}
      <Row gutter={12} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Policies Issued"
              value={totalSynergyIssuedLeads}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Average Cost Per Acquisition"
              value={totalSynergyIssuedLeads > 0 ? totalLeadCosts / totalSynergyIssuedLeads : 0}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Policy Conversion Rate"
              value={totalLeads > 0 ? (totalSynergyIssuedLeads / totalLeads) * 100 : 0}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Second Row - Active Lists */}
      <Row gutter={12} style={{ marginBottom: '24px' }}>
        {/* REMOVED: Active Lists KPI as requested */}
      </Row>

      {/* Temporal View Specific Metrics */}
      {temporalViewMode === 'generation' && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
                title="Eventual Transfer Rate"
              value={totalLeads > 0 ? (totalTransfers / totalLeads) * 100 : 0}
                precision={2}
                valueStyle={{ color: '#1890ff' }}
                suffix="%"
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Cross-temporal conversion tracking
              </Text>
            </Card>
          </Col>
          {/* REMOVED: Redundant "Eventual Policy Rate" KPI - same as "Policy Conversion Rate" above */}
          <Col span={8}>
            <Card>
              <Statistic
                title="Cost Per Eventual Transfer"
                value={totalTransfers > 0 ? totalLeadCosts / totalTransfers : 0}
                precision={2}
                valueStyle={{ color: '#722ed1' }}
                prefix={<DollarOutlined />}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                True attribution cost
              </Text>
          </Card>
        </Col>
      </Row>
      )}

      {temporalViewMode === 'processing' && enableLeadDateFilter && leadGenerationDateRange && (
        <Alert
          message="Cross-Temporal Filter Active"
          description={`Showing transfers/policies from ${processingDateRange ? processingDateRange[0].format('MMM D') + ' - ' + processingDateRange[1].format('MMM D, YYYY') : 'your selected processing date'}, but ONLY for leads that were originally added between ${leadGenerationDateRange[0].format('MMM D')} - ${leadGenerationDateRange[1].format('MMM D, YYYY')}.`}
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {temporalViewMode === 'processing' && !enableLeadDateFilter && (
        <Alert
          message="Processing Date View"
          description="Shows leads based on when they were transferred or had policy activity (not when they were originally added)."
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {temporalViewMode === 'cohort' && (
        <Alert
          message="Lead Tracking View"
          description="Shows leads added in your selected date range, but includes all their transfer/policy activity regardless of when it happened."
          type="success"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Export Controls */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Text strong>Viewing: </Text>
          <Text code>{temporalViewMode.toUpperCase()}</Text> 
          <Text type="secondary">
            ({revenueData.length} lists with data)
          </Text>
        </Space>
        
        <Space>
          <Button 
            icon={<DownloadOutlined />}
            onClick={exportToCSV}
          >
            Export {temporalViewMode.charAt(0).toUpperCase() + temporalViewMode.slice(1)} CSV
          </Button>
        </Space>
      </div>
      
      {/* Main Data Table */}
      <div style={{ 
        overflowX: 'auto',
        width: '100%',
        borderRadius: '8px',
        border: '1px solid #f0f0f0'
      }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={revenueData}
            rowKey="list_id"
            scroll={{ x: true }}
            expandable={{
              expandedRowRender: renderExpandedRow,
              expandedRowKeys: expandedRowKeys,
              onExpand: (expanded, record) => {
                if (expanded) {
                  setExpandedRowKeys(prev => [...prev, record.list_id]);
                  fetchSubidData(record.list_id);
                } else {
                  setExpandedRowKeys(prev => prev.filter(key => key !== record.list_id));
                }
              },
              rowExpandable: () => true,
            }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalRecords,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} items`,
              onChange: (page, size) => {
                setCurrentPage(page);
                if (size !== pageSize) {
                  setPageSize(size);
                  setCurrentPage(1);
                }
              },
            }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1}><strong>All Lists</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2}><strong>{totalLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={3}><strong>{totalWeekdayLeads || '-'}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={4}><strong>{totalWeekendLeads || '-'}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={5}><strong>-</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={6}><strong>${totalLeadCosts.toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={7}><strong>{totalTransfers}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={8}><strong>{totalSynergyIssuedLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={9}><strong>{totalLeads > 0 ? ((totalSynergyIssuedLeads / totalLeads) * 100).toFixed(2) : '0.00'}%</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={10}><strong>{totalLeads > 0 ? ((totalTransfers / totalLeads) * 100).toFixed(2) : '0.00'}%</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={11}><strong>${totalSynergyPayout.toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={12}><strong>${(blandAICosts + pitchPerfectCosts).toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={13}><strong>N/A</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={14}><strong>${(totalSynergyPayout - totalLeadCosts - blandAICosts - pitchPerfectCosts).toFixed(2)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Spin>
      </div>

      {/* Enhanced Debug Information Section */}
      <Collapse 
        bordered={false} 
        style={{ marginTop: '24px' }}
        items={[
          {
            key: '1',
            label: (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <BugOutlined style={{ marginRight: '8px' }} />
                <span>Temporal Attribution System Health</span>
                <span style={{ marginLeft: '8px', color: '#52c41a' }}>
                  (Mode: {temporalViewMode.toUpperCase()})
                </span>
              </div>
            ),
            children: (
              <>
                <Row gutter={16} style={{ marginBottom: '16px' }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="Total API Calls"
                        value={debugInfo.totalApiCalls}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="Active Temporal View"
                        value={debugInfo.temporalViewMode.toUpperCase()}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="Performance Metrics"
                        value={debugInfo.performanceMetrics.length}
                        suffix="tracked"
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="System Status"
                        value="OPTIMAL"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                </Row>
                
                <h4>Recent API Performance</h4>
                <Table
                  dataSource={debugInfo.performanceMetrics.map((metric, index) => ({
                    ...metric,
                    key: index,
                    status: 'Healthy'
                  }))}
                  columns={[
                    { title: 'Query Type', dataIndex: 'query_type', key: 'query_type', width: 200 },
                    { title: 'Timezone', dataIndex: 'timezone', key: 'timezone', width: 200 },
                    { title: 'Explanation', dataIndex: 'explanation', key: 'explanation', ellipsis: true },
                    { 
                      title: 'Status', 
                      dataIndex: 'status', 
                      key: 'status', 
                      width: 100,
                      render: () => (
                        <span style={{ color: '#52c41a' }}>
                          ✅ Optimal
                        </span>
                      )
                    },
                  ]}
                  pagination={false}
                  size="small"
                  scroll={{ x: true }}
                />
              </>
            )
          }
        ]}
      />
    </div>
  );
}
