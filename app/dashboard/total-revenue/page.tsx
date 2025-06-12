'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Spin, Statistic, Row, Col } from 'antd';
import { DollarOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function TotalRevenuePage() {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [method, setMethod] = useState<string>('');

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/total-revenue', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRevenueData(result.data || []);
        setSummary(result.summary || {});
        setMethod(result.method || 'unknown');
      } else {
        console.error('Error fetching revenue data:', result.error);
        alert('Error fetching revenue data: ' + result.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
    },
    {
      title: 'Campaign ID',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
    },
    {
      title: 'Bid Amount',
      dataIndex: 'bid_amount',
      key: 'bid_amount',
      render: (value: number) => `$${value.toFixed(2)}`
    },
    {
      title: 'Lead Count',
      dataIndex: 'lead_count',
      key: 'lead_count',
      sorter: (a: any, b: any) => a.lead_count - b.lead_count
    },
    {
      title: 'Total Revenue',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      render: (value: number) => `$${value.toFixed(2)}`,
      sorter: (a: any, b: any) => a.total_revenue - b.total_revenue
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>
        Total Revenue (Raw Data)
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchRevenueData}
          style={{ marginLeft: 16 }}
        >
          Refresh
        </Button>
      </Title>
      
      <div style={{ marginBottom: 8 }}>
        <em>Method used: {method}</em>
      </div>
      
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Revenue (All Time)"
              value={summary.total_revenue || 0}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Successful Leads (All Time)"
              value={summary.total_leads || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Average Bid"
              value={summary.avg_bid || 0}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
              suffix="per lead"
            />
          </Card>
        </Col>
      </Row>
      
      <Spin spinning={loading}>
        <Table
          dataSource={revenueData}
          columns={columns}
          rowKey="list_id"
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </Spin>
    </div>
  );
}
