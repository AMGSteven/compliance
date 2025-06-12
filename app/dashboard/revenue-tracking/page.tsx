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

interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  leads_count: number;
  bid_amount: number;
  total_revenue: number;
}

interface ListIdData {
  list_id: string;
  leads_count: number;
  total_revenue: number;
}

interface RevenueData {
  key: string;
  traffic_source: string;
  display_name: string;
  leads_count: number;
  total_bid_amount: number;
  average_bid: number;
  campaigns: CampaignData[];
  list_ids: ListIdData[];
}

export default function RevenueTrackingPage() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [timeFrame, setTimeFrame] = useState<string>('all'); // Default to 'all' time
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalLeads, setTotalLeads] = useState<number>(0);

  useEffect(() => {
    fetchRevenueData();
  }, [dateRange, timeFrame]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      // Default to showing ALL time data with no date filtering
      // Only add date parameters if explicitly set by the user
      if (timeFrame === 'custom' && dateRange && dateRange[0] && dateRange[1]) {
        queryParams.append('startDate', dateRange[0].format('YYYY-MM-DD'));
        queryParams.append('endDate', dateRange[1].format('YYYY-MM-DD'));
        console.log(`Using custom date range: ${dateRange[0].format('YYYY-MM-DD')} to ${dateRange[1].format('YYYY-MM-DD')}`);
      } else {
        console.log('Showing ALL leads from ALL time - no date filtering');
      }
      
      queryParams.append('timeFrame', timeFrame);
      
      const response = await fetch(`/api/revenue-tracking?${queryParams.toString()}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setRevenueData(result.data);
        
        // Calculate totals
        let totalRev = 0;
        let totalLeadsCount = 0;
        
        result.data.forEach((vendor: RevenueData) => {
          totalRev += vendor.total_bid_amount;
          totalLeadsCount += vendor.leads_count;
        });
        
        setTotalRevenue(totalRev);
        setTotalLeads(totalLeadsCount);
      } else {
        console.error('Failed to fetch revenue data:', result.error || 'Unknown error');
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

  const handleExport = () => {
    // Export functionality will be implemented later
    console.log('Export data');
  };

  const columns = [
    {
      title: 'Traffic Source',
      dataIndex: 'traffic_source',
      key: 'traffic_source',
      width: '15%',
    },
    {
      title: 'Display Name',
      dataIndex: 'display_name',
      key: 'display_name',
      width: '20%',
      render: (text: string, record: RevenueData) => {
        return text || record.traffic_source; // Fallback to traffic source ID if name is not available
      },
    },
    {
      title: 'Leads Count',
      dataIndex: 'leads_count',
      key: 'leads_count',
      width: '15%',
      sorter: (a: RevenueData, b: RevenueData) => a.leads_count - b.leads_count,
    },
    {
      title: 'Avg. Bid',
      dataIndex: 'average_bid',
      key: 'average_bid',
      width: '15%',
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueData, b: RevenueData) => a.average_bid - b.average_bid,
    },
    {
      title: 'Total Revenue',
      dataIndex: 'total_bid_amount',
      key: 'total_bid_amount',
      width: '15%',
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: RevenueData, b: RevenueData) => a.total_bid_amount - b.total_bid_amount,
    },
    {
      title: 'Sub IDs',
      key: 'list_ids_count',
      width: '10%',
      render: (_: unknown, record: RevenueData) => record.list_ids?.length || 0,
    },
  ];

  // Define the nested campaign columns for the expandable rows
  const campaignColumns = [
    {
      title: 'Campaign ID',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
    },
    {
      title: 'Campaign Name',
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      render: (text: string, record: CampaignData) => {
        return text || record.campaign_id; // Fallback to campaign ID if name is not available
      },
    },
    {
      title: 'Leads Count',
      dataIndex: 'leads_count',
      key: 'leads_count',
    },
    {
      title: 'Bid Amount',
      dataIndex: 'bid_amount',
      key: 'bid_amount',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Total Revenue',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
  ];

  // Define the nested list_id columns for the expandable rows
  const listIdColumns = [
    {
      title: 'Sub ID',
      dataIndex: 'list_id',
      key: 'list_id',
    },
    {
      title: 'Leads Count',
      dataIndex: 'leads_count',
      key: 'leads_count',
    },
    {
      title: 'Total Revenue',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
  ];

  const expandedRowRender = (record: RevenueData) => {
    return (
      <div>
        <Title level={5} style={{ marginTop: '16px' }}>Campaigns</Title>
        <Table
          columns={campaignColumns}
          dataSource={record.campaigns}
          pagination={false}
          rowKey="campaign_id"
        />
        
        <Title level={5} style={{ marginTop: '16px' }}>Sub IDs</Title>
        <Table
          columns={listIdColumns}
          dataSource={record.list_ids}
          pagination={false}
          rowKey="list_id"
        />
      </div>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Revenue Tracking</Title>
      
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
              title="Average Bid"
              value={totalLeads > 0 ? totalRevenue / totalLeads : 0}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
              suffix="per lead"
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
            Export
          </Button>
        </Space>
      </div>
      
      <div style={{ marginTop: '16px' }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={revenueData}
            rowKey="traffic_source"
            expandable={{
              expandedRowRender,
              expandedRowKeys: expandedRows,
              onExpand: (expanded, record) => {
                if (expanded) {
                  setExpandedRows([...expandedRows, record.traffic_source]);
                } else {
                  setExpandedRows(expandedRows.filter(key => key !== record.traffic_source));
                }
              }
            }}
            pagination={{ pageSize: 10 }}
          />
        </Spin>
      </div>
    </div>
  );
}
