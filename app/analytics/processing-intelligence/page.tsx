'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Button, Select, DatePicker, Space, Table, Spin, message, Alert, Statistic, Progress, Tag, Tooltip } from 'antd';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  FireOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface ProcessingData {
  processing_date: string;
  list_id: string;
  description: string;
  total_processed: number;
  same_day_processed: number;
  cross_day_processed: number;
  avg_processing_delay_hours: number;
  generation_date_breakdown: any;
  processing_efficiency_score: number;
}

interface ProcessingMetadata {
  query_type: string;
  processing_type: string;
  date_range: { start: string; end: string };
  timezone: string;
  lists_analyzed: number;
  totals: {
    total_processed: number;
    same_day_processed: number;
    cross_day_processed: number;
    same_day_percentage: number;
    cross_day_percentage: number;
    avg_processing_delay_hours: number;
    processing_efficiency: number;
  };
  explanation: string;
}

export default function ProcessingIntelligencePage() {
  const [processingData, setProcessingData] = useState<ProcessingData[]>([]);
  const [metadata, setMetadata] = useState<ProcessingMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingType, setProcessingType] = useState<'transfers' | 'policies'>('transfers');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days').startOf('day'),
    dayjs().endOf('day')
  ]);

  useEffect(() => {
    fetchProcessingData();
  }, [processingType, dateRange]);

  const fetchProcessingData = async () => {
    try {
      setLoading(true);
      
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      console.log('⚡ Fetching processing intelligence data:', { startDate, endDate, processingType });

      const params = new URLSearchParams({
        startDate,
        endDate,
        processingType
      });

      const response = await fetch(`/api/metrics/processing-performance?${params}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch processing data');
      }

      setProcessingData(result.data || []);
      setMetadata(result.metadata);
      
      message.success(`✅ Loaded ${result.data?.length || 0} processing records`);

    } catch (error) {
      console.error('❌ Error fetching processing data:', error);
      message.error(`Failed to fetch processing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!processingData.length) {
      message.warning('No processing data to export');
      return;
    }

    const csvContent = [
      'Processing Date,List ID,Description,Total Processed,Same Day Processed,Cross Day Processed,Same Day %,Avg Delay Hours,Efficiency Score',
      ...processingData.map(item => [
        item.processing_date,
        item.list_id,
        `"${item.description}"`,
        item.total_processed,
        item.same_day_processed,
        item.cross_day_processed,
        item.total_processed > 0 ? ((item.same_day_processed / item.total_processed) * 100).toFixed(2) : '0',
        item.avg_processing_delay_hours.toFixed(2),
        item.processing_efficiency_score.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `processing-intelligence-${processingType}-${dateRange[0].format('YYYY-MM-DD')}-to-${dateRange[1].format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return '#52c41a';
    if (efficiency >= 50) return '#faad14';
    return '#ff4d4f';
  };

  const getDelayColor = (hours: number) => {
    if (hours <= 4) return '#52c41a';
    if (hours <= 24) return '#faad14';
    return '#ff4d4f';
  };

  const columns = [
    {
      title: 'Processing Date',
      dataIndex: 'processing_date',
      key: 'processing_date',
      width: 140,
      render: (date: string) => (
        <Text strong>{dayjs(date).format('MMM D, YYYY')}</Text>
      ),
      sorter: (a: ProcessingData, b: ProcessingData) => dayjs(a.processing_date).unix() - dayjs(b.processing_date).unix(),
    },
    {
      title: 'List',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Total Processed',
      dataIndex: 'total_processed',
      key: 'total_processed',
      width: 120,
      render: (value: number) => (
        <Statistic value={value} valueStyle={{ fontSize: '14px' }} />
      ),
      sorter: (a: ProcessingData, b: ProcessingData) => a.total_processed - b.total_processed,
    },
    {
      title: 'Same Day',
      dataIndex: 'same_day_processed',
      key: 'same_day_processed',
      width: 100,
      render: (value: number, record: ProcessingData) => {
        const percentage = record.total_processed > 0 ? (value / record.total_processed) * 100 : 0;
        return (
          <div>
            <Statistic value={value} valueStyle={{ fontSize: '14px', color: '#52c41a' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {percentage.toFixed(1)}%
            </Text>
          </div>
        );
      },
      sorter: (a: ProcessingData, b: ProcessingData) => a.same_day_processed - b.same_day_processed,
    },
    {
      title: 'Cross Day',
      dataIndex: 'cross_day_processed',
      key: 'cross_day_processed',
      width: 100,
      render: (value: number, record: ProcessingData) => {
        const percentage = record.total_processed > 0 ? (value / record.total_processed) * 100 : 0;
        return (
          <div>
            <Statistic value={value} valueStyle={{ fontSize: '14px', color: '#ff4d4f' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {percentage.toFixed(1)}%
            </Text>
          </div>
        );
      },
      sorter: (a: ProcessingData, b: ProcessingData) => a.cross_day_processed - b.cross_day_processed,
    },
    {
      title: 'Avg Delay',
      dataIndex: 'avg_processing_delay_hours',
      key: 'avg_processing_delay_hours',
      width: 120,
      render: (hours: number) => (
        <Tooltip title={`${(hours / 24).toFixed(1)} days`}>
          <Tag color={getDelayColor(hours)}>
            {hours.toFixed(1)}h
          </Tag>
        </Tooltip>
      ),
      sorter: (a: ProcessingData, b: ProcessingData) => a.avg_processing_delay_hours - b.avg_processing_delay_hours,
    },
    {
      title: 'Efficiency Score',
      dataIndex: 'processing_efficiency_score',
      key: 'processing_efficiency_score',
      width: 140,
      render: (score: number) => (
        <div>
          <Progress 
            percent={score} 
            strokeColor={getEfficiencyColor(score)}
            size="small"
            format={percent => `${percent?.toFixed(0)}%`}
          />
        </div>
      ),
      sorter: (a: ProcessingData, b: ProcessingData) => a.processing_efficiency_score - b.processing_efficiency_score,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: any, record: ProcessingData) => {
        const efficiency = record.processing_efficiency_score;
        if (efficiency >= 80) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>Optimal</Tag>;
        } else if (efficiency >= 50) {
          return <Tag color="warning" icon={<WarningOutlined />}>Needs Attention</Tag>;
        } else {
          return <Tag color="error" icon={<WarningOutlined />}>Critical</Tag>;
        }
      },
    },
  ];

  const getOverallHealthStatus = () => {
    if (!metadata) return { status: 'unknown', message: 'Loading...', type: 'info' as const };
    
    const efficiency = metadata.totals.processing_efficiency;
    if (efficiency >= 80) {
      return { 
        status: 'optimal', 
        message: 'Processing pipeline is performing optimally with excellent same-day processing rates.',
        type: 'success' as const
      };
    } else if (efficiency >= 50) {
      return { 
        status: 'attention', 
        message: 'Processing pipeline shows moderate delays. Consider optimization opportunities.',
        type: 'warning' as const
      };
    } else {
      return { 
        status: 'critical', 
        message: 'Processing pipeline has significant delays impacting attribution accuracy. Immediate optimization required.',
        type: 'error' as const
      };
    }
  };

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
          <ThunderboltOutlined /> Processing Intelligence
        </Title>
        <Paragraph style={{ fontSize: '16px', color: '#666', maxWidth: '800px' }}>
          Analyze processing pipeline efficiency, identify bottlenecks, and discover optimization opportunities. 
          This view shows processing performance based on actual processing dates, revealing temporal disconnects 
          from lead generation that impact attribution accuracy.
        </Paragraph>
      </div>

      {/* Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Processing Type</Text>
              <Select
                value={processingType}
                onChange={(value) => setProcessingType(value)}
                style={{ width: '100%' }}
              >
                <Option value="transfers">Transfers</Option>
                <Option value="policies">Policies</Option>
              </Select>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Processing Date Range</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]]);
                  }
                }}
                style={{ width: '100%' }}
              />
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Analysis Focus</Text>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Shows {processingType} processed during selected period, 
                regardless of original lead generation date
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
                  onClick={fetchProcessingData}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={exportToCSV}
                  disabled={!processingData.length}
                >
                  Export
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Overall Health Status */}
      {metadata && (
        <Alert
          message={`Processing Pipeline Health: ${getOverallHealthStatus().status.toUpperCase()}`}
          description={getOverallHealthStatus().message}
          type={getOverallHealthStatus().type}
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Summary Statistics */}
      {metadata && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={4}>
            <Card>
              <Statistic
                title={`Total ${processingType.charAt(0).toUpperCase() + processingType.slice(1)}`}
                value={metadata.totals.total_processed}
                valueStyle={{ color: '#1890ff' }}
                prefix={<DashboardOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Same Day Processed"
                value={metadata.totals.same_day_processed}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {metadata.totals.same_day_percentage.toFixed(1)}% of total
              </Text>
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Cross Day Processed"
                value={metadata.totals.cross_day_processed}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<WarningOutlined />}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {metadata.totals.cross_day_percentage.toFixed(1)}% of total
              </Text>
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Avg Processing Delay"
                value={metadata.totals.avg_processing_delay_hours}
                precision={1}
                valueStyle={{ color: getDelayColor(metadata.totals.avg_processing_delay_hours) }}
                suffix="hours"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Processing Efficiency"
                value={metadata.totals.processing_efficiency}
                precision={1}
                valueStyle={{ color: getEfficiencyColor(metadata.totals.processing_efficiency) }}
                suffix="%"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Lists Analyzed"
                value={metadata.lists_analyzed}
                valueStyle={{ color: '#722ed1' }}
                suffix="lists"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Efficiency Breakdown */}
      {metadata && (
        <Card style={{ marginBottom: '24px' }}>
          <Title level={3}>
            <FireOutlined /> Processing Efficiency Analysis
          </Title>
          <Row gutter={16}>
            <Col span={16}>
              <div style={{ marginBottom: '16px' }}>
                <Title level={4}>Same-Day vs Cross-Day Processing</Title>
                <Progress
                  percent={metadata.totals.same_day_percentage}
                  strokeColor="#52c41a"
                  trailColor="#ff4d4f"
                />
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <Text><span style={{ color: '#52c41a' }}>●</span> Same Day: {metadata.totals.same_day_percentage.toFixed(1)}% ({metadata.totals.same_day_processed.toLocaleString()})</Text>
                  <Text><span style={{ color: '#ff4d4f' }}>●</span> Cross Day: {metadata.totals.cross_day_percentage.toFixed(1)}% ({metadata.totals.cross_day_processed.toLocaleString()})</Text>
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={4}>Efficiency Score</Title>
                <Progress
                  type="circle"
                  percent={metadata.totals.processing_efficiency}
                  strokeColor={getEfficiencyColor(metadata.totals.processing_efficiency)}
                  format={percent => `${percent?.toFixed(0)}%`}
                />
                <div style={{ marginTop: '16px' }}>
                  <Text strong style={{ color: getEfficiencyColor(metadata.totals.processing_efficiency) }}>
                    {metadata.totals.processing_efficiency >= 80 ? 'Excellent' :
                     metadata.totals.processing_efficiency >= 50 ? 'Needs Improvement' : 'Critical'}
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Processing Data Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined /> Processing Performance Details
          </Title>
          <Text type="secondary">
            Showing {processingData.length} processing records with efficiency analysis
          </Text>
        </div>
        
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={processingData}
            rowKey={(record) => `${record.processing_date}-${record.list_id}`}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
            }}
            scroll={{ x: 1200 }}
            summary={() => {
              if (!processingData.length) return null;
              
              const totalProcessed = processingData.reduce((sum, item) => sum + item.total_processed, 0);
              const totalSameDay = processingData.reduce((sum, item) => sum + item.same_day_processed, 0);
              const totalCrossDay = processingData.reduce((sum, item) => sum + item.cross_day_processed, 0);
              const avgDelay = processingData.reduce((sum, item) => sum + item.avg_processing_delay_hours, 0) / processingData.length;
              const avgEfficiency = processingData.reduce((sum, item) => sum + item.processing_efficiency_score, 0) / processingData.length;
              
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><strong>All Lists</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><strong>{totalProcessed.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <strong>{totalSameDay.toLocaleString()}</strong>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {totalProcessed > 0 ? ((totalSameDay / totalProcessed) * 100).toFixed(1) : '0.0'}%
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <strong>{totalCrossDay.toLocaleString()}</strong>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {totalProcessed > 0 ? ((totalCrossDay / totalProcessed) * 100).toFixed(1) : '0.0'}%
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}><strong>{avgDelay.toFixed(1)}h</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={6}><strong>{avgEfficiency.toFixed(1)}%</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={7}><strong>-</strong></Table.Summary.Cell>
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
          Processing intelligence powered by temporal attribution analysis • 
          EST timezone consistency • Real-time bottleneck identification
        </Text>
      </div>
    </div>
  );
} 