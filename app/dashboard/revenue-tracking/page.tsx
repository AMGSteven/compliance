'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Card, Table, Typography, DatePicker, Button, Select, Space, Statistic, Row, Col, Spin, message } from 'antd';
import { DollarOutlined, DownloadOutlined, FilterOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { createClient } from '@supabase/supabase-js';

// Note: Backend API uses EST timezone (-05:00) for date filtering

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

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
`;

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
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [timeFrame, setTimeFrame] = useState<string>('today');
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

  // Helper function to generate dynamic cost titles based on timeFrame
  const getCostTitle = (baseName: string) => {
    if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].format('MMM D');
      const endDate = dateRange[1].format('MMM D, YYYY');
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

  useEffect(() => {
    refreshData();
  }, [dateRange, timeFrame]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      
      // Step 1: Fetch list routings to get cost per lead data
      console.log('Fetching list routings...');
      const routingsResponse = await fetch('/api/list-routings?active=true', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const routingsResult = await routingsResponse.json();
      
      if (!routingsResult.success) {
        throw new Error('Failed to fetch list routings: ' + routingsResult.error);
      }
      
      // Create a map of list_id to routing info
      const routingMap: Record<string, ListRouting> = {};
      routingsResult.data.forEach((routing: ListRouting) => {
        if (routing.active && routing.bid > 0) {
          routingMap[routing.list_id] = routing;
        }
      });
      
      console.log('Loaded routings for list IDs:', Object.keys(routingMap));
      
      // Step 2: Get accurate lead counts per List ID efficiently (scalable to millions of leads)
      console.log('Getting lead counts per List ID using efficient pagination approach...');
      
      // Step 3: Initialize revenue data for ALL active list routings (even those with 0 leads)
      const revenueByListId: Record<string, RevenueData> = {};
      
      // Initialize all active list routings with 0 leads
      Object.keys(routingMap).forEach(listId => {
        const routing = routingMap[listId];
        revenueByListId[listId] = {
          key: listId,
          list_id: listId,
          description: routing.description || listId,
          leads_count: 0,
          cost_per_lead: routing.bid,
          total_lead_costs: 0
        };
      });
      
      // For each List ID, get the total count efficiently using pagination
      const leadCountPromises = Object.keys(routingMap).map(async (listId) => {
        try {
          // Create URL to get lead count for this specific list_id
          const countUrl = new URL('/api/leads/list', window.location.origin);
          countUrl.searchParams.append('pageSize', '1'); // Only need 1 lead to get total count
          countUrl.searchParams.append('page', '1');
          countUrl.searchParams.append('list_id', listId); // Filter by exact list_id
          
          // Apply date filtering if active
          if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
            countUrl.searchParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
            countUrl.searchParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
          } else {
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
            
            countUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
            countUrl.searchParams.append('endDate', endDate.format('YYYY-MM-DD'));
          }
          
          const response = await fetch(countUrl.toString(), {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
          });
          
          const result = await response.json();
          
          if (result.success && result.pagination) {
            // The pagination.total gives us the exact count for this list_id
            const totalLeadsForList = result.pagination.total;
            console.log(`List ID ${listId}: ${totalLeadsForList} leads`);
            return { listId, count: totalLeadsForList };
          } else {
            console.error(`Failed to get lead count for List ID ${listId}:`, result.error);
            return { listId, count: 0 };
          }
        } catch (error) {
          console.error(`Error getting lead count for List ID ${listId}:`, error);
          return { listId, count: 0 };
        }
      });
      
      // Wait for all lead count requests to complete
      const leadCounts = await Promise.all(leadCountPromises);
      
      console.log('Lead counts per List ID:', leadCounts);
      
      // Update revenue data with actual lead counts
      leadCounts.forEach(({ listId, count }) => {
        if (revenueByListId[listId]) {
          revenueByListId[listId].leads_count = count;
          revenueByListId[listId].total_lead_costs = count * revenueByListId[listId].cost_per_lead;
        }
      });
      
      // Now we need to get exact weekend lead counts from database (no sampling!)
      // Weekend leads (Saturday/Sunday) should have $0 payout
      console.log('Getting exact weekend lead counts from database...');
      
      const weekendLeadPromises = Object.keys(routingMap).map(async (listId) => {
        try {
          // Create URL to get EXACT weekend lead count for this specific list_id
          const weekendUrl = new URL('/api/leads/list', window.location.origin);
          weekendUrl.searchParams.append('pageSize', '1'); // Only need 1 lead to get total count
          weekendUrl.searchParams.append('page', '1');
          weekendUrl.searchParams.append('list_id', listId); // Filter by exact list_id
          weekendUrl.searchParams.append('weekend_only', 'true'); // NEW: Filter for weekend leads only
          
          // Apply EXACT same date filtering logic as lead count query
          if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
            weekendUrl.searchParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
            weekendUrl.searchParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
          } else {
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
            
            weekendUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
            weekendUrl.searchParams.append('endDate', endDate.format('YYYY-MM-DD'));
          }
          // For 'all' time frame: NO date filters - same as lead count query
          
          console.log(`Weekend count for ${listId} (${timeFrame}): ${weekendUrl.toString()}`);
          
          const response = await fetch(weekendUrl.toString(), {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
          });
          
          const result = await response.json();
          
          if (result.success && result.pagination) {
            // The pagination.total gives us the EXACT count of weekend leads for this list_id
            const weekendCount = result.pagination.total;
            const totalLeads = revenueByListId[listId]?.leads_count || 0;
            
            console.log(`${listId}: ${weekendCount} weekend leads out of ${totalLeads} total leads (exact count from database)`);
            
            return { listId, weekendCount };
          } else {
            console.error(`Failed to get weekend count for List ID ${listId}:`, result.error);
            return { listId, weekendCount: 0 };
          }
          
        } catch (error) {
          console.error(`Error getting weekend count for List ID ${listId}:`, error);
          return { listId, weekendCount: 0 };
        }
      });
      
      const weekendCounts = await Promise.all(weekendLeadPromises);
      
      // Update revenue data to exclude weekend leads
      weekendCounts.forEach(({ listId, weekendCount }) => {
        if (revenueByListId[listId]) {
          const totalLeads = revenueByListId[listId].leads_count;
          const weekdayLeads = totalLeads - weekendCount;
          
          // Update total_lead_costs to include all leads (weekdays + weekends)
          revenueByListId[listId].total_lead_costs = totalLeads * revenueByListId[listId].cost_per_lead;
          
          // Add weekend info for display
          revenueByListId[listId].weekend_leads = weekendCount;
          revenueByListId[listId].weekday_leads = weekdayLeads;
          
          console.log(`List ${listId}: ${totalLeads} total leads, ${weekendCount} weekend (excluded), ${weekdayLeads} weekday leads contributing to revenue`);
        }
      });
      
      // Now we need to get issued lead counts for synergy payout from ALL list IDs
      console.log('Calculating issued leads for synergy payout from ALL list IDs...');
      
      // First get all unique list IDs that have issued policies today
      const allListIdsUrl = new URL('/api/leads/list', window.location.origin);
      allListIdsUrl.searchParams.append('pageSize', '1000'); // Get enough to see all list IDs
      allListIdsUrl.searchParams.append('policy_status', 'issued');
      allListIdsUrl.searchParams.append('use_postback_date', 'true');
      
      // Add same date filtering
      if (dateRange && dateRange.length === 2) {
        allListIdsUrl.searchParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
        allListIdsUrl.searchParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
      } else {
        // Default date range logic for synergy calculation
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
        allListIdsUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
        allListIdsUrl.searchParams.append('endDate', endDate.format('YYYY-MM-DD'));
      }
      
      const allListIdsResponse = await fetch(allListIdsUrl.toString(), {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const allListIdsResult = await allListIdsResponse.json();
      
      // Get unique list IDs from issued policies
      const allListIdsWithPolicies = new Set<string>();
      if (allListIdsResult.success && allListIdsResult.data) {
        allListIdsResult.data.forEach((lead: any) => {
          if (lead.list_id) {
            allListIdsWithPolicies.add(lead.list_id);
          }
        });
      }
      
      console.log('List IDs with issued policies:', Array.from(allListIdsWithPolicies));
      
      const issuedLeadPromises = Array.from(allListIdsWithPolicies).map(async (listId) => {
        try {
          // Get issued lead count for this list using pagination total
          const issuedUrl = new URL('/api/leads/list', window.location.origin);
          issuedUrl.searchParams.append('pageSize', '1'); // We only need the pagination total
          issuedUrl.searchParams.append('list_id', listId);
          issuedUrl.searchParams.append('policy_status', 'issued');
          issuedUrl.searchParams.append('use_postback_date', 'true'); // Use postback date for revenue attribution

          // Add date filtering based on the selected range
          if (dateRange && dateRange.length === 2) {
            issuedUrl.searchParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
            issuedUrl.searchParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
          } else {
            // Default date range logic for synergy calculation
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
            issuedUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
            issuedUrl.searchParams.append('endDate', endDate.format('YYYY-MM-DD'));
          }
          
          const response = await fetch(issuedUrl.toString(), {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
          });
          
          const result = await response.json();
          
          if (result.success && result.pagination) {
            // Use pagination.total for exact count of issued leads
            const issuedCount = result.pagination.total;
            console.log(`List ${listId}: ${issuedCount} issued leads`);
            return { listId, issuedCount };
          } else {
            return { listId, issuedCount: 0 };
          }
          
        } catch (error) {
          console.error(`Error counting issued leads for List ID ${listId}:`, error);
          return { listId, issuedCount: 0 };
        }
      });
      
      const issuedCounts = await Promise.all(issuedLeadPromises);
      
      // Update revenue data with issued lead counts for synergy payout
      issuedCounts.forEach(({ listId, issuedCount }) => {
        if (revenueByListId[listId]) {
          // List ID has active routing
          revenueByListId[listId].synergy_issued_leads = issuedCount;
          revenueByListId[listId].synergy_payout = issuedCount * 120;
        } else {
          // List ID has no active routing but has issued policies - create entry for payout only
          revenueByListId[listId] = {
            key: listId,
            list_id: listId,
            description: `List ${listId} (No Active Routing)`,
            leads_count: 0,
            cost_per_lead: 0,
            total_lead_costs: 0,
            weekend_leads: 0,
            weekday_leads: 0,
            synergy_issued_leads: issuedCount,
            synergy_payout: issuedCount * 120,
            ai_costs_allocated: 0,
            net_profit: issuedCount * 120 // Pure profit since no lead costs
          };
          console.log(`Created payout entry for inactive list ${listId}: ${issuedCount} policies = $${issuedCount * 120}`);
        }
      });
      
      // Get all unique list IDs for transfer counting (reuse allListIdsWithPolicies + active ones)
      const allListIdsForTransfers = new Set([...Object.keys(routingMap), ...allListIdsWithPolicies]);
      
      const transferPromises = Array.from(allListIdsForTransfers).map(async (listId) => {
        try {
          const transferUrl = new URL('/api/leads/list', window.location.origin);
          transferUrl.searchParams.append('pageSize', '1');
          transferUrl.searchParams.append('list_id', listId);
          transferUrl.searchParams.append('transfer_status', 'true');
          // Add date filtering (use transferred_at for accuracy)
          if (dateRange && dateRange.length === 2) {
            transferUrl.searchParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
            transferUrl.searchParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
          } else {
            // Same date logic as issued
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
            transferUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
            transferUrl.searchParams.append('endDate', endDate.format('YYYY-MM-DD'));
          }
          
          const response = await fetch(transferUrl.toString(), { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' } });
          const result = await response.json();
          
          if (result.success && result.pagination) {
            return { listId, transferCount: result.pagination.total };
          } else {
            return { listId, transferCount: 0 };
          }
        } catch (error) {
          console.error(`Error counting transfers for List ID ${listId}:`, error);
          return { listId, transferCount: 0 };
        }
      });
      
      const transferCounts = await Promise.all(transferPromises);
      
      // Update revenue data with transfer counts
      transferCounts.forEach(({ listId, transferCount }) => {
        if (revenueByListId[listId]) {
          revenueByListId[listId].transfers_count = transferCount;
        } else {
          revenueByListId[listId] = {
            key: listId,
            list_id: listId,
            description: `List ${listId} (No Active Routing)`,
            leads_count: 0,
            cost_per_lead: 0,
            total_lead_costs: 0,
            weekend_leads: 0,
            weekday_leads: 0,
            synergy_issued_leads: 0,
            synergy_payout: 0,
            ai_costs_allocated: 0,
            net_profit: 0,
            transfers_count: transferCount,
          };
        }
      });
      
      // Convert to array and sort by revenue
      const revenueArray = Object.values(revenueByListId)
        .sort((a, b) => b.total_lead_costs - a.total_lead_costs);
      
      // Calculate AI costs allocation and net profit for each list ID
      // Change allocation to use total leads (including weekends)
      const totalLeadsForAllocation = revenueArray.reduce((sum, item) => sum + item.leads_count, 0);
      
      revenueArray.forEach(item => {
        item.ai_costs_allocated = totalLeadsForAllocation > 0 
          ? (item.leads_count / totalLeadsForAllocation) * (blandAICosts + pitchPerfectCosts) // Allocate both Bland and PitchPerfect based on total leads
          : 0;
        
        // Calculate net profit: Synergy Payout - Lead Costs - AI Costs Allocated
        item.net_profit = (item.synergy_payout || 0) - item.total_lead_costs - item.ai_costs_allocated;
        
        // Calculate policy conversion rate: (synergy_issued_leads / leads_count) * 100
        item.policy_rate = item.leads_count > 0 
          ? ((item.synergy_issued_leads || 0) / item.leads_count) * 100 
          : 0;
      });
      
      setRevenueData(revenueArray);
      setTotalRecords(revenueArray.length);
      
      // Calculate totals
      const totalRev = revenueArray.reduce((sum, item) => sum + item.total_lead_costs, 0);
      const totalLeadsCount = revenueArray.reduce((sum, item) => sum + item.leads_count, 0);
      const totalWeekdayLeadsCount = revenueArray.reduce((sum, item) => sum + (item.weekday_leads || item.leads_count), 0);
      const totalWeekendLeadsCount = revenueArray.reduce((sum, item) => sum + (item.weekend_leads || 0), 0);
      const totalSynergyIssuedLeadsCount = revenueArray.reduce((sum, item) => sum + (item.synergy_issued_leads || 0), 0);
      const totalSynergyPayoutCount = revenueArray.reduce((sum, item) => sum + (item.synergy_payout || 0), 0);
      const totalTransfers = revenueArray.reduce((sum, item) => sum + (item.transfers_count || 0), 0);
      
      setTotalLeadCosts(totalRev);
      setTotalLeads(totalLeadsCount);
      setTotalWeekdayLeads(totalWeekdayLeadsCount);
      setTotalWeekendLeads(totalWeekendLeadsCount);
      setTotalSynergyIssuedLeads(totalSynergyIssuedLeadsCount);
      setTotalSynergyPayout(totalSynergyPayoutCount);
      setTotalTransfers(totalTransfers);
      
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
    
    // Fetch Bland AI costs asynchronously to not block dashboard loading
    fetchBlandAICosts();
    fetchPitchPerfectCosts();
  };



  const fetchBlandAICosts = async () => {
    setBlandAILoading(true);
      
    try {
      console.log('Fetching Bland AI costs using balance tracking...');

      // Build URL based on timeFrame (same logic as other cost functions)
      let costUrl = '/api/bland-ai-costs-simple';
      const params = new URLSearchParams();

      if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
        // Custom date range
        const startDate = dateRange[0].format('YYYY-MM-DD');
        const endDate = dateRange[1].format('YYYY-MM-DD');
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        console.log(`Using custom date range: ${startDate} to ${endDate}`);
      } else {
      // Predefined periods
      let period = 'today';
      if (timeFrame === 'yesterday') period = 'yesterday';
      else if (timeFrame === 'thisWeek' || timeFrame === 'lastWeek' || timeFrame === 'week') period = 'week';
      else if (timeFrame === 'thisMonth' || timeFrame === 'lastMonth' || timeFrame === 'month') period = 'month';
      else if (timeFrame === 'all') period = 'all';
      params.append('period', period);
      console.log(`Using predefined period: ${period} for timeFrame: ${timeFrame}`);
    }

      costUrl += '?' + params.toString();
      const response = await fetch(costUrl, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Balance-based costs for ${params.get('period') || 'custom'}: $${data.totalCost} (${data.totalRecords} records)`);
          console.log(`💰 Current balance: $${data.currentBalance}, Refill to: $${data.refillTo}`);
          setBlandAICosts(data.totalCost || 0);
        } else {
          console.warn('Balance API returned unsuccessful response:', data.error);
          setBlandAICosts(0);
        }
      } else {
        console.error('Balance API request failed:', response.status);
        setBlandAICosts(0);
      }
        
    } catch (error: unknown) {
      console.error('Error fetching Bland AI costs:', error);
      setBlandAICosts(0);
    } finally {
      setBlandAILoading(false);
    }
  };

  const fetchPitchPerfectCosts = async () => {
    setPpLoading(true);
      
    try {
      console.log('Fetching Pitch Perfect costs directly from database...');
      
      // Create Supabase client for direct database query
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Build date filter based on timeFrame (same logic as leads)
      let query = supabase
        .from('pitch_perfect_costs')
        .select('billable_cost')
        .eq('billable_status', 'billable');

      if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
        query = query
          .gte('created_at', dateRange[0].startOf('day').toISOString())
          .lte('created_at', dateRange[1].endOf('day').toISOString());
      } else {
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
        
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching Pitch Perfect costs:', error);
        setPitchPerfectCosts(0);
        return;
      }

      // Sum all billable costs
      const totalCosts = data?.reduce((sum, record) => sum + (record.billable_cost || 0), 0) || 0;
      
      console.log(`✅ Pitch Perfect costs for ${timeFrame}: $${totalCosts} (${data?.length || 0} records)`);
      setPitchPerfectCosts(totalCosts);
        
    } catch (error: unknown) {
      console.error('Error fetching Pitch Perfect costs:', error);
      setPitchPerfectCosts(0);
    } finally {
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
      
      // Build URL with same date filtering logic as main data - ALWAYS pass explicit dates
      let startDate: dayjs.Dayjs;
      let endDate: dayjs.Dayjs;
      
      if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
        startDate = dateRange[0];
        endDate = dateRange[1];
      } else {
        // Calculate dates for preset timeframes (matches main revenue API logic)
        switch (timeFrame) {
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
          default: // 'today'
            startDate = dayjs().startOf('day');
            endDate = dayjs().endOf('day');
        }
      }
      
      const apiUrl = `/api/revenue-tracking/subids?list_id=${listId}&startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`;
      
      console.log(`Fetching SUBID data for list_id: ${listId}, dateRange: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
      
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
      
      console.log(`Fetched ${result.data.length} SUBIDs for list_id: ${listId}`);
      
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
    setSubidData({});
    setExpandedRowKeys([]);
    setLoadingSubids({});
    fetchRevenueData();
  };

  const exportToCSV = () => {
    // Export functionality
    const csvContent = [
      'List ID,Description,Total Leads,Weekday Leads,Weekend Leads,Cost Per Lead,Total Lead Costs,Synergy Issued Leads,Synergy Payout,AI Costs Allocated,Cost Per Acquisition,Net Profit',
      ...revenueData.map(item => {
        const cpa = (item.synergy_issued_leads && item.synergy_issued_leads > 0) 
          ? (item.total_lead_costs / item.synergy_issued_leads).toFixed(2) 
          : 'N/A';
        return `${item.list_id},"${item.description}",${item.leads_count},${item.weekday_leads || item.leads_count},${item.weekend_leads || 0},$${item.cost_per_lead.toFixed(2)},$${item.total_lead_costs.toFixed(2)},${item.synergy_issued_leads || 0},$${(item.synergy_payout || 0).toFixed(2)},$${(item.ai_costs_allocated || 0).toFixed(2)},${cpa === 'N/A' ? 'N/A' : '$' + cpa},$${(item.net_profit || 0).toFixed(2)}`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-tracking-${new Date().toISOString().split('T')[0]}.csv`;
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
      render: (value: number | undefined, record: RevenueData) => 
        value !== undefined ? value : record.leads_count,
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.weekday_leads || a.leads_count) - (b.weekday_leads || b.leads_count),
    },
    {
      title: 'Weekend Leads',
      dataIndex: 'weekend_leads',
      key: 'weekend_leads',
      minWidth: 110,
      render: (value: number | undefined) => 
        value !== undefined ? value : 0,
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
        value !== undefined ? `${((value / (revenueData.find(item => item.list_id === record.list_id)?.leads_count || 0)) * 100).toFixed(2)}%` : '0.00%',
      sorter: (a: RevenueData, b: RevenueData) => {
        const leadsA = revenueData.find(item => item.list_id === a.list_id)?.leads_count || 0;
        const leadsB = revenueData.find(item => item.list_id === b.list_id)?.leads_count || 0;
        return ((a.transfers_count || 0) / leadsA) - ((b.transfers_count || 0) / leadsB);
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
      <Title level={2}>Revenue Tracking Dashboard</Title>
      
      <Row gutter={12} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Lead Costs"
              value={totalLeadCosts}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
              suffix=""
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
              title="Average Lead Cost"
              value={totalLeads > 0 ? totalLeadCosts / totalLeads : 0}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
              suffix=""
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
              suffix=""
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Issued Rate"
              value={totalLeads > 0 ? (totalSynergyIssuedLeads / totalLeads) * 100 : 0}
              precision={2}
              valueStyle={{ color: '#13c2c2' }}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Active Lists"
              value={5}
              valueStyle={{ color: '#cf1322' }}
              suffix="routings"
            />
          </Card>
        </Col>
      </Row>
      
      {/* Bland AI Costs Section */}
      <Row gutter={12} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={getCostTitle('Bland AI Costs')}
              value={blandAICosts}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix={<DollarOutlined />}
              suffix=""
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
              suffix=""
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
              suffix=""
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
              suffix=""
            />
          </Card>
        </Col>
      </Row>
      
      {/* CPA Tracking Summary Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Policies Issued"
              value={totalSynergyIssuedLeads}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
              suffix=""
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Average Cost Per Acquisition"
              value={totalSynergyIssuedLeads > 0 ? totalLeadCosts / totalSynergyIssuedLeads : 0}
              precision={2}
              valueStyle={{ color: totalSynergyIssuedLeads > 0 ? '#722ed1' : '#8c8c8c' }}
              prefix={<DollarOutlined />}
              suffix={totalSynergyIssuedLeads === 0 ? " (N/A)" : ""}
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
        <Col span={8}>
          <Card>
            <Statistic
              title="Transfer Rate"
              value={totalLeads > 0 ? (totalTransfers / totalLeads) * 100 : 0}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>
      
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select 
            value={timeFrame} 
            onChange={handleTimeFrameChange}
            style={{ width: 120 }}
          >
            <Option value="today">Today</Option>
            <Option value="yesterday">Yesterday</Option>
            <Option value="thisWeek">This Week</Option>
            <Option value="lastWeek">Last Week</Option>
            <Option value="thisMonth">This Month</Option>
            <Option value="lastMonth">Last Month</Option>
            <Option value="custom">Custom Range</Option>
          </Select>
          
          <RangePicker 
            onChange={(dates, dateStrings) => handleDateRangeChange(dates, dateStrings)}
            value={dateRange}
            disabled={timeFrame !== 'custom'}
            allowEmpty={[true, true]}
          />
          
          <Button 
            icon={<ReloadOutlined />}
            onClick={refreshData}
          >
            Refresh
          </Button>
        </Space>
        
        <Space>
          <Button 
            icon={<DownloadOutlined />}
            onClick={exportToCSV}
          >
            Export CSV
          </Button>
        </Space>
      </div>
      
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
                <Table.Summary.Cell index={3}><strong>{totalWeekdayLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={4}><strong>{totalWeekendLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={5}><strong>-</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={6}><strong>${totalLeadCosts.toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={7}><strong>{totalTransfers}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={8}><strong>{totalSynergyIssuedLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={9}><strong>{totalLeads > 0 ? ((totalSynergyIssuedLeads / totalLeads) * 100).toFixed(2) : '0.00'}%</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={10}><strong>{totalLeads > 0 ? ((totalTransfers / totalLeads) * 100).toFixed(2) : '0.00'}%</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={11}><strong>${totalSynergyPayout.toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={12}><strong>${(blandAICosts + pitchPerfectCosts).toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={13}><strong>${(totalSynergyPayout - totalLeadCosts - blandAICosts - pitchPerfectCosts).toFixed(2)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Spin>
      </div>
    </div>
  );
}
