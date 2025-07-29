'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Button, Select, DatePicker, Space, Table, Spin, message, Alert, Statistic, Progress, Tag } from 'antd';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  TeamOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  FireOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface CohortData {
  generation_date: string;
  list_id: string;
  description: string;
  leads_generated: number;
  transfers_to_date: number;
  policies_to_date: number;
  transfer_rate: number;
  policy_rate: number;
  avg_days_to_transfer: number;
  avg_days_to_policy: number;
  processing_lag_distribution: {
    same_day: number;
    next_day: number;
    multi_day: number;
    never_processed: number;
  };
  cohort_maturity_days: number;
  revenue_to_date: number;
}

interface CohortMetadata {
  query_type: string;
  generation_period: { start: string; end: string };
  analysis_cutoff_date: string;
  timezone: string;
  cohorts_analyzed: number;
  totals: {
    leads_generated: number;
    transfers_to_date: number;
    policies_to_date: number;
    revenue_to_date: number;
    overall_transfer_rate: number;
    overall_policy_rate: number;
  };
  processing_lag_analysis: {
    same_day: number;
    next_day: number;
    multi_day: number;
    never_processed: number;
    same_day_percentage: number;
    next_day_percentage: number;
    multi_day_percentage: number;
    never_processed_percentage: number;
  };
  explanation: string;
}

