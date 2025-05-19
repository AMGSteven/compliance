'use client';

import { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Select, notification, Space, Switch, Typography, Popconfirm, Alert, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface ListRouting {
  id: string;
  list_id: string;
  campaign_id: string;
  cadence_id: string;
  token?: string;
  description?: string;
  active: boolean;
  bid?: number;
  created_at: string;
  updated_at: string;
}

// Define a composite key type for list+campaign combinations
type ListCampaignKey = string;

export default function ListRoutingsPage() {
  const [routings, setRoutings] = useState<ListRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentListId, setCurrentListId] = useState<string>('');
  const [currentCampaignId, setCurrentCampaignId] = useState<string>('');
  const [currentCadenceId, setCurrentCadenceId] = useState<string>('');
  const [currentToken, setCurrentToken] = useState<string>('');
  const [currentBid, setCurrentBid] = useState<number>(0);

  // Maps to store cadence ID and token by list+campaign combination
  const [listCampaignCadenceMap, setListCampaignCadenceMap] = useState<Record<ListCampaignKey, string>>({});
  const [listTokenMap, setListTokenMap] = useState<Record<string, string>>({});

  // Fetch list routings on component mount
  useEffect(() => {
    fetchListRoutings();
  }, []);
  
  // Effect to build mappings for cadence IDs and tokens
  useEffect(() => {
    const cadenceMap: Record<ListCampaignKey, string> = {};
    const tokenMap: Record<string, string> = {};
    
    // Create mappings
    routings.forEach(routing => {
      if (routing.active) {
        // Map for list_id+campaign_id combo to cadence_id
        const key = `${routing.list_id}:${routing.campaign_id}`;
        cadenceMap[key] = routing.cadence_id;
        
        // Map for list_id to token
        if (routing.token) {
          tokenMap[routing.list_id] = routing.token;
        }
      }
    });
    
    setListCampaignCadenceMap(cadenceMap);
    setListTokenMap(tokenMap);
  }, [routings]);

  // Function to fetch list routings from the API
  const fetchListRoutings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/list-routings', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setRoutings(result.data);
      } else {
        notification.error({ message: 'Failed to fetch routings', description: result.error || 'Unknown error' });
      }
    } catch (error) {
      console.error('Error fetching routings:', error);
      notification.error({ message: 'Error', description: 'Failed to fetch list routings' });
    } finally {
      setLoading(false);
    }
  };

  // Reset form and show modal for adding a new routing
  const handleAddRouting = () => {
    form.resetFields();
    setEditMode(false);
    setCurrentId(null);
    setCurrentListId('');
    setCurrentCampaignId('');
    setCurrentCadenceId('');
    setCurrentToken('');
    setModalVisible(true);
  };

  // Show modal with form pre-filled for editing an existing routing
  const handleEditRouting = (record: ListRouting) => {
    setCurrentListId(record.list_id);
    setCurrentCampaignId(record.campaign_id);
    setCurrentCadenceId(record.cadence_id);
    setCurrentToken(record.token || '');
    setCurrentBid(record.bid || 0);
    
    form.setFieldsValue({
      list_id: record.list_id,
      campaign_id: record.campaign_id,
      cadence_id: record.cadence_id,
      token: record.token || '',
      description: record.description,
      bid: record.bid || 0,
      active: record.active
    });
    
    setEditMode(true);
    setCurrentId(record.id);
    setModalVisible(true);
  };
  
  // Handle list_id change in form
  const handleListIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentListId(value);
    
    // Check if this list+campaign combination already exists
    checkListCampaignCombination(value, currentCampaignId);
    
    // Auto-populate token if this list ID has an existing token
    if (listTokenMap[value]) {
      setCurrentToken(listTokenMap[value]);
      form.setFieldsValue({ token: listTokenMap[value] });
    } else {
      setCurrentToken('');
      form.setFieldsValue({ token: '' });
    }
  };
  
  // Handle campaign_id change in form
  const handleCampaignIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentCampaignId(value);
    
    // Check if this list+campaign combination already exists
    checkListCampaignCombination(currentListId, value);
  };
  
  // Check if a list+campaign combination already exists and has a cadence ID
  const checkListCampaignCombination = (listId: string, campaignId: string) => {
    if (listId && campaignId) {
      const key = `${listId}:${campaignId}`;
      const existingCadenceId = listCampaignCadenceMap[key];
      
      if (existingCadenceId && !editMode) {
        setCurrentCadenceId(existingCadenceId);
        form.setFieldsValue({ cadence_id: existingCadenceId });
        notification.info({
          message: 'Cadence ID auto-selected',
          description: `This List ID + Campaign ID combination already uses Cadence ID ${existingCadenceId}`,
          duration: 5
        });
      }
    }
  };

  // Delete a routing
  const handleDeleteRouting = async (id: string) => {
    try {
      const response = await fetch(`/api/list-routings?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        notification.success({ message: 'Success', description: 'Routing deleted successfully' });
        fetchListRoutings();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete routing' });
      }
    } catch (error) {
      console.error('Error deleting routing:', error);
      notification.error({ message: 'Error', description: 'Failed to delete routing' });
    }
  };

  // Submit form to create or update a routing
  const handleSubmit = async (values: any) => {
    try {
      // Parse bid from string to number
      const bidValue = values.bid ? parseFloat(values.bid) : 0.00;
      
      const payload = {
        list_id: values.list_id,
        campaign_id: values.campaign_id,
        cadence_id: values.cadence_id,
        token: values.token || null,
        description: values.description || '',
        bid: bidValue,
        active: values.active !== undefined ? values.active : true
      };
      
      console.log('Bid value being submitted:', bidValue);

      const method = editMode ? 'PUT' : 'POST';
      const body = editMode ? { ...payload, id: currentId } : payload;
      
      console.log('Submitting with method:', method, 'and body:', body);
      
      const response = await fetch('/api/list-routings', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123'
        },
        body: JSON.stringify(body)
      });
      
      console.log('Response status:', response.status);
      
      const result = await response.json();
      console.log('API response:', result);
      
      if (result.success) {
        notification.success({
          message: 'Success',
          description: editMode ? 'Routing updated successfully' : 'New routing created successfully'
        });
        setModalVisible(false);
        fetchListRoutings();
      } else {
        console.error('API returned error:', result);
        notification.error({ message: 'Error', description: result.error || 'Operation failed' });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      notification.error({ message: 'Error', description: 'Failed to save routing' });
    }
  };

  // Define table columns
  const columns = [
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
      render: (text: string) => (
        <div style={{ wordBreak: 'break-all', maxWidth: '150px' }}>{text}</div>
      )
    },
    {
      title: 'Campaign ID',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
      render: (text: string) => (
        <div style={{ wordBreak: 'break-all', maxWidth: '150px' }}>{text}</div>
      )
    },
    {
      title: 'Cadence ID',
      dataIndex: 'cadence_id',
      key: 'cadence_id',
      render: (text: string) => (
        <div style={{ wordBreak: 'break-all', maxWidth: '150px' }}>{text}</div>
      )
    },
    {
      title: 'Token',
      dataIndex: 'token',
      key: 'token',
      render: (text: string) => text ? (
        <div style={{ wordBreak: 'break-all', maxWidth: '150px' }}>{text}</div>
      ) : '-'
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-'
    },
    {
      title: 'Bid',
      dataIndex: 'bid',
      key: 'bid',
      render: (bid: number) => bid ? `$${bid.toFixed(2)}` : '$0.00'
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean) => (
        <Switch checked={active} disabled />
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ListRouting) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => handleEditRouting(record)}
            type="primary"
            size="small"
          />
          <Popconfirm
            title="Delete this routing?"
            description="Are you sure you want to delete this routing?"
            onConfirm={() => handleDeleteRouting(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              icon={<DeleteOutlined />} 
              type="primary" 
              danger 
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Title level={3}>List to Cadence Routing Management</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleAddRouting}
        >
          Add New Routing
        </Button>
      </div>
      
      <Alert
        message="Routing Configuration Rules"
        description={
          <>
            <p>Each <strong>List ID</strong> (vendor) + <strong>Campaign ID</strong> (product type) combination needs a consistent <strong>Cadence ID</strong>.</p>
            <p>Example: Vendor ABC with Health Insurance campaign must use a consistent cadence, but Vendor ABC with Life Insurance campaign can use a different cadence.</p>
          </>
        }
        type="info"
        showIcon
        style={{ marginBottom: '16px' }}
      />
      
      <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
        Configure which campaign ID and cadence ID to use for leads coming from specific list IDs.
        These mappings are used when automatically forwarding leads to the dialer API.
      </Text>
      
      <Table 
        dataSource={routings}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      
      {/* Form Modal */}
      <Modal
        title={editMode ? 'Edit Routing' : 'Add New Routing'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="list_id"
            label="List ID"
            rules={[{ required: true, message: 'Please enter the list ID' }]}
          >
            <Input 
              placeholder="e.g., a38881ab-93b2-4750-9f9c-92ae6cd10b7e" 
              onChange={handleListIdChange}
              suffix={
                <Tooltip title="List ID represents the vendor or source of leads.">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
            />
          </Form.Item>
          
          <Form.Item
            name="campaign_id"
            label="Campaign ID"
            rules={[{ required: true, message: 'Please enter the campaign ID' }]}
          >
            <Input 
              placeholder="e.g., b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00" 
              onChange={handleCampaignIdChange}
              suffix={
                <Tooltip title="Campaign ID represents the product type (Health Insurance, Life Insurance, etc.)">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
            />
          </Form.Item>
          
          <Form.Item
            name="cadence_id"
            label="Cadence ID"
            rules={[{ required: true, message: 'Please enter the cadence ID' }]}
            extra={currentListId && currentCampaignId && listCampaignCadenceMap[`${currentListId}:${currentCampaignId}`] && !editMode ? 
              `This List ID + Campaign ID combination is already using cadence ID: ${listCampaignCadenceMap[`${currentListId}:${currentCampaignId}`]}` : null}
          >
            <Input 
              placeholder="e.g., 39a9381e-14ef-4fdd-a95a-9649025590a4" 
              disabled={!editMode && !!currentListId && !!currentCampaignId && !!listCampaignCadenceMap[`${currentListId}:${currentCampaignId}`]} 
              suffix={
                <Tooltip title="When editing, you can change the cadence ID. For new entries, if a List ID + Campaign ID combination already exists, the cadence ID will be pre-selected.">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
            />
          </Form.Item>
          
          <Form.Item
            name="token"
            label="Token"
            extra={currentListId && listTokenMap[currentListId] && !editMode ? 
              `This List ID is already associated with token: ${listTokenMap[currentListId]}` : null}
          >
            <Input 
              placeholder="e.g., 7f108eff2dbf3ab07d562174da6dbe53" 
              disabled={!editMode && !!currentListId && !!listTokenMap[currentListId]}
              suffix={
                <Tooltip title="Authentication token for the dialer API. Each List ID uses the same token across all routings.">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input placeholder="e.g., Juiced Media Default Routing" />
          </Form.Item>
          
          <Form.Item
            name="bid"
            label="Bid Amount"
            rules={[
              { required: true, message: 'Please enter a bid amount' },
              { pattern: /^\d*(\.\d{0,2})?$/, message: 'Bid must be a valid number with up to 2 decimal places' }
            ]}
            tooltip="The bid amount that will be returned to the buyer on successful lead submissions"
          >
            <Input
              type="text"
              placeholder="0.00"
              prefix="$"
              onChange={(e) => {
                // Allow only numeric input with decimal point
                const value = e.target.value.replace(/[^0-9.]/g, '');
                
                // Ensure only one decimal point
                const parts = value.split('.');
                if (parts.length > 2) {
                  e.target.value = parts[0] + '.' + parts.slice(1).join('');
                }
                
                // Limit to 2 decimal places
                if (parts.length > 1 && parts[1].length > 2) {
                  e.target.value = parts[0] + '.' + parts[1].substring(0, 2);
                }
              }}
              suffix={
                <Tooltip title="This bid amount will be returned in the API response when a lead is successfully processed">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
            />
          </Form.Item>
          
          <Form.Item
            name="active"
            label="Active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editMode ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
