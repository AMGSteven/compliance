'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, Typography, Space, Tag, message, Row, Col } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface SubidBidData {
  id: string;
  list_id: string;
  subid: string;
  bid: number;
  description?: string;
  active: boolean;
  created_at: string;
  list_description?: string;
  lead_count?: number;
  default_bid?: number;
}

interface TopSubidData {
  subid: string;
  leads_count: number;
  policies_count: number;
  transfers_count: number;
  total_revenue: number;
}

interface ListRouting {
  list_id: string;
  bid: number;
  description: string;
}

export default function SubidBidsPage() {
  const [subidBids, setSubidBids] = useState<SubidBidData[]>([]);
  const [topSubids, setTopSubids] = useState<TopSubidData[]>([]);
  const [listRoutings, setListRoutings] = useState<ListRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SubidBidData | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [form] = Form.useForm();

  // ✅ FIXED: Safer environment variable handling
  const supabaseUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '';
  const supabaseKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '';
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  // ✅ FIXED: Move function definitions BEFORE useEffect hooks
  
  // Fetch existing SUBID bids
  const fetchSubidBids = async () => {
    if (!supabase) {
      console.log('❌ No Supabase client available');
      setLoading(false);
      return;
    }
    
    try {
      console.log('🔍 Fetching SUBID bids...');
      
      // ✅ FIXED: Use separate queries instead of PostgREST join syntax
      const { data: subidBidsData, error: bidsError } = await supabase
        .from('subid_bids')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (bidsError) {
        console.error('❌ Error fetching SUBID bids:', bidsError);
        message.error(`Failed to load SUBID bids: ${bidsError.message}`);
        setLoading(false);
        return;
      }

      if (!subidBidsData || subidBidsData.length === 0) {
        console.log('📝 No SUBID bids found');
        setSubidBids([]);
        setLoading(false);
        return;
      }

      // Get unique list_ids to fetch routing data
      const listIds = [...new Set(subidBidsData.map(bid => bid.list_id))];
      
      const { data: routingsData, error: routingsError } = await supabase
        .from('list_routings')
        .select('list_id, description, bid')
        .in('list_id', listIds)
        .eq('active', true);

      if (routingsError) {
        console.error('❌ Error fetching list routings:', routingsError);
        message.error(`Failed to load list routings: ${routingsError.message}`);
        setLoading(false);
        return;
      }

      // Create lookup map for routings
      const routingsMap = (routingsData || []).reduce((acc, routing) => {
        acc[routing.list_id] = routing;
        return acc;
      }, {} as Record<string, any>);

      // Combine the data
      const formattedData = subidBidsData.map((bid: any) => {
        const routing = routingsMap[bid.list_id];
        return {
          ...bid,
          list_description: routing?.description || 'Unknown List',
          default_bid: routing?.bid || 0.00
        };
      });

      setSubidBids(formattedData);
      console.log(`✅ Loaded ${formattedData.length} SUBID bids successfully`);
      
    } catch (error) {
      console.error('❌ Unexpected error fetching SUBID bids:', error);
      message.error('An unexpected error occurred while loading SUBID bids');
    } finally {
      setLoading(false);
    }
  };

  // Fetch list routings for dropdown
  const fetchListRoutings = async () => {
    if (!supabase) {
      console.log('❌ No Supabase client available for list routings');
      return;
    }
    
    try {
      console.log('🔍 Fetching list routings...');
      
      const { data, error } = await supabase
        .from('list_routings')
        .select('list_id, bid, description')
        .eq('active', true)
        .order('description');

      if (error) {
        console.error('❌ Error fetching list routings:', error);
        throw error;
      }
      
      setListRoutings(data || []);
      console.log(`✅ Loaded ${data?.length || 0} list routings`);
      
    } catch (error) {
      console.error('❌ Error fetching list routings:', error);
      message.error('Failed to load list routings');
    }
  };

  // Fetch top SUBIDs for the selected list
  const fetchTopSubids = async (listId: string) => {
    if (!listId || !supabaseUrl) {
      console.log('❌ Missing listId or supabaseUrl for top SUBIDs');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`🔍 Fetching top SUBIDs for list ${listId}...`);
      
      // Calculate date range (last 30 days)
      const endDate = dayjs().format('YYYY-MM-DD');
      const startDate = dayjs().subtract(30, 'days').format('YYYY-MM-DD');
      
      const response = await fetch(
        `/api/revenue-tracking/subids?list_id=${listId}&startDate=${startDate}&endDate=${endDate}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch SUBID data`);
      }
      
      const data = await response.json();
      
      // Sort by lead count and take top 50
      const sortedData = data
        .filter((item: TopSubidData) => item.leads_count >= 10) // Only show SUBIDs with 10+ leads
        .sort((a: TopSubidData, b: TopSubidData) => b.leads_count - a.leads_count)
        .slice(0, 50);
        
      setTopSubids(sortedData);
      console.log(`✅ Loaded ${sortedData.length} top SUBIDs for list ${listId}`);
      
    } catch (error) {
      console.error('❌ Error fetching top SUBIDs:', error);
      message.error('Failed to load top SUBIDs');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: All useEffect hooks after function definitions
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      console.log('🚀 Component mounted, fetching initial data...');
      fetchSubidBids();
      fetchListRoutings();
    }
  }, [mounted]);

  useEffect(() => {
    if (mounted && selectedListId) {
      console.log(`🎯 Selected list changed to: ${selectedListId}`);
      fetchTopSubids(selectedListId);
    }
  }, [selectedListId, mounted]);

  // Don't render anything until mounted (prevents SSR issues)
  if (!mounted) {
    return (
      <div style={{ padding: '20px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            Loading...
          </div>
        </Card>
      </div>
    );
  }

  // Save SUBID bid
  const handleSave = async (values: any) => {
    if (!supabase) return;
    
    try {
      const subidBidData = {
        list_id: values.list_id,
        subid: values.subid,
        bid: values.bid,
        description: values.description,
        active: true
      };

      if (editingRecord) {
        // Update existing
        const { error } = await supabase
          .from('subid_bids')
          .update(subidBidData)
          .eq('id', editingRecord.id);
          
        if (error) throw error;
        message.success('SUBID bid updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('subid_bids')
          .insert([subidBidData]);
          
        if (error) throw error;
        message.success('SUBID bid created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      await fetchSubidBids();
    } catch (error) {
      console.error('Error saving SUBID bid:', error);
      message.error('Failed to save SUBID bid');
    }
  };

  // Delete SUBID bid
  const handleDelete = async (id: string) => {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from('subid_bids')
        .update({ active: false })
        .eq('id', id);
        
      if (error) throw error;
      message.success('SUBID bid deleted successfully');
      await fetchSubidBids();
    } catch (error) {
      console.error('Error deleting SUBID bid:', error);
      message.error('Failed to delete SUBID bid');
    }
  };

  // Open modal for editing
  const handleEdit = (record: SubidBidData) => {
    setEditingRecord(record);
    form.setFieldsValue({
      list_id: record.list_id,
      subid: record.subid,
      bid: record.bid,
      description: record.description
    });
    setModalVisible(true);
  };

  // Quick add from top SUBIDs
  const handleQuickAdd = (subid: string) => {
    if (!selectedListId) {
      message.warning('Please select a list first');
      return;
    }
    
    const defaultBid = listRoutings.find(r => r.list_id === selectedListId)?.bid || 0.00;
    
    form.setFieldsValue({
      list_id: selectedListId,
      subid: subid,
      bid: defaultBid,
      description: `Custom bid for SUBID ${subid}`
    });
    setModalVisible(true);
  };

  // Columns for SUBID bids table
  const subidBidsColumns = [
    {
      title: 'List',
      dataIndex: 'list_description',
      key: 'list_description',
      width: 200,
      render: (text: string, record: SubidBidData) => (
        <div>
          <div>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.list_id}</Text>
        </div>
      )
    },
    {
      title: 'SUBID',
      dataIndex: 'subid',
      key: 'subid',
      width: 250,
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>{text}</Text>
      )
    },
    {
      title: 'Custom Bid',
      dataIndex: 'bid',
      key: 'bid',
      width: 120,
      render: (bid: number, record: SubidBidData) => (
        <div>
          <Tag color="green">${bid.toFixed(2)}</Tag>
          <div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Default: ${record.default_bid?.toFixed(2) || '0.00'}
            </Text>
          </div>
        </div>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('MM/DD/YY')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: SubidBidData) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            size="small"
          />
        </Space>
      )
    }
  ];

  // Columns for top SUBIDs table
  const topSubidsColumns = [
    {
      title: 'SUBID',
      dataIndex: 'subid',
      key: 'subid',
      width: 250,
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>{text}</Text>
      )
    },
    {
      title: 'Leads (30d)',
      dataIndex: 'leads_count',
      key: 'leads_count',
      width: 100,
      render: (count: number) => (
        <Tag color={count >= 1000 ? 'red' : count >= 500 ? 'orange' : 'blue'}>
          {count.toLocaleString()}
        </Tag>
      )
    },
    {
      title: 'Policies',
      dataIndex: 'policies_count',
      key: 'policies_count',
      width: 80,
      render: (count: number) => count.toLocaleString()
    },
    {
      title: 'Transfers',
      dataIndex: 'transfers_count',
      key: 'transfers_count',
      width: 80,
      render: (count: number) => count.toLocaleString()
    },
    {
      title: 'Revenue',
      dataIndex: 'total_revenue',
      key: 'total_revenue',
      width: 100,
      render: (revenue: number) => `$${revenue.toFixed(0)}`
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: any, record: TopSubidData) => {
        const hasCustomBid = subidBids.some(
          bid => bid.list_id === selectedListId && bid.subid === record.subid
        );
        
        return hasCustomBid ? (
          <Tag color="green">Has Custom Bid</Tag>
        ) : (
          <Button
            type="primary"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => handleQuickAdd(record.subid)}
          >
            Set Bid
          </Button>
        );
      }
    }
  ];

  if (!supabase) {
    return (
      <div style={{ padding: '20px' }}>
        <Card>
          <Typography.Text type="danger">
            Missing Supabase configuration. Please check your environment variables.
          </Typography.Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>SUBID Bid Management</Title>
      <Text type="secondary">
        Set custom bid amounts for specific SUBIDs. These override the default list-level bids during lead submission.
      </Text>

      <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
        <Col span={24}>
          <Card 
            title="Current SUBID Bids" 
            extra={
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
              >
                Add SUBID Bid
              </Button>
            }
          >
            <Table
              columns={subidBidsColumns}
              dataSource={subidBids}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Top SUBIDs (Last 30 Days)">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="Select a list to view top SUBIDs"
                style={{ width: 400 }}
                value={selectedListId}
                onChange={setSelectedListId}
                showSearch
                optionFilterProp="children"
              >
                {listRoutings.map(routing => (
                  <Option key={routing.list_id} value={routing.list_id}>
                    {routing.description} (${routing.bid.toFixed(2)})
                  </Option>
                ))}
              </Select>

              {selectedListId && (
                <Table
                  columns={topSubidsColumns}
                  dataSource={topSubids}
                  loading={loading}
                  rowKey="subid"
                  pagination={{ pageSize: 20 }}
                  size="small"
                  scroll={{ x: 800 }}
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingRecord ? 'Edit SUBID Bid' : 'Add SUBID Bid'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingRecord(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="list_id"
            label="List"
            rules={[{ required: true, message: 'Please select a list' }]}
          >
            <Select placeholder="Select a list" showSearch optionFilterProp="children">
              {listRoutings.map(routing => (
                <Option key={routing.list_id} value={routing.list_id}>
                  {routing.description} (Default: ${routing.bid.toFixed(2)})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="subid"
            label="SUBID"
            rules={[{ required: true, message: 'Please enter the SUBID' }]}
          >
            <Input placeholder="Enter SUBID value" />
          </Form.Item>

          <Form.Item
            name="bid"
            label="Custom Bid Amount"
            rules={[
              { required: true, message: 'Please enter the bid amount' },
              { type: 'number', min: 0, message: 'Bid must be greater than or equal to 0' }
            ]}
          >
            <InputNumber
              prefix="$"
              precision={2}
              step={0.01}
              min={0}
              max={999.99}
              style={{ width: '100%' }}
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <Input.TextArea
              placeholder="Optional description for this SUBID bid"
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
} 