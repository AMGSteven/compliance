'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Card, Table, Typography, DatePicker, Button, Select, Space, Statistic, Row, Col, Spin } from 'antd';
import { DollarOutlined, DownloadOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

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
  [key: string]: any;
}

interface RevenueData {
  key: string;
  list_id: string;
  description: string;
  leads_count: number;
  cost_per_lead: number;
  total_revenue: number;
  weekend_leads?: number;
  weekday_leads?: number;
}

export default function RevenueTrackingPage() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [timeFrame, setTimeFrame] = useState<string>('all');
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [totalWeekdayLeads, setTotalWeekdayLeads] = useState<number>(0);
  const [totalWeekendLeads, setTotalWeekendLeads] = useState<number>(0);

  useEffect(() => {
    fetchRevenueData();
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
          total_revenue: 0
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
          } else if (timeFrame !== 'all') {
            const now = dayjs();
            let startDate = now;
            
            switch (timeFrame) {
              case 'week':
                startDate = now.subtract(7, 'days');
                break;
              case 'month':
                startDate = now.subtract(30, 'days');
                break;
              case 'quarter':
                startDate = now.subtract(90, 'days');
                break;
              case 'year':
                startDate = now.subtract(365, 'days');
                break;
            }
            
            countUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
            countUrl.searchParams.append('endDate', now.format('YYYY-MM-DD'));
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
          revenueByListId[listId].total_revenue = count * revenueByListId[listId].cost_per_lead;
        }
      });
      
      // Now we need to get weekend lead counts and subtract them from revenue
      // Weekend leads (Saturday/Sunday) should have $0 payout
      console.log('Calculating weekend leads to exclude from revenue...');
      
      const weekendLeadPromises = Object.keys(routingMap).map(async (listId) => {
        try {
          // Get a sample of leads for this list to check weekend dates
          const sampleUrl = new URL('/api/leads/list', window.location.origin);
          sampleUrl.searchParams.append('pageSize', '1000'); // Get more leads to check dates
          sampleUrl.searchParams.append('list_id', listId);
          
          // Apply same date filtering as main query
          if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
            sampleUrl.searchParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
            sampleUrl.searchParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
          } else if (timeFrame !== 'all') {
            const now = dayjs();
            let startDate = now;
            
            switch (timeFrame) {
              case 'week':
                startDate = now.subtract(7, 'days');
                break;
              case 'month':
                startDate = now.subtract(30, 'days');
                break;
              case 'quarter':
                startDate = now.subtract(90, 'days');
                break;
              case 'year':
                startDate = now.subtract(365, 'days');
                break;
            }
            
            sampleUrl.searchParams.append('startDate', startDate.format('YYYY-MM-DD'));
            sampleUrl.searchParams.append('endDate', now.format('YYYY-MM-DD'));
          }
          
          const response = await fetch(sampleUrl.toString(), {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
          });
          
          const result = await response.json();
          
          if (result.success && result.data) {
            // Count weekend leads (Saturday = 6, Sunday = 0)
            let weekendCount = 0;
            
            result.data.forEach((lead: Lead) => {
              const leadDate = new Date(lead.created_at);
              const dayOfWeek = leadDate.getDay(); // 0 = Sunday, 6 = Saturday
              
              if (dayOfWeek === 0 || dayOfWeek === 6) {
                weekendCount++;
              }
            });
            
            // If we have more leads than our sample, estimate weekend count proportionally
            const totalLeadsForList = revenueByListId[listId]?.leads_count || 0;
            const sampleSize = result.data.length;
            
            if (totalLeadsForList > sampleSize && sampleSize > 0) {
              const weekendRatio = weekendCount / sampleSize;
              weekendCount = Math.round(totalLeadsForList * weekendRatio);
            }
            
            console.log(`List ${listId}: ${weekendCount} weekend leads out of ${totalLeadsForList} total`);
            return { listId, weekendCount };
            
          } else {
            return { listId, weekendCount: 0 };
          }
          
        } catch (error) {
          console.error(`Error counting weekend leads for List ID ${listId}:`, error);
          return { listId, weekendCount: 0 };
        }
      });
      
      const weekendCounts = await Promise.all(weekendLeadPromises);
      
      // Update revenue data to exclude weekend leads
      weekendCounts.forEach(({ listId, weekendCount }) => {
        if (revenueByListId[listId]) {
          const totalLeads = revenueByListId[listId].leads_count;
          const weekdayLeads = totalLeads - weekendCount;
          
          // Update to show weekday leads only in revenue calculation
          revenueByListId[listId].total_revenue = weekdayLeads * revenueByListId[listId].cost_per_lead;
          
          // Add weekend info for display
          revenueByListId[listId].weekend_leads = weekendCount;
          revenueByListId[listId].weekday_leads = weekdayLeads;
          
          console.log(`List ${listId}: ${totalLeads} total leads, ${weekendCount} weekend (excluded), ${weekdayLeads} weekday leads contributing to revenue`);
        }
      });
      
      // Convert to array and sort by revenue
      const revenueArray = Object.values(revenueByListId)
        .sort((a, b) => b.total_revenue - a.total_revenue);
      
      setRevenueData(revenueArray);
      
      // Calculate totals
      const totalRev = revenueArray.reduce((sum, item) => sum + item.total_revenue, 0);
      const totalLeadsCount = revenueArray.reduce((sum, item) => sum + item.leads_count, 0);
      const totalWeekdayLeadsCount = revenueArray.reduce((sum, item) => sum + (item.weekday_leads || item.leads_count), 0);
      const totalWeekendLeadsCount = revenueArray.reduce((sum, item) => sum + (item.weekend_leads || 0), 0);
      
      setTotalRevenue(totalRev);
      setTotalLeads(totalLeadsCount);
      setTotalWeekdayLeads(totalWeekdayLeadsCount);
      setTotalWeekendLeads(totalWeekendLeadsCount);
      
      console.log(`Revenue calculation complete:`, {
        totalRevenue: totalRev,
        totalLeads: totalLeadsCount,
        listIds: revenueArray.length
      });
      
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
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

  const handleExport = () => {
    // Export functionality
    const csvContent = [
      'List ID,Description,Total Leads,Weekday Leads,Weekend Leads,Cost Per Lead,Total Revenue',
      ...revenueData.map(item => 
        `${item.list_id},"${item.description}",${item.leads_count},${item.weekday_leads || item.leads_count},${item.weekend_leads || 0},$${item.cost_per_lead.toFixed(2)},$${item.total_revenue.toFixed(2)}`
      )
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
      width: '20%',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '20%',
    },
    {
      title: 'Total Leads',
      dataIndex: 'leads_count',
      key: 'leads_count',
      width: '12%',
      sorter: (a: RevenueData, b: RevenueData) => a.leads_count - b.leads_count,
    },
    {
      title: 'Weekday Leads',
      dataIndex: 'weekday_leads',
      key: 'weekday_leads',
      width: '12%',
      render: (value: number | undefined, record: RevenueData) => 
        value !== undefined ? value : record.leads_count,
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.weekday_leads || a.leads_count) - (b.weekday_leads || b.leads_count),
    },
    {
      title: 'Weekend Leads',
      dataIndex: 'weekend_leads',
      key: 'weekend_leads',
      width: '12%',
      render: (value: number | undefined) => 
        value !== undefined ? value : 0,
      sorter: (a: RevenueData, b: RevenueData) => 
        (a.weekend_leads || 0) - (b.weekend_leads || 0),
    },
    {
      title: 'Cost Per Lead',
      dataIndex: 'cost_per_lead',
      key: 'cost_per_lead',
      width: '12%',
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueData, b: RevenueData) => a.cost_per_lead - b.cost_per_lead,
    },
    {
      title: 'Revenue (Weekdays Only)',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: '12%',
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueData, b: RevenueData) => a.total_revenue - b.total_revenue,
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Revenue Tracking Dashboard</Title>
      
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={totalRevenue}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
              suffix=""
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Leads Processed"
              value={totalLeads}
              valueStyle={{ color: '#1890ff' }}
              suffix="leads"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Average Revenue Per Lead"
              value={totalWeekdayLeads > 0 ? totalRevenue / totalWeekdayLeads : 0}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
              suffix="per lead"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Lists"
              value={revenueData.length}
              valueStyle={{ color: '#f5222d' }}
              suffix="lists"
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
            <Option value="all">All Time</Option>
            <Option value="week">Last Week</Option>
            <Option value="month">Last Month</Option>
            <Option value="quarter">Last Quarter</Option>
            <Option value="year">Last Year</Option>
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
            onClick={fetchRevenueData}
          >
            Refresh
          </Button>
        </Space>
        
        <Space>
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </Space>
      </div>
      
      <div style={{ marginTop: '16px' }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={revenueData}
            rowKey="list_id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1}><strong>All Lists</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2}><strong>{totalLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={3}><strong>{totalWeekdayLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={4}><strong>{totalWeekendLeads}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={5}><strong>-</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={6}><strong>${totalRevenue.toFixed(2)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Spin>
      </div>
    </div>
  );
}
