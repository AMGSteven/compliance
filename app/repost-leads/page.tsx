'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Select, Progress, Alert, Typography, Space, Divider, Table, Statistic, Row, Col, Tag, Badge } from 'antd';
import { ReloadOutlined, SendOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SearchOutlined, ThunderboltOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface MismatchData {
  list_id: string;
  description: string;
  lead_campaign_id: string;
  routing_campaign_id: string;
  routing_cadence_id: string;
  token: string;
  affected_leads: number;
  total_internal_leads: number;
  mismatch_percentage: number;
}

interface RepostStatus {
  list_id: string;
  description: string;
  vertical: string;
  correct_campaign_id: string;
  correct_cadence_id: string;
  token: string;
  total_internal_leads: number;
  needs_repost_count: number;
  ready_for_repost: boolean;
  mismatch_breakdown: Array<{
    incorrect_campaign_id: string;
    affected_leads: number;
  }>;
  mismatch_percentage: number;
}

interface RepostProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  completed: boolean;
  estimated_time_remaining?: string;
}

export default function RepostLeadsPage() {
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [allMismatches, setAllMismatches] = useState<MismatchData[]>([]);
  const [status, setStatus] = useState<RepostStatus | null>(null);
  const [progress, setProgress] = useState<RepostProgress | null>(null);
  const [loadingMismatches, setLoadingMismatches] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [reposting, setReposting] = useState(false);

  // Load all mismatches on component mount
  useEffect(() => {
    loadAllMismatches();
  }, []);

  const loadAllMismatches = async () => {
    setLoadingMismatches(true);
    try {
      console.log('🔍 Loading all campaign mismatches...');
      const response = await fetch('/api/repost-leads?action=list_all');
      const result = await response.json();
      
      if (result.success) {
        setAllMismatches(result.data || []);
        console.log(`✅ Found ${result.data?.length || 0} lists with mismatches`);
      } else {
        console.error('Failed to load mismatches:', result.error);
      }
    } catch (error) {
      console.error('Error loading mismatches:', error);
    } finally {
      setLoadingMismatches(false);
    }
  };

  const checkListStatus = async (listId: string) => {
    if (!listId) return;
    
    setLoadingStatus(true);
    try {
      console.log(`🔍 Checking status for list: ${listId}`);
      const response = await fetch(`/api/repost-leads?list_id=${listId}`);
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.data);
        console.log(`✅ Status loaded for ${result.data.description}`);
      } else {
        console.error('Status check failed:', result.error);
        setStatus(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  const startReposting = async () => {
    if (!status) return;
    
    setReposting(true);
    setProgress(null);
    
    try {
      console.log(`🚀 Starting enterprise re-posting for ${status.needs_repost_count} leads...`);
      
      const response = await fetch('/api/repost-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: status.list_id,
          batch_size: 50 // Enterprise batch size
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setProgress(result.progress);
        console.log(`✅ Re-posting completed: ${result.message}`);
        console.log(`📊 Performance: ${result.performance?.throughput_leads_per_second} leads/sec`);
        
        // Refresh data after completion
        await Promise.all([
          loadAllMismatches(),
          checkListStatus(status.list_id)
        ]);
      } else {
        console.error('Re-posting failed:', result.error);
      }
    } catch (error) {
      console.error('Error during re-posting:', error);
    } finally {
      setReposting(false);
    }
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    return progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  };

  const getSeverityColor = (percentage: number) => {
    if (percentage >= 80) return 'red';
    if (percentage >= 50) return 'orange';
    if (percentage >= 20) return 'yellow';
    return 'blue';
  };

  const mismatchColumns = [
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
      width: 200,
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Affected Leads',
      dataIndex: 'affected_leads',
      key: 'affected_leads',
      width: 120,
      render: (count: number) => <Text strong>{count.toLocaleString()}</Text>
    },
    {
      title: 'Mismatch %',
      dataIndex: 'mismatch_percentage',
      key: 'mismatch_percentage',
      width: 120,
      render: (percentage: number) => (
        <Tag color={getSeverityColor(percentage)}>
          {percentage.toFixed(1)}%
        </Tag>
      )
    },
    {
      title: 'Current Campaign ID',
      dataIndex: 'lead_campaign_id',
      key: 'lead_campaign_id',
      width: 200,
      render: (text: string) => <Text code style={{ color: '#ff4d4f' }}>{text}</Text>
    },
    {
      title: 'Correct Campaign ID',
      dataIndex: 'routing_campaign_id',
      key: 'routing_campaign_id',
      width: 200,
      render: (text: string) => <Text code style={{ color: '#52c41a' }}>{text}</Text>
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: any, record: MismatchData) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => {
            setSelectedListId(record.list_id);
            checkListStatus(record.list_id);
          }}
        >
          Select & Fix
        </Button>
      )
    }
  ];

  const errorColumns = [
    {
      title: 'Error Details',
      dataIndex: 'error',
      key: 'error',
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Title level={2}>
        🏢 Enterprise Lead Re-posting Tool
        <Badge count={allMismatches.length} style={{ marginLeft: '16px' }} />
      </Title>
      <Paragraph>
        Enterprise-grade tool for detecting and fixing campaign ID mismatches across all list routings.
        Automatically identifies discrepancies and re-posts leads with correct routing information.
      </Paragraph>

      {/* Global Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Lists with Mismatches"
              value={allMismatches.length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: allMismatches.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Affected Leads"
              value={allMismatches.reduce((sum, item) => sum + item.affected_leads, 0)}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Highest Impact List"
              value={allMismatches.length > 0 ? allMismatches[0]?.affected_leads || 0 : 0}
              suffix="leads"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Button 
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadAllMismatches}
              loading={loadingMismatches}
              block
            >
              Refresh Scan
            </Button>
          </Card>
        </Col>
      </Row>

      {/* Mismatch Detection Results */}
      <Card 
        title={
          <Space>
            <SearchOutlined />
            <span>Campaign ID Mismatch Detection</span>
            <Tag color="blue">Enterprise Scan</Tag>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        {allMismatches.length > 0 ? (
          <>
            <Alert
              message="Campaign ID Mismatches Detected"
              description={`Found ${allMismatches.length} lists with campaign ID mismatches affecting ${allMismatches.reduce((sum, item) => sum + item.affected_leads, 0).toLocaleString()} leads. Select a list below to fix the mismatches.`}
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            
            <Table
              columns={mismatchColumns}
              dataSource={allMismatches}
              rowKey="list_id"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: true }}
              loading={loadingMismatches}
              size="small"
            />
          </>
        ) : (
          <Alert
            message="No Campaign ID Mismatches Found"
            description="All list routings have matching campaign IDs with their leads. No re-posting required."
            type="success"
            showIcon
          />
        )}
      </Card>

      {/* List Selection and Status */}
      <Card 
        title={
          <Space>
            <DatabaseOutlined />
            <span>List Analysis & Re-posting</span>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Select List to Fix:</Text>
            <Select
              value={selectedListId}
              onChange={(value) => {
                setSelectedListId(value);
                checkListStatus(value);
              }}
              placeholder="Choose a list from the mismatches above"
              style={{ marginLeft: '8px', width: '400px' }}
              showSearch
              optionFilterProp="children"
            >
              {allMismatches.map(mismatch => (
                <Option key={mismatch.list_id} value={mismatch.list_id}>
                  {mismatch.description} ({mismatch.affected_leads} leads)
                </Option>
              ))}
            </Select>
            <Button 
              type="default"
              icon={<SearchOutlined />}
              onClick={() => selectedListId && checkListStatus(selectedListId)}
              loading={loadingStatus}
              style={{ marginLeft: '8px' }}
              disabled={!selectedListId}
            >
              Analyze List
            </Button>
          </div>

          {status && (
            <div style={{ marginTop: '16px' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Alert
                    message="List Analysis Results"
                    description={
                      <div>
                        <p><strong>Description:</strong> {status.description}</p>
                        <p><strong>Vertical:</strong> <Tag>{status.vertical}</Tag></p>
                        <p><strong>Total Internal Leads:</strong> {status.total_internal_leads.toLocaleString()}</p>
                        <p><strong>Needs Re-posting:</strong> <Text type={status.needs_repost_count > 0 ? "danger" : "success"} strong>{status.needs_repost_count.toLocaleString()}</Text> leads ({status.mismatch_percentage}%)</p>
                      </div>
                    }
                    type={status.ready_for_repost ? "warning" : "success"}
                    showIcon
                  />
                </Col>
                <Col span={12}>
                  <Card size="small" title="Campaign ID Mapping">
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>Incorrect ID(s):</Text>
                      {status.mismatch_breakdown.map((item, index) => (
                        <div key={index} style={{ marginLeft: '8px' }}>
                          <Text code style={{ color: '#ff4d4f' }}>{item.incorrect_campaign_id}</Text>
                          <Text type="secondary"> ({item.affected_leads} leads)</Text>
                        </div>
                      ))}
                    </div>
                    <div>
                      <Text strong>Correct ID:</Text>
                      <div style={{ marginLeft: '8px' }}>
                        <Text code style={{ color: '#52c41a' }}>{status.correct_campaign_id}</Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </Space>
      </Card>

      {/* Re-posting Controls */}
      {status && status.ready_for_repost && (
        <Card 
          title={
            <Space>
              <ThunderboltOutlined />
              <span>Enterprise Re-posting</span>
              <Tag color="red">Action Required</Tag>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              message="Ready for Enterprise Re-posting"
              description={
                <div>
                  <p><strong>{status.needs_repost_count.toLocaleString()} leads</strong> will be re-posted to the internal dialer with corrected campaign information.</p>
                  <p>This process will:</p>
                  <ul>
                    <li>Post leads to internal dialer API with correct campaign_id: <Text code>{status.correct_campaign_id}</Text></li>
                    <li>Update database records with correct campaign_id</li>
                    <li>Process in optimized batches of 50 leads</li>
                    <li>Provide real-time progress tracking</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
            />
            
            <Button 
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={startReposting}
              loading={reposting}
              disabled={!status.ready_for_repost}
              danger
            >
              🚀 Start Enterprise Re-posting ({status.needs_repost_count.toLocaleString()} Leads)
            </Button>
          </Space>
        </Card>
      )}

      {/* Progress Monitoring */}
      {progress && (
        <Card 
          title={
            <Space>
              <ThunderboltOutlined />
              <span>Enterprise Processing Progress</span>
              {progress.completed && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Progress 
              percent={getProgressPercentage()}
              status={progress.completed ? 'success' : 'active'}
              format={() => `${progress.processed.toLocaleString()}/${progress.total.toLocaleString()}`}
              strokeWidth={10}
            />
            
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Processed"
                  value={progress.processed}
                  suffix={`/ ${progress.total}`}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Successful"
                  value={progress.successful}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Failed"
                  value={progress.failed}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="ETA"
                  value={progress.estimated_time_remaining || 'Calculating...'}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
            </Row>

            {progress.completed && (
              <Alert
                message="Enterprise Re-posting Completed"
                description={`Successfully re-posted ${progress.successful.toLocaleString()} out of ${progress.total.toLocaleString()} leads. ${progress.failed} leads failed.`}
                type={progress.failed === 0 ? "success" : "warning"}
                showIcon
              />
            )}

            {progress.errors.length > 0 && (
              <div>
                <Divider />
                <Title level={4}>Error Analysis ({progress.errors.length})</Title>
                <Table
                  dataSource={progress.errors.map((error, index) => ({ key: index, error }))}
                  columns={errorColumns}
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* Enterprise Documentation */}
      <Card title="🏢 Enterprise Features" type="inner">
        <Row gutter={16}>
          <Col span={12}>
            <Title level={5}>🔍 Automated Detection</Title>
            <ul>
              <li>Scans all active list routings for campaign ID mismatches</li>
              <li>Uses optimized RPC functions for enterprise performance</li>
              <li>Real-time mismatch percentage calculation</li>
              <li>Comprehensive impact analysis</li>
            </ul>
          </Col>
          <Col span={12}>
            <Title level={5}>⚡ High-Performance Processing</Title>
            <ul>
              <li>Batch processing with 50 leads per batch</li>
              <li>Parallel API calls within batches</li>
              <li>Optimized database updates using RPC functions</li>
              <li>Real-time progress tracking with ETA</li>
            </ul>
          </Col>
        </Row>
        
        <Divider />
        
        <Alert
          message="Enterprise Workflow"
          description={
            <ol>
              <li><strong>Automatic Scan:</strong> System detects all campaign ID mismatches on page load</li>
              <li><strong>List Selection:</strong> Choose any list with mismatches from the table</li>
              <li><strong>Impact Analysis:</strong> Review detailed breakdown of affected leads</li>
              <li><strong>Enterprise Re-posting:</strong> High-performance batch processing with monitoring</li>
              <li><strong>Verification:</strong> Automatic refresh to confirm fixes</li>
            </ol>
          }
          type="info"
          style={{ marginTop: '16px' }}
        />
      </Card>
    </div>
  );
}