'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Card, Table, Typography, DatePicker, Button, Select, Space, Statistic, 
  Row, Col, Spin, message, Alert, Collapse, Tag, Progress, Tooltip, Modal
} from 'antd';
import { 
  DollarOutlined, DownloadOutlined, ReloadOutlined, RiseOutlined, 
  FallOutlined, LineChartOutlined, TeamOutlined, TrophyOutlined,
  WarningOutlined, CheckCircleOutlined, CloseCircleOutlined, 
  EyeOutlined, FireOutlined, ThunderboltOutlined, BarChartOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Panel } = Collapse;

// Types
interface WeeklyCohort {
  cohort_week: string;
  cohort_age_days: number;
  status: 'Fresh' | 'Young' | 'Active' | 'Aging' | 'Mature';
  leads_bought: number;
  avg_cost_per_lead: number;
  total_lead_cost: number;
  transfers: number;
  transfer_rate: number;
  policies: number;
  policy_rate: number;
  revenue: number;
  dialer_costs: number;
  gross_profit: number;
  roi: number;
  maturation_pct: number;
  projected_final_transfers: number;
  projected_final_policies: number;
  projected_revenue: number;
  projected_roi: number;
}

interface MaturationBucket {
  days_bucket: number;
  bucket_label: string;
  transfer_count: number;
  cumulative_transfers: number;
  cumulative_pct: number;
}

interface InventoryBucket {
  inventory_bucket: string;
  age_range: string;
  leads_count: number;
  total_cost: number;
  current_transfers: number;
  current_policies: number;
  current_revenue: number;
  maturation_pct: number;
  projected_policies: number;
  projected_revenue: number;
  unrealized_profit: number;
}

interface SourcePerformance {
  list_id: string;
  description: string;
  partner_name: string;
  vertical: string;
  cost_per_lead: number;
  leads_bought: number;
  total_cost: number;
  transfers: number;
  transfer_rate: number;
  policies: number;
  policy_rate: number;
  revenue: number;
  dialer_costs: number;
  gross_profit: number;
  roi: number;
  cohort_age_days: number;
  maturation_pct: number;
  projected_final_transfers: number;
  projected_final_policies: number;
  projected_revenue: number;
  projected_roi: number;
  recommendation: 'SCALE' | 'MONITOR' | 'REDUCE' | 'WATCH';
}

interface SubidPerformance {
  list_id: string;
  subid: string;
  cost_per_lead: number;
  leads_bought: number;
  total_cost: number;
  transfers: number;
  transfer_rate: number;
  policies: number;
  policy_rate: number;
  revenue: number;
  gross_profit: number;
  roi: number;
  cohort_age_days: number;
  projected_final_policies: number;
  projected_revenue: number;
  projected_roi: number;
  recommendation: 'SCALE' | 'MONITOR' | 'REDUCE' | 'WATCH';
}

interface Summary {
  totalLeadsBought: number;
  totalLeadCost: number;
  totalTransfers: number;
  totalPolicies: number;
  totalRevenue: number;
  totalDialerCosts: number;
  totalGrossProfit: number;
  overallTransferRate: number;
  overallPolicyRate: number;
  overallROI: number;
  projectedTotalRevenue: number;
  projectedROI: number;
}

// Styles
const styles = `
  .cohort-page-container {
    padding: 20px;
    max-width: 100%;
    box-sizing: border-box;
  }
  .cohort-scale { background-color: #f6ffed !important; border-left: 4px solid #52c41a !important; }
  .cohort-monitor { background-color: #fffbe6 !important; border-left: 4px solid #faad14 !important; }
  .cohort-reduce { background-color: #fff2f0 !important; border-left: 4px solid #ff4d4f !important; }
  .cohort-watch { background-color: #f5f5f5 !important; border-left: 4px solid #999 !important; }
  .kpi-card .ant-statistic-title { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kpi-card .ant-statistic-content { font-size: 16px !important; }
  .kpi-card .ant-statistic-content-value { font-size: 16px !important; }
  .kpi-card .ant-card-body { padding: 10px !important; }
  .inventory-card .ant-card-body { max-height: 400px; overflow-y: auto; }
  .inventory-bucket { 
    margin-bottom: 8px; 
    padding: 8px 10px; 
    background: #fafafa; 
    border-radius: 4px;
  }
  .inventory-bucket-row { 
    display: flex; 
    flex-wrap: wrap; 
    gap: 6px;
    margin-top: 4px;
    font-size: 11px;
  }
  .inventory-bucket-item {
    flex: 1;
    min-width: 80px;
  }
  .cohort-table-card .ant-table-wrapper { max-width: 100%; overflow-x: auto; }
  .source-table-card .ant-card-body { padding: 12px !important; }
`;

