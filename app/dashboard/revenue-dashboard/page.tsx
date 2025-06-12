'use client';

import { useState, useEffect } from 'react';
import { Card, Table, DatePicker, Button, Select, Row, Col, Spin, Typography, Statistic } from 'antd';
import { DollarOutlined, FilterOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface ListRoutingData {
  list_id: string;
  campaign_id: string;
  cadence_id: string;
  description: string;
  bid: number;
  active: boolean;
  created_at: string;
}

interface LeadData {
  id: string;
  list_id: string;
  campaign_id: string;
  status: string;
  created_at: string;
}

interface RevenueSummary {
  list_id: string;
  description: string;
  campaign_id: string;
  cadence_id: string;
  leads_count: number;
  bid_amount: number;
  total_revenue: number;
}

export default function RevenueDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [timeFrame, setTimeFrame] = useState<string>('month');
  const [listRoutings, setListRoutings] = useState<ListRoutingData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueSummary[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [averageBid, setAverageBid] = useState<number>(0);
  const [csvData, setCsvData] = useState<any[]>([]);

  useEffect(() => {
    // Load list routings data once
    fetchListRoutings();
  }, []);

  useEffect(() => {
    // Re-fetch revenue data when date range or timeframe changes
    if (listRoutings.length > 0) {
      fetchRevenueData();
    }
  }, [dateRange, timeFrame, listRoutings]);

  const fetchListRoutings = async () => {
    try {
      const response = await fetch('/api/v1/list-routings', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      const result = await response.json();

      if (result.success && result.data) {
        setListRoutings(result.data);
        console.log('List routings loaded:', result.data.length);
      } else {
        console.error('Failed to load list routings:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching list routings:', error);
    }
  };

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      // Add date range if available
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
        queryParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
      } else {
        // Default date range based on timeFrame
        const endDate = new Date();
        let startDate = new Date();
        
        if (timeFrame === 'week') {
          startDate.setDate(endDate.getDate() - 7);
        } else if (timeFrame === 'month') {
          startDate.setMonth(endDate.getMonth() - 1);
        } else if (timeFrame === 'quarter') {
          startDate.setMonth(endDate.getMonth() - 3);
        } else if (timeFrame === 'year') {
          startDate.setFullYear(endDate.getFullYear() - 1);
        } else if (timeFrame === 'today') {
          startDate = new Date(endDate);
        }
        
        queryParams.append('startDate', dayjs(startDate).format('YYYY-MM-DD'));
        queryParams.append('endDate', dayjs(endDate).format('YYYY-MM-DD'));
      }
      
      // Fetch successful leads in the date range
      const response = await fetch(`/api/v1/leads?status=success&${queryParams.toString()}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const leads = result.data;
        console.log(`Found ${leads.length} successful leads`);
        
        // Process leads and list routings to generate revenue summary
        const revenueByListId: Record<string, RevenueSummary> = {};
        let totalRev = 0;
        
        // Process each successful lead
        leads.forEach((lead: LeadData) => {
          if (!lead.list_id) return;
          
          // Find matching list routing
          const routing = listRoutings.find(r => 
            r.list_id === lead.list_id && 
            (r.campaign_id === lead.campaign_id || !lead.campaign_id) && 
            r.active
          );
          
          if (!routing) return;
          
          const listIdKey = `${lead.list_id}-${routing.campaign_id || 'default'}`;
          
          if (!revenueByListId[listIdKey]) {
            revenueByListId[listIdKey] = {
              list_id: lead.list_id,
              description: routing.description || lead.list_id,
              campaign_id: routing.campaign_id,
              cadence_id: routing.cadence_id,
              leads_count: 0,
              bid_amount: routing.bid,
              total_revenue: 0
            };
          }
          
          revenueByListId[listIdKey].leads_count++;
          revenueByListId[listIdKey].total_revenue += routing.bid;
          totalRev += routing.bid;
        });
        
        // Convert to array and sort by revenue
        const revenueSummary = Object.values(revenueByListId)
          .sort((a, b) => b.total_revenue - a.total_revenue);
        
        setRevenueData(revenueSummary);
        setTotalRevenue(totalRev);
        setTotalLeads(leads.length);
        setAverageBid(leads.length > 0 ? totalRev / leads.length : 0);
        
        // Prepare CSV export data
        setCsvData([
          ['List ID', 'Description', 'Campaign ID', 'Cadence ID', 'Leads Count', 'Bid Amount', 'Total Revenue'],
          ...revenueSummary.map(item => [
            item.list_id, 
            item.description,
            item.campaign_id,
            item.cadence_id,
            item.leads_count,
            item.bid_amount.toFixed(2),
            item.total_revenue.toFixed(2)
          ])
        ]);
      } else {
        console.error('Failed to fetch leads:', result.error || 'Unknown error');
        setRevenueData([]);
        setTotalRevenue(0);
        setTotalLeads(0);
        setAverageBid(0);
      }
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value);
    setDateRange(null); // Reset custom date range when changing time frame
  };

  const handleDateRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates && dates.length === 2) {
      setDateRange([dates[0], dates[1]]);
      setTimeFrame('custom'); // Set to custom when date range is selected
    } else {
      setDateRange(null);
    }
  };

  const handleRefresh = () => {
    fetchRevenueData();
  };

  const columns = [
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
      width: '15%',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '25%',
    },
    {
      title: 'Campaign',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
      width: '15%',
    },
    {
      title: 'Leads',
      dataIndex: 'leads_count',
      key: 'leads_count',
      width: '10%',
      sorter: (a: RevenueSummary, b: RevenueSummary) => a.leads_count - b.leads_count,
    },
    {
      title: 'Bid',
      dataIndex: 'bid_amount',
      key: 'bid_amount',
      width: '10%',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Revenue',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: '15%',
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueSummary, b: RevenueSummary) => a.total_revenue - b.total_revenue,
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div className="p-6">
      <Row gutter={[16, 24]}>
        <Col span={24}>
          <Card>
            <div className="flex justify-between items-center mb-6">
              <Title level={2}>
                <DollarOutlined className="mr-2" /> Revenue Dashboard
              </Title>
              <div className="flex items-center space-x-4">
                <Select 
                  defaultValue="month" 
                  style={{ width: 120 }} 
                  onChange={handleTimeFrameChange}
                  value={timeFrame}
                >
                  <Option value="today">Today</Option>
                  <Option value="week">This Week</Option>
                  <Option value="month">This Month</Option>
                  <Option value="quarter">This Quarter</Option>
                  <Option value="year">This Year</Option>
                  <Option value="custom">Custom</Option>
                </Select>
                <RangePicker 
                  onChange={handleDateRangeChange}
                  value={dateRange}
                  disabled={timeFrame !== 'custom'}
                />
                <Button 
                  type="primary" 
                  icon={<FilterOutlined />}
                  onClick={fetchRevenueData}
                >
                  Filter
                </Button>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                >
                  Refresh
                </Button>
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," + 
                      csvData.map(row => row.join(",")).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `revenue-report-${new Date().toISOString()}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Export
                </Button>
              </div>
            </div>

            <Row gutter={16} className="mb-6">
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Total Revenue"
                    value={totalRevenue}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Total Leads"
                    value={totalLeads}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Average Bid"
                    value={averageBid}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
            </Row>

            <div className="overflow-auto">
              <Table 
                columns={columns}
                dataSource={revenueData.map((item, index) => ({ ...item, key: index }))} 
                loading={loading}
                pagination={{ pageSize: 10 }}
                summary={(pageData) => {
                  const totalLeads = pageData.reduce((sum, item) => sum + item.leads_count, 0);
                  const totalRev = pageData.reduce((sum, item) => sum + item.total_revenue, 0);
                  
                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}><strong>Page Total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={3}><strong>{totalLeads}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={4}></Table.Summary.Cell>
                      <Table.Summary.Cell index={5}><strong>${totalRev.toFixed(2)}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                }}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