export default function CohortAttributionPage() {
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [metadata, setMetadata] = useState<CohortMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [generationDateRange, setGenerationDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days').startOf('day'),
    dayjs().subtract(1, 'day').endOf('day')
  ]);
  const [analysisCutoffDate, setAnalysisCutoffDate] = useState<Dayjs>(dayjs());

  useEffect(() => {
    fetchCohortData();
  }, [generationDateRange, analysisCutoffDate]);

  const fetchCohortData = async () => {
    try {
      setLoading(true);
      
      const startDate = generationDateRange[0].format('YYYY-MM-DD');
      const endDate = generationDateRange[1].format('YYYY-MM-DD');
      const cutoffDate = analysisCutoffDate.format('YYYY-MM-DD');

      console.log('🎯 Fetching cohort attribution data:', { startDate, endDate, cutoffDate });

      const params = new URLSearchParams({
        generationStartDate: startDate,
        generationEndDate: endDate,
        analysisCutoffDate: cutoffDate
      });

      const response = await fetch(`/api/metrics/cohort-attribution?${params}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch cohort data');
      }

      setCohortData(result.data || []);
      setMetadata(result.metadata);
      
      message.success(`✅ Loaded ${result.data?.length || 0} cohorts for analysis`);

    } catch (error) {
      console.error('❌ Error fetching cohort data:', error);
      message.error(`Failed to fetch cohort data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!cohortData.length) {
      message.warning('No cohort data to export');
      return;
    }

    const csvContent = [
      'Generation Date,List ID,Description,Leads Generated,Transfers to Date,Policies to Date,Transfer Rate,Policy Rate,Avg Days to Transfer,Cohort Maturity Days,Revenue to Date,Same Day,Next Day,Multi Day,Never Processed',
      ...cohortData.map(item => [
        item.generation_date,
        item.list_id,
        `"${item.description}"`,
        item.leads_generated,
        item.transfers_to_date,
        item.policies_to_date,
        item.transfer_rate,
        item.policy_rate,
        item.avg_days_to_transfer,
        item.cohort_maturity_days,
        item.revenue_to_date,
        item.processing_lag_distribution.same_day,
        item.processing_lag_distribution.next_day,
        item.processing_lag_distribution.multi_day,
        item.processing_lag_distribution.never_processed
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-attribution-${generationDateRange[0].format('YYYY-MM-DD')}-to-${generationDateRange[1].format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getProcessingEfficiencyColor = (lagDistribution: CohortData['processing_lag_distribution']) => {
    const sameDay = lagDistribution.same_day;
    const total = sameDay + lagDistribution.next_day + lagDistribution.multi_day;
    if (total === 0) return '#999';
    
    const sameDayRate = (sameDay / total) * 100;
    if (sameDayRate >= 70) return '#52c41a';
    if (sameDayRate >= 30) return '#faad14';
    return '#ff4d4f';
  };

  const columns = [
    {
      title: 'Generation Date',
      dataIndex: 'generation_date',
      key: 'generation_date',
      width: 120,
      render: (date: string) => (
        <Text strong>{dayjs(date).format('MMM D, YYYY')}</Text>
      ),
      sorter: (a: CohortData, b: CohortData) => dayjs(a.generation_date).unix() - dayjs(b.generation_date).unix(),
    },
    {
      title: 'List',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Generated',
      dataIndex: 'leads_generated',
      key: 'leads_generated',
      width: 100,
      render: (value: number) => (
        <Statistic value={value} valueStyle={{ fontSize: '14px' }} />
      ),
      sorter: (a: CohortData, b: CohortData) => a.leads_generated - b.leads_generated,
    },
    {
      title: 'Transfers',
      dataIndex: 'transfers_to_date',
      key: 'transfers_to_date',
      width: 100,
      render: (value: number, record: CohortData) => (
        <div>
          <Statistic value={value} valueStyle={{ fontSize: '14px', color: '#1890ff' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.transfer_rate.toFixed(1)}%
          </Text>
        </div>
      ),
      sorter: (a: CohortData, b: CohortData) => a.transfers_to_date - b.transfers_to_date,
    },
    {
      title: 'Policies',
      dataIndex: 'policies_to_date',
      key: 'policies_to_date',
      width: 100,
      render: (value: number, record: CohortData) => (
        <div>
          <Statistic value={value} valueStyle={{ fontSize: '14px', color: '#52c41a' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.policy_rate.toFixed(1)}%
          </Text>
        </div>
      ),
      sorter: (a: CohortData, b: CohortData) => a.policies_to_date - b.policies_to_date,
    },
    {
      title: 'Avg Days to Transfer',
      dataIndex: 'avg_days_to_transfer',
      key: 'avg_days_to_transfer',
      width: 140,
      render: (value: number) => (
        <Tag color={value <= 1 ? 'green' : value <= 3 ? 'orange' : 'red'}>
          {value ? value.toFixed(1) : 'N/A'} days
        </Tag>
      ),
      sorter: (a: CohortData, b: CohortData) => (a.avg_days_to_transfer || 0) - (b.avg_days_to_transfer || 0),
    },
    {
      title: 'Processing Pattern',
      dataIndex: 'processing_lag_distribution',
      key: 'processing_lag_distribution',
      width: 200,
      render: (lagDistribution: CohortData['processing_lag_distribution'], record: CohortData) => {
        const total = lagDistribution.same_day + lagDistribution.next_day + lagDistribution.multi_day;
        if (total === 0) return <Text type="secondary">No processing</Text>;
        
        const sameDayPct = (lagDistribution.same_day / total) * 100;
        const nextDayPct = (lagDistribution.next_day / total) * 100;
        const multiDayPct = (lagDistribution.multi_day / total) * 100;
        
        return (
          <div>
            <div style={{ marginBottom: '4px' }}>
              <Progress 
                percent={100}
                strokeColor={{
                  '0%': '#52c41a',
                  [`${sameDayPct}%`]: '#52c41a',
                  [`${sameDayPct + nextDayPct}%`]: '#faad14',
                  '100%': '#ff4d4f'
                }}
                showInfo={false}
                size="small"
              />
            </div>
            <div style={{ fontSize: '11px' }}>
              <Text style={{ color: '#52c41a' }}>Same: {sameDayPct.toFixed(0)}%</Text>
              <Text style={{ color: '#faad14', marginLeft: '8px' }}>Next: {nextDayPct.toFixed(0)}%</Text>
              <Text style={{ color: '#ff4d4f', marginLeft: '8px' }}>Multi: {multiDayPct.toFixed(0)}%</Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Maturity',
      dataIndex: 'cohort_maturity_days',
      key: 'cohort_maturity_days', 
      width: 100,
      render: (value: number) => (
        <Text strong>{value} days</Text>
      ),
      sorter: (a: CohortData, b: CohortData) => a.cohort_maturity_days - b.cohort_maturity_days,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue_to_date',
      key: 'revenue_to_date',
      width: 100,
      render: (value: number) => (
        <Statistic 
          value={value} 
          precision={0}
          prefix="$"
          valueStyle={{ fontSize: '14px', color: '#13c2c2' }} 
        />
      ),
      sorter: (a: CohortData, b: CohortData) => a.revenue_to_date - b.revenue_to_date,
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link href="/analytics">
          <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: '16px' }}>
            Back to Analytics
          </Button>
        </Link>
        
        <Title level={1}>
          <TeamOutlined /> Cohort Attribution Analysis
          <TrophyOutlined style={{ marginLeft: '8px', color: '#faad14' }} />
        </Title>
        <Paragraph style={{ fontSize: '16px', color: '#666', maxWidth: '800px' }}>
          Track leads from their generation date to eventual processing outcomes. This cross-temporal analysis 
          solves attribution problems by showing true conversion performance over time, separating lead generation 
          performance from processing delays.
        </Paragraph>
      </div>

      {/* Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Generation Period</Text>
              <RangePicker
                value={generationDateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setGenerationDateRange([dates[0], dates[1]]);
                  }
                }}
                style={{ width: '100%' }}
              />
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Analysis Cutoff Date</Text>
              <DatePicker
                value={analysisCutoffDate}
                onChange={(date) => {
                  if (date) {
                    setAnalysisCutoffDate(date);
                  }
                }}
                style={{ width: '100%' }}
              />
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Cohort Maturity</Text>
              <Text code style={{ display: 'block', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                {generationDateRange && analysisCutoffDate ? 
                  `${analysisCutoffDate.diff(generationDateRange[1], 'days')} days` : 
                  'Select dates'
                }
              </Text>
            </Space>
          </Col>
          <Col span={4}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Actions</Text>
              <Space>
                <Button 
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={fetchCohortData}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={exportToCSV}
                  disabled={!cohortData.length}
                >
                  Export
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary Statistics */}
      {metadata && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="Total Generated"
                value={metadata.totals.leads_generated}
                valueStyle={{ color: '#1890ff' }}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Transfers to Date"
                value={metadata.totals.transfers_to_date}
                valueStyle={{ color: '#52c41a' }}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Overall Transfer Rate"
                value={metadata.totals.overall_transfer_rate}
                precision={2}
                valueStyle={{ color: '#722ed1' }}
                suffix="%"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Policy Conversion"
                value={metadata.totals.overall_policy_rate}
                precision={2}
                valueStyle={{ color: '#fa8c16' }}
                suffix="%"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Revenue Generated"
                value={metadata.totals.revenue_to_date}
                precision={0}
                valueStyle={{ color: '#13c2c2' }}
                prefix="$"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Cohorts Analyzed"
                value={metadata.cohorts_analyzed}
                valueStyle={{ color: '#cf1322' }}
                suffix="cohorts"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Processing Lag Analysis */}
      {metadata && (
        <Card style={{ marginBottom: '24px' }}>
          <Title level={3}>
            <ClockCircleOutlined /> Processing Lag Analysis
          </Title>
          <Row gutter={16}>
            <Col span={16}>
              <div style={{ marginBottom: '16px' }}>
                <Title level={4}>Cross-Day Processing Pattern</Title>
                <Progress
                  percent={100}
                  strokeColor={{
                    '0%': '#52c41a',
                    [`${metadata.processing_lag_analysis.same_day_percentage}%`]: '#52c41a',
                    [`${metadata.processing_lag_analysis.same_day_percentage + metadata.processing_lag_analysis.next_day_percentage}%`]: '#faad14',
                    '100%': '#ff4d4f'
                  }}
                />
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <Text><span style={{ color: '#52c41a' }}>●</span> Same Day: {metadata.processing_lag_analysis.same_day_percentage.toFixed(1)}%</Text>
                  <Text><span style={{ color: '#faad14' }}>●</span> Next Day: {metadata.processing_lag_analysis.next_day_percentage.toFixed(1)}%</Text>
                  <Text><span style={{ color: '#ff4d4f' }}>●</span> Multi-Day: {metadata.processing_lag_analysis.multi_day_percentage.toFixed(1)}%</Text>
                  <Text><span style={{ color: '#999' }}>●</span> Never Processed: {metadata.processing_lag_analysis.never_processed_percentage.toFixed(1)}%</Text>
                </div>
              </div>
            </Col>
            <Col span={8}>
              <Alert
                message="Temporal Attribution Impact"
                description={
                  metadata.processing_lag_analysis.same_day_percentage < 50 
                    ? "🚨 High cross-day processing detected! Traditional attribution methods will be highly inaccurate."
                    : metadata.processing_lag_analysis.same_day_percentage < 80
                    ? "⚠️ Moderate processing delays detected. Temporal attribution provides significant value."
                    : "✅ Good same-day processing rate. Temporal attribution ensures precision."
                }
                type={
                  metadata.processing_lag_analysis.same_day_percentage < 50 ? 'error' :
                  metadata.processing_lag_analysis.same_day_percentage < 80 ? 'warning' : 'success'
                }
                showIcon
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Cohort Data Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <FireOutlined /> Cohort Performance Details
          </Title>
          <Text type="secondary">
            Showing {cohortData.length} cohorts with cross-temporal attribution
          </Text>
        </div>
        
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={cohortData}
            rowKey={(record) => `${record.generation_date}-${record.list_id}`}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} cohorts`,
            }}
            scroll={{ x: 1200 }}
            summary={() => {
              if (!cohortData.length) return null;
              
              const totalGenerated = cohortData.reduce((sum, item) => sum + item.leads_generated, 0);
              const totalTransfers = cohortData.reduce((sum, item) => sum + item.transfers_to_date, 0);
              const totalPolicies = cohortData.reduce((sum, item) => sum + item.policies_to_date, 0);
              const totalRevenue = cohortData.reduce((sum, item) => sum + item.revenue_to_date, 0);
              
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><strong>All Cohorts</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><strong>{totalGenerated.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <strong>{totalTransfers.toLocaleString()}</strong>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {totalGenerated > 0 ? ((totalTransfers / totalGenerated) * 100).toFixed(1) : '0.0'}%
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <strong>{totalPolicies.toLocaleString()}</strong>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {totalGenerated > 0 ? ((totalPolicies / totalGenerated) * 100).toFixed(1) : '0.0'}%
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}><strong>-</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={6}><strong>-</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={7}><strong>-</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={8}><strong>${totalRevenue.toLocaleString()}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Spin>
      </Card>

      {/* Footer */}
      <div style={{ 
        marginTop: '32px', 
        padding: '16px', 
        background: '#fafafa', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <Text type="secondary">
          Cross-temporal attribution analysis powered by enterprise SQL functions • 
          EST timezone consistency • Real-time processing lag detection
        </Text>
      </div>
    </div>
  );
} 