export default function CohortRevenuePage() {
  // State
  const [loading, setLoading] = useState(true);
  const [weeklyCohorts, setWeeklyCohorts] = useState<WeeklyCohort[]>([]);
  const [maturationCurve, setMaturationCurve] = useState<MaturationBucket[]>([]);
  const [inventory, setInventory] = useState<InventoryBucket[]>([]);
  const [sourcePerformance, setSourcePerformance] = useState<SourcePerformance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  
  // Filters
  const [daysBack, setDaysBack] = useState(21);
  const [selectedVertical, setSelectedVertical] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [selectedDialerType, setSelectedDialerType] = useState<number | null>(null);
  const [cohortDateRange, setCohortDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(14, 'days'),
    dayjs().subtract(1, 'day')
  ]);
  const [minLeads, setMinLeads] = useState(50);
  
  // SUBID Drill-down
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [subidData, setSubidData] = useState<Record<string, SubidPerformance[]>>({});
  const [loadingSubids, setLoadingSubids] = useState<Record<string, boolean>>({});
  
  // Available verticals
  const [availableVerticals, setAvailableVerticals] = useState<string[]>(['ACA', 'Final Expense', 'Medicare']);

  // Fetch main data
  const fetchCohortData = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        days_back: daysBack.toString(),
        ...(selectedVertical && { vertical: selectedVertical }),
        ...(selectedDialerType !== null && { dialer_type: selectedDialerType.toString() })
      });

      const response = await fetch(`/api/cohort-revenue?${params}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setWeeklyCohorts(result.data.weeklyCohorts || []);
      setMaturationCurve(result.data.maturationCurve || []);
      setInventory(result.data.inventory?.buckets || []);
      setSummary(result.summary);

      message.success(`Loaded ${result.data.weeklyCohorts?.length || 0} weekly cohorts`);
    } catch (error: any) {
      console.error('Error fetching cohort data:', error);
      message.error(`Failed to fetch cohort data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [daysBack, selectedVertical, selectedDialerType]);

  // Fetch source performance
  const fetchSourcePerformance = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        cohort_start: cohortDateRange[0].format('YYYY-MM-DD'),
        cohort_end: cohortDateRange[1].format('YYYY-MM-DD'),
        min_leads: minLeads.toString(),
        ...(selectedVertical && { vertical: selectedVertical }),
        ...(selectedDialerType !== null && { dialer_type: selectedDialerType.toString() })
      });

      const response = await fetch(`/api/cohort-revenue/source-performance?${params}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setSourcePerformance(result.data || []);
    } catch (error: any) {
      console.error('Error fetching source performance:', error);
      message.error(`Failed to fetch source performance: ${error.message}`);
    }
  }, [cohortDateRange, minLeads, selectedVertical, selectedDialerType]);

  // Fetch SUBID performance for a specific list
  const fetchSubidPerformance = async (listId: string) => {
    if (subidData[listId]) return; // Already loaded
    
    setLoadingSubids(prev => ({ ...prev, [listId]: true }));
    
    try {
      const params = new URLSearchParams({
        list_id: listId,
        cohort_start: cohortDateRange[0].format('YYYY-MM-DD'),
        cohort_end: cohortDateRange[1].format('YYYY-MM-DD'),
        min_leads: '5',
        ...(selectedVertical && { vertical: selectedVertical })
      });

      const response = await fetch(`/api/cohort-revenue/subid-performance?${params}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      const result = await response.json();

      if (result.success) {
        setSubidData(prev => ({ ...prev, [listId]: result.data || [] }));
      }
    } catch (error) {
      console.error('Error fetching SUBID performance:', error);
    } finally {
      setLoadingSubids(prev => ({ ...prev, [listId]: false }));
    }
  };

  // Initial load
  useEffect(() => {
    fetchCohortData();
  }, [fetchCohortData]);

  useEffect(() => {
    fetchSourcePerformance();
  }, [fetchSourcePerformance]);

  // Refresh all data
  const refreshData = () => {
    setSubidData({});
    setExpandedSources([]);
    fetchCohortData();
    fetchSourcePerformance();
  };

  // Get recommendation tag
  const getRecommendationTag = (recommendation: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode }> = {
      SCALE: { color: 'success', icon: <ArrowUpOutlined /> },
      MONITOR: { color: 'warning', icon: <MinusOutlined /> },
      REDUCE: { color: 'error', icon: <ArrowDownOutlined /> },
      WATCH: { color: 'default', icon: <EyeOutlined /> }
    };
    const { color, icon } = config[recommendation] || config.WATCH;
    return <Tag color={color} icon={icon}>{recommendation}</Tag>;
  };

  // Get status tag
  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string }> = {
      Fresh: { color: 'blue' },
      Young: { color: 'cyan' },
      Active: { color: 'green' },
      Aging: { color: 'orange' },
      Mature: { color: 'purple' }
    };
    return <Tag color={config[status]?.color || 'default'}>{status}</Tag>;
  };

  // Export to CSV
  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) {
      message.warning('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => 
      typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    ).join(','));
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Weekly cohort columns
  const weeklyColumns = [
    {
      title: 'Cohort Week',
      dataIndex: 'cohort_week',
      key: 'cohort_week',
      width: 120,
      render: (date: string) => <Text strong>{dayjs(date).format('MMM D, YYYY')}</Text>,
      sorter: (a: WeeklyCohort, b: WeeklyCohort) => dayjs(a.cohort_week).unix() - dayjs(b.cohort_week).unix()
    },
    {
      title: 'Age',
      dataIndex: 'cohort_age_days',
      key: 'cohort_age_days',
      width: 80,
      render: (days: number) => `${days}d`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: 'Leads',
      dataIndex: 'leads_bought',
      key: 'leads_bought',
      width: 100,
      render: (v: number) => v?.toLocaleString(),
      sorter: (a: WeeklyCohort, b: WeeklyCohort) => a.leads_bought - b.leads_bought
    },
    {
      title: 'Cost/Lead',
      dataIndex: 'avg_cost_per_lead',
      key: 'avg_cost_per_lead',
      width: 100,
      render: (v: number) => `$${v?.toFixed(2)}`
    },
    {
      title: 'Total Cost',
      dataIndex: 'total_lead_cost',
      key: 'total_lead_cost',
      width: 120,
      render: (v: number) => `$${v?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      title: 'Transfers',
      key: 'transfers',
      width: 120,
      render: (_: any, record: WeeklyCohort) => (
        <div>
          <div>{record.transfers?.toLocaleString()}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.transfer_rate?.toFixed(2)}%</Text>
        </div>
      )
    },
    {
      title: 'Policies',
      key: 'policies',
      width: 120,
      render: (_: any, record: WeeklyCohort) => (
        <div>
          <div>{record.policies?.toLocaleString()}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.policy_rate?.toFixed(2)}%</Text>
        </div>
      )
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>${v?.toLocaleString()}</Text>
    },
    {
      title: 'ROI',
      dataIndex: 'roi',
      key: 'roi',
      width: 100,
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {v?.toFixed(1)}%
        </Text>
      ),
      sorter: (a: WeeklyCohort, b: WeeklyCohort) => (a.roi || 0) - (b.roi || 0)
    },
    {
      title: 'Maturity',
      dataIndex: 'maturation_pct',
      key: 'maturation_pct',
      width: 100,
      render: (v: number) => (
        <Progress 
          percent={Math.round((v || 0) * 100)} 
          size="small" 
          strokeColor={v >= 0.87 ? '#52c41a' : v >= 0.67 ? '#faad14' : '#1890ff'}
        />
      )
    },
    {
      title: 'Proj. ROI',
      dataIndex: 'projected_roi',
      key: 'projected_roi',
      width: 120,
      render: (v: number, record: WeeklyCohort) => (
        <Tooltip title={`Projected based on ${Math.round((record.maturation_pct || 0) * 100)}% maturation`}>
          <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
            {v != null ? `${v.toFixed(1)}%` : 'N/A'}
            {v != null && record.roi != null && v > record.roi && (
              <ArrowUpOutlined style={{ marginLeft: 4, color: '#52c41a', fontSize: 10 }} />
            )}
          </Text>
        </Tooltip>
      ),
      sorter: (a: WeeklyCohort, b: WeeklyCohort) => (a.projected_roi || 0) - (b.projected_roi || 0)
    }
  ];

  // Source performance columns
  const sourceColumns = [
    {
      title: 'List',
      key: 'description',
      width: 250,
      render: (_: any, record: SourcePerformance) => (
        <Space size={4}>
          <Text strong style={{ fontSize: 13 }}>{record.description}</Text>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(record.list_id);
              message.success('List ID copied');
            }}
          />
        </Space>
      )
    },
    {
      title: 'Partner',
      dataIndex: 'partner_name',
      key: 'partner_name',
      width: 120,
      ellipsis: true
    },
    {
      title: 'Vertical',
      dataIndex: 'vertical',
      key: 'vertical',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'ACA' ? 'blue' : v === 'Final Expense' ? 'green' : 'orange'}>
          {v}
        </Tag>
      )
    },
    {
      title: 'Cost/Lead',
      dataIndex: 'cost_per_lead',
      key: 'cost_per_lead',
      width: 90,
      render: (v: number) => `$${v?.toFixed(2)}`
    },
    {
      title: 'Leads',
      dataIndex: 'leads_bought',
      key: 'leads_bought',
      width: 90,
      render: (v: number) => v?.toLocaleString(),
      sorter: (a: SourcePerformance, b: SourcePerformance) => a.leads_bought - b.leads_bought
    },
    {
      title: 'Transfer %',
      dataIndex: 'transfer_rate',
      key: 'transfer_rate',
      width: 90,
      render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: 'Policy %',
      dataIndex: 'policy_rate',
      key: 'policy_rate',
      width: 90,
      render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 100,
      render: (v: number) => `$${v?.toLocaleString()}`
    },
    {
      title: 'ROI',
      dataIndex: 'roi',
      key: 'roi',
      width: 90,
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {v != null ? `${v.toFixed(1)}%` : 'N/A'}
        </Text>
      )
    },
    {
      title: 'Proj. ROI',
      dataIndex: 'projected_roi',
      key: 'projected_roi',
      width: 100,
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {v != null ? `${v.toFixed(1)}%` : 'N/A'}
        </Text>
      ),
      sorter: (a: SourcePerformance, b: SourcePerformance) => (a.projected_roi || 0) - (b.projected_roi || 0)
    },
    {
      title: 'Action',
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 110,
      render: (v: string) => getRecommendationTag(v),
      filters: [
        { text: 'SCALE', value: 'SCALE' },
        { text: 'MONITOR', value: 'MONITOR' },
        { text: 'REDUCE', value: 'REDUCE' },
        { text: 'WATCH', value: 'WATCH' }
      ],
      onFilter: (value: any, record: SourcePerformance) => record.recommendation === value
    }
  ];

  // SUBID columns
  const subidColumns = [
    {
      title: 'SUBID',
      dataIndex: 'subid',
      key: 'subid',
      width: 200
    },
    {
      title: 'Leads',
      dataIndex: 'leads_bought',
      key: 'leads_bought',
      width: 80,
      render: (v: number) => v?.toLocaleString()
    },
    {
      title: 'Cost',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 100,
      render: (v: number) => `$${v?.toFixed(2)}`
    },
    {
      title: 'Transfer %',
      dataIndex: 'transfer_rate',
      key: 'transfer_rate',
      width: 90,
      render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: 'Policy %',
      dataIndex: 'policy_rate',
      key: 'policy_rate',
      width: 90,
      render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 100,
      render: (v: number) => `$${v?.toLocaleString()}`
    },
    {
      title: 'ROI',
      dataIndex: 'roi',
      key: 'roi',
      width: 80,
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {v != null ? `${v.toFixed(1)}%` : 'N/A'}
        </Text>
      )
    },
    {
      title: 'Proj. ROI',
      dataIndex: 'projected_roi',
      key: 'projected_roi',
      width: 90,
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {v != null ? `${v.toFixed(1)}%` : 'N/A'}
        </Text>
      )
    },
    {
      title: 'Action',
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 100,
      render: (v: string) => getRecommendationTag(v)
    }
  ];

  // Handle source row expansion
  const handleSourceExpand = (expanded: boolean, record: SourcePerformance) => {
    if (expanded) {
      setExpandedSources(prev => [...prev, record.list_id]);
      fetchSubidPerformance(record.list_id);
    } else {
      setExpandedSources(prev => prev.filter(id => id !== record.list_id));
    }
  };

  // Render expanded SUBID row
  const renderExpandedSubids = (record: SourcePerformance) => {
    const data = subidData[record.list_id] || [];
    const isLoading = loadingSubids[record.list_id];

    if (isLoading) {
      return <div style={{ padding: 24, textAlign: 'center' }}><Spin /> Loading SUBIDs...</div>;
    }

    if (!data.length) {
      return <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>No SUBID data available</div>;
    }

    return (
      <div style={{ padding: '8px 48px', background: '#fafafa' }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>SUBID Breakdown ({data.length} SUBIDs)</Text>
          <Button 
            size="small" 
            icon={<DownloadOutlined />}
            onClick={() => exportToCSV(data, `subid-${record.list_id}`)}
          >
            Export
          </Button>
        </div>
        <Table
          columns={subidColumns}
          dataSource={data}
          rowKey="subid"
          size="small"
          pagination={false}
          scroll={{ x: true }}
          rowClassName={(r) => `cohort-${r.recommendation?.toLowerCase()}`}
        />
      </div>
    );
  };

  return (
    <div className="cohort-page-container">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          <BarChartOutlined /> Cohort Revenue Analytics
          <Tag color="green" style={{ marginLeft: 12, verticalAlign: 'middle' }}>Production</Tag>
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Track lead cohort profitability from purchase to maturity. Use projected ROI based on your 
          actual maturation curves to make buy/scale/kill decisions before cohorts fully mature.
        </Text>
      </div>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 20 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={12} sm={6} md={4} lg={3}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Days Back</Text>
            <Select value={daysBack} onChange={setDaysBack} style={{ width: '100%' }} size="small">
              <Option value={7}>7 Days</Option>
              <Option value={14}>14 Days</Option>
              <Option value={21}>21 Days</Option>
              <Option value={30}>30 Days</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Vertical</Text>
            <Select 
              value={selectedVertical} 
              onChange={setSelectedVertical} 
              placeholder="All"
              allowClear
              style={{ width: '100%' }}
              size="small"
            >
              {availableVerticals.map(v => <Option key={v} value={v}>{v}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Dialer</Text>
            <Select 
              value={selectedDialerType} 
              onChange={setSelectedDialerType} 
              placeholder="All Dialers"
              allowClear
              style={{ width: '100%' }}
              size="small"
            >
              <Option value={1}>Internal</Option>
              <Option value={2}>Pitch BPO</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Source Analysis Period</Text>
            <RangePicker
              value={cohortDateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setCohortDateRange([dates[0], dates[1]]);
                }
              }}
              style={{ width: '100%' }}
              size="small"
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Min Leads</Text>
            <Select value={minLeads} onChange={setMinLeads} style={{ width: '100%' }} size="small">
              <Option value={10}>10+</Option>
              <Option value={25}>25+</Option>
              <Option value={50}>50+</Option>
              <Option value={100}>100+</Option>
              <Option value={250}>250+</Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} md={24} lg={9}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Actions</Text>
            <Space wrap size="small">
              <Button type="primary" icon={<ReloadOutlined />} onClick={refreshData} loading={loading} size="small">
                Refresh
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => exportToCSV(weeklyCohorts, 'weekly-cohorts')} size="small">
                Export Cohorts
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => exportToCSV(sourcePerformance, 'source-performance')} size="small">
                Export Sources
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary KPIs */}
      {summary && (
        <Row gutter={[8, 8]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Total Leads" 
                value={summary.totalLeadsBought} 
                valueStyle={{ color: '#1890ff', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Lead Cost" 
                value={summary.totalLeadCost} 
                precision={2}
                prefix="$"
                valueStyle={{ color: '#cf1322', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Transfers" 
                value={summary.totalTransfers}
                valueStyle={{ fontSize: 18 }}
                suffix={<Text type="secondary" style={{ fontSize: 11 }}>({summary.overallTransferRate}%)</Text>}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Policies" 
                value={summary.totalPolicies}
                valueStyle={{ fontSize: 18 }}
                suffix={<Text type="secondary" style={{ fontSize: 11 }}>({summary.overallPolicyRate}%)</Text>}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Revenue" 
                value={summary.totalRevenue} 
                precision={0}
                prefix="$"
                valueStyle={{ color: '#52c41a', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Gross Profit" 
                value={summary.totalGrossProfit} 
                precision={0}
                prefix="$"
                valueStyle={{ color: summary.totalGrossProfit >= 0 ? '#52c41a' : '#cf1322', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Current ROI" 
                value={summary.overallROI} 
                precision={1}
                suffix="%"
                valueStyle={{ color: summary.overallROI >= 0 ? '#52c41a' : '#cf1322', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Card size="small" className="kpi-card" bodyStyle={{ padding: '12px' }}>
              <Statistic 
                title="Proj. ROI" 
                value={summary.projectedROI} 
                precision={1}
                suffix="%"
                valueStyle={{ color: summary.projectedROI >= 0 ? '#52c41a' : '#cf1322', fontSize: 18 }}
                prefix={summary.projectedROI > summary.overallROI ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Maturation Curve & Inventory */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title={<><LineChartOutlined /> Lead Maturation Curve</>} bodyStyle={{ padding: '10px 12px', maxHeight: '380px', overflowY: 'auto' }}>
            {maturationCurve.length > 0 ? (
              <div>
                {maturationCurve.map((bucket, idx) => (
                  <div key={bucket.days_bucket} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{bucket.bucket_label}</Text>
                      <Text strong>{bucket.cumulative_pct}%</Text>
                    </div>
                    <Progress 
                      percent={parseFloat(bucket.cumulative_pct.toString())} 
                      showInfo={false}
                      strokeColor={{
                        '0%': '#1890ff',
                        '100%': '#52c41a'
                      }}
                    />
                  </div>
                ))}
                <Alert 
                  message="Projection Basis" 
                  description={`${maturationCurve[3]?.cumulative_pct || 49}% of transfers occur within 7 days. Projections use this curve to estimate final cohort performance.`}
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                No maturation data available
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={<><DollarOutlined /> Lead Inventory Valuation</>} className="inventory-card" bodyStyle={{ padding: '12px 16px', maxHeight: '380px', overflowY: 'auto' }}>
            {inventory.length > 0 ? (
              <div>
                {inventory.map((bucket) => (
                  <div key={bucket.inventory_bucket} style={{ 
                    marginBottom: 8, 
                    padding: '8px 10px', 
                    background: '#fafafa', 
                    borderRadius: 6,
                    borderLeft: `3px solid ${
                      bucket.inventory_bucket === 'Fresh' ? '#1890ff' :
                      bucket.inventory_bucket === 'Young' ? '#13c2c2' :
                      bucket.inventory_bucket === 'Active' ? '#52c41a' :
                      bucket.inventory_bucket === 'Aging' ? '#faad14' : '#722ed1'
                    }`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <Text strong style={{ fontSize: 12 }}>{bucket.inventory_bucket}</Text>
                        <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>({bucket.age_range})</Text>
                      </div>
                      <Tag style={{ fontSize: 10, padding: '0 4px' }}>{bucket.leads_count?.toLocaleString()}</Tag>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11 }}>
                      <span><Text type="secondary">Cost:</Text> ${bucket.total_cost?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span><Text type="secondary">Proj:</Text> <Text style={{ color: '#52c41a' }}>${bucket.projected_revenue?.toLocaleString()}</Text></span>
                      <span><Text type="secondary">Unreal:</Text> <Text style={{ color: bucket.unrealized_profit >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>${bucket.unrealized_profit?.toLocaleString()}</Text></span>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#f6ffed', borderRadius: 6 }}>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Statistic 
                        title={<span style={{ fontSize: 10 }}>Total Inventory</span>}
                        value={inventory.reduce((s, i) => s + (i.total_cost || 0), 0)} 
                        prefix="$" 
                        precision={0}
                        valueStyle={{ fontSize: 13 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic 
                        title={<span style={{ fontSize: 10 }}>Proj. Yield</span>}
                        value={inventory.reduce((s, i) => s + (i.projected_revenue || 0), 0)} 
                        prefix="$" 
                        precision={0}
                        valueStyle={{ fontSize: 13, color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic 
                        title={<span style={{ fontSize: 10 }}>Unrealized</span>}
                        value={inventory.reduce((s, i) => s + (i.unrealized_profit || 0), 0)} 
                        prefix="$" 
                        precision={0}
                        valueStyle={{ 
                          fontSize: 13, 
                          color: inventory.reduce((s, i) => s + (i.unrealized_profit || 0), 0) >= 0 ? '#52c41a' : '#ff4d4f' 
                        }}
                      />
                    </Col>
                  </Row>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                No inventory data available
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Weekly Cohort Performance */}
      <Card 
        size="small"
        className="cohort-table-card"
        title={<><TeamOutlined /> Weekly Cohort Performance</>}
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '8px', overflow: 'auto' }}
        extra={<Text type="secondary" style={{ fontSize: 11 }}>{weeklyCohorts.length} weeks</Text>}
      >
        <Spin spinning={loading}>
          <Table
            columns={weeklyColumns}
            dataSource={weeklyCohorts}
            rowKey="cohort_week"
            pagination={false}
            scroll={{ x: 1200 }}
            size="small"
            rowClassName={(record) => {
              if (record.projected_roi != null && record.projected_roi > 15) return 'cohort-scale';
              if (record.projected_roi != null && record.projected_roi > -15) return 'cohort-monitor';
              if (record.projected_roi != null) return 'cohort-reduce';
              return 'cohort-watch';
            }}
            summary={() => {
              if (!weeklyCohorts.length) return null;
              const totals = {
                leads: weeklyCohorts.reduce((s, c) => s + (c.leads_bought || 0), 0),
                cost: weeklyCohorts.reduce((s, c) => s + (c.total_lead_cost || 0), 0),
                transfers: weeklyCohorts.reduce((s, c) => s + (c.transfers || 0), 0),
                policies: weeklyCohorts.reduce((s, c) => s + (c.policies || 0), 0),
                revenue: weeklyCohorts.reduce((s, c) => s + (c.revenue || 0), 0),
                profit: weeklyCohorts.reduce((s, c) => s + (c.gross_profit || 0), 0)
              };
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>-</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}><strong>{totals.leads.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>-</Table.Summary.Cell>
                  <Table.Summary.Cell index={5}><strong>${totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={6}><strong>{totals.transfers.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={7}><strong>{totals.policies.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={8}><strong>${totals.revenue.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={9}><strong>{totals.cost > 0 ? ((totals.profit / totals.cost) * 100).toFixed(1) : 0}%</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={10}>-</Table.Summary.Cell>
                  <Table.Summary.Cell index={11}>-</Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Spin>
      </Card>

      {/* Source Performance with SUBID Drill-down */}
      <Card 
        size="small"
        className="source-table-card"
        title={
          <Space size="small">
            <FireOutlined /> Source Performance
            <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 11 }}>
              ({cohortDateRange[0].format('MMM D')} - {cohortDateRange[1].format('MMM D, YYYY')})
            </Text>
          </Space>
        }
        bodyStyle={{ padding: '8px', overflow: 'auto' }}
        extra={
          <Space size="small">
            <Tag color="green" style={{ fontSize: 10 }}>{sourcePerformance.filter(s => s.recommendation === 'SCALE').length} SCALE</Tag>
            <Tag color="orange" style={{ fontSize: 10 }}>{sourcePerformance.filter(s => s.recommendation === 'MONITOR').length} MONITOR</Tag>
            <Tag color="red" style={{ fontSize: 10 }}>{sourcePerformance.filter(s => s.recommendation === 'REDUCE').length} REDUCE</Tag>
          </Space>
        }
      >
        <Alert
          message="Click a row to expand SUBID-level performance"
          type="info"
          showIcon
          style={{ marginBottom: 8, padding: '4px 12px', fontSize: 12 }}
        />
        <Spin spinning={loading}>
          <Table
            columns={sourceColumns}
            dataSource={sourcePerformance}
            rowKey="list_id"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
            scroll={{ x: 1200 }}
            size="small"
            expandable={{
              expandedRowRender: renderExpandedSubids,
              expandedRowKeys: expandedSources,
              onExpand: handleSourceExpand,
              rowExpandable: () => true
            }}
            rowClassName={(record) => `cohort-${record.recommendation?.toLowerCase()}`}
          />
        </Spin>
      </Card>

      {/* Footer */}
      <div style={{ marginTop: 24, padding: 12, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Cohort Revenue Analytics • Maturation-based projections • 
          SCALE: &gt;15% proj. ROI • MONITOR: -15% to 15% • REDUCE: &lt;-15%
        </Text>
      </div>
    </div>
  );
}

