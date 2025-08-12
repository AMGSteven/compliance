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
  dialer_type?: number; // 1 = Internal Dialer, 2 = Pitch BPO, 3 = Convoso
  auto_claim_trusted_form?: boolean;
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
  const [currentDialerType, setCurrentDialerType] = useState<number>(1); // Default to Internal Dialer
  const [selectedDataSourceType, setSelectedDataSourceType] = useState<string>('on_hour');
  const [selectedVertical, setSelectedVertical] = useState<string>('ACA');
  const [approvedDialers, setApprovedDialers] = useState<number[]>([1, 2, 3]); // Default all approved
  
  // Pitch BPO fixed values
  const PITCH_BPO_TOKEN = '70942646-125b-4ddd-96fc-b9a142c698b8';
  
  // Convoso fixed values (uses environment variables on backend)
  const CONVOSO_TOKEN = 'convoso-env-var'; // Placeholder - actual values come from env vars

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

  // Create dialer approvals for a new list routing
  const handleCreateDialerApprovals = async (listId: string, approvedDialers: number[]) => {
    try {
      console.log('Creating dialer approvals for:', listId, 'approved dialers:', approvedDialers);
      
      // Create approval records for each dialer type (1, 2, 3)
      const dialerTypes = [1, 2, 3];
      
      for (const dialerType of dialerTypes) {
        const approved = approvedDialers.includes(dialerType);
        const reason = approved ? 'Approved during routing setup' : 'Not selected during routing setup';
        
        const response = await fetch('/api/dialer-approvals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123'
          },
          body: JSON.stringify({
            list_id: listId,
            dialer_type: dialerType,
            approved: approved,
            reason: reason,
            approved_by: 'routing-setup'
          })
        });
        
        if (!response.ok) {
          console.error(`Failed to create approval for dialer type ${dialerType}:`, await response.text());
        }
      }
      
      console.log('Dialer approvals created successfully');
    } catch (error) {
      console.error('Error creating dialer approvals:', error);
      // Don't throw - we don't want to fail the entire routing creation for this
    }
  };

  // Set vertical assignment for a list routing
  const handleSetVerticalAssignment = async (listId: string, vertical: string) => {
    try {
      console.log('Setting vertical assignment for:', listId, 'vertical:', vertical);
      
      const response = await fetch('/api/vertical-configs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123'
        },
        body: JSON.stringify({
          list_id: listId,
          vertical: vertical
        })
      });
      
      if (!response.ok) {
        console.error('Failed to set vertical assignment:', await response.text());
      } else {
        console.log('Vertical assignment set successfully');
      }
    } catch (error) {
      console.error('Error setting vertical assignment:', error);
      // Don't throw - we don't want to fail the entire routing creation for this
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
    setCurrentDialerType(1); // Reset to internal dialer
    setModalVisible(true);
  };
  
  // Reset form when modal visibility changes
  useEffect(() => {
    if (modalVisible) {
      fetchListRoutings();
    }
  }, [modalVisible]);

  // Show modal with form pre-filled for editing an existing routing
  const handleEditRouting = (record: ListRouting) => {
    setEditMode(true);
    setCurrentId(record.id);
    setCurrentListId(record.list_id);
    setCurrentCampaignId(record.campaign_id);
    setCurrentCadenceId(record.cadence_id);
    setCurrentToken(record.token || '');
    setCurrentBid(record.bid || 0);
    setCurrentDialerType(record.dialer_type || 1); // Default to Internal Dialer if not set
    
    form.setFieldsValue({
      list_id: record.list_id,
      campaign_id: record.campaign_id,
      cadence_id: record.cadence_id,
      token: record.token || '',
      description: record.description,
      bid: record.bid || 0,
      dialer_type: record.dialer_type || 1, // Default to Internal Dialer if not set
      active: record.active,
      auto_claim_trusted_form: record.auto_claim_trusted_form || false
    });
    
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
    // Pass the current dialer type to skip for Pitch BPO
    checkListCampaignCombination(currentListId, value, currentDialerType);
  };
  
  // Check if a list+campaign combination already exists and has a cadence ID
  const checkListCampaignCombination = (listId: string, campaignId: string, dialerType?: number) => {
    // Skip this check for Pitch BPO (dialer_type=2)
    if (dialerType === 2) {
      console.log('Skipping list+campaign check for Pitch BPO');
      return;
    }
    
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
      setLoading(true);
      console.log('Starting form submission with values:', values);
      
      // Parse bid from string to number
      const bidValue = values.bid ? parseFloat(values.bid) : 0.00;
      console.log('Parsed bid value:', bidValue);
      
      // For Pitch BPO, set the token automatically and handle empty fields
      if (values.dialer_type === 2) {
        console.log('Pitch BPO detected, setting token and handling empty fields');
        // Always use the hardcoded token for Pitch BPO
        values.token = PITCH_BPO_TOKEN;
        console.log('Using hardcoded Pitch BPO token:', PITCH_BPO_TOKEN);
        
        // For Pitch BPO, we'll let the backend generate placeholders for all empty fields
        // Just ensure we're not sending undefined values
        values.list_id = values.list_id || '';
        values.campaign_id = values.campaign_id || ''; 
        values.cadence_id = values.cadence_id || '';
        
        console.log('After Pitch BPO adjustments:', { 
          token: values.token, 
          list_id: values.list_id,
          campaign_id: values.campaign_id, 
          cadence_id: values.cadence_id 
        });
      }
      
      // Check if the list+campaign combination already has a cadence ID
      if (!editMode && values.list_id && values.campaign_id) {
        await checkListCampaignCombination(values.list_id, values.campaign_id, values.dialer_type);
      }
      
      console.log('Form values received:', values);
      
      // Enhance description with data source type for parsing
      const dataSourcePrefix = values.data_source_type === 'on_hour' ? 'On Hour' : 
                              values.data_source_type === 'after_hour' ? 'After Hour' : 'Aged';
      const enhancedDescription = `${dataSourcePrefix} - ${values.description || 'Auto-generated routing'}`;
      
      // Prepare the payload, with special handling for Pitch BPO
      const payload = {
        // For all dialer types
        description: enhancedDescription,
        bid: bidValue,
        active: values.active !== undefined ? values.active : true,
        dialer_type: values.dialer_type || 1, // Default to 1 if missing
        auto_claim_trusted_form: values.auto_claim_trusted_form || false,
        vertical: values.vertical || 'ACA', // Default to ACA if missing
        
        // For Pitch BPO, these values were already set correctly above
        list_id: values.list_id || '', 
        campaign_id: values.campaign_id || '',
        cadence_id: values.cadence_id || '',
        
        // Ensure token is properly set (hardcoded for Pitch BPO)
        token: values.dialer_type === 2 ? PITCH_BPO_TOKEN : (values.token || null)
      };
      
      console.log('Final payload with token and fields:', {
        token: payload.token,
        list_id: payload.list_id,
        campaign_id: payload.campaign_id,
        cadence_id: payload.cadence_id,
        dialer_type: payload.dialer_type
      });
      
      console.log('Bid value being submitted:', bidValue);

      const method = editMode ? 'PUT' : 'POST';
      const body = editMode ? { ...payload, id: currentId } : payload;
      
      console.log('Submitting with method:', method, 'and body:', JSON.stringify(body, null, 2));
      
      try {
        const response = await fetch('/api/list-routings', {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123'
          },
          body: JSON.stringify(body)
        });
        
        console.log('Response status:', response.status);
        
        // Check if the response is ok before parsing JSON
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server returned error status:', response.status, errorText);
          throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('API response:', result);
        
        if (result.success) {
          // If this is a new routing (not edit mode), create dialer approvals and set vertical
          if (!editMode && values.approved_dialers && values.approved_dialers.length > 0) {
            await handleCreateDialerApprovals(values.list_id, values.approved_dialers);
          }
          
          // Set vertical assignment for the list ID
          if (values.vertical && values.list_id) {
            await handleSetVerticalAssignment(values.list_id, values.vertical);
          }
          
          notification.success({
            message: 'Success',
            description: editMode ? 'Routing updated successfully' : 'New routing created successfully with approvals and vertical assignment'
          });
          setModalVisible(false);
          fetchListRoutings();
        } else {
          console.error('API returned error result:', result);
          notification.error({ 
            message: 'Error', 
            description: result.error || 'Operation failed', 
            duration: 10 // Show longer so user can see the error
          });
        }
      } catch (error: any) {
        console.error('Failed to submit to API:', error);
        notification.error({ 
          message: 'Connection Error', 
          description: `Could not connect to server: ${error?.message || 'Unknown error'}`,
          duration: 10
        });
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
      render: (text: string) => <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{text}</span>
    },
    {
      title: 'Dialer',
      dataIndex: 'dialer_type',
      key: 'dialer_type',
      render: (dialer_type: number) => {
        if (dialer_type === 2) {
          return <span style={{ color: '#1890ff' }}>Pitch BPO</span>;
        } else if (dialer_type === 3) {
          return <span style={{ color: '#52c41a' }}>Convoso (IBP BPO)</span>;
        } else {
          return <span>Internal Dialer</span>;
        }
      }
    },
    {
      title: 'Campaign ID',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
      render: (text: string) => <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{text}</span>
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
      title: 'Auto-Claim TF',
      dataIndex: 'auto_claim_trusted_form',
      key: 'auto_claim_trusted_form',
      render: (autoClaim: boolean) => (
        <Switch checked={autoClaim} disabled />
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
            rules={[{ required: currentDialerType !== 2, message: 'Please enter the list ID' }]}
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
            rules={[{ required: true, message: 'Please enter a campaign ID' }]}
            extra={currentDialerType === 2 ? 'Campaign ID is now editable for Pitch BPO campaigns' : null}
          >
            <Input 
              placeholder="e.g., b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00" 
              onChange={handleCampaignIdChange}
            />
          </Form.Item>
          
          <Form.Item
            name="cadence_id"
            label="Cadence ID"
            rules={[{ required: true, message: 'Please enter a cadence ID' }]}
            extra={currentDialerType === 2 ? 
              'Cadence ID is now editable for Pitch BPO campaigns' : 
              (currentListId && currentCampaignId && listCampaignCadenceMap[`${currentListId}:${currentCampaignId}`] && !editMode ? 
                `This List ID + Campaign ID combination is already using cadence ID: ${listCampaignCadenceMap[`${currentListId}:${currentCampaignId}`]}` : null)
            }
          >
            <Input 
              placeholder="e.g., 39a9381e-14ef-4fdd-a95a-9649025590a4" 
              disabled={currentDialerType !== 2 && (!editMode && !!currentListId && !!currentCampaignId && !!listCampaignCadenceMap[`${currentListId}:${currentCampaignId}`])} 
              suffix={
                <Tooltip title={currentDialerType === 2 ? 
                  "Cadence ID is now editable for Pitch BPO campaigns. Set this to match your vendor's campaign requirements." :
                  "When editing, you can change the cadence ID. For new entries, if a List ID + Campaign ID combination already exists, the cadence ID will be pre-selected."
                }>
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
            />
          </Form.Item>
          
          <Form.Item
            name="token"
            label="Token"
            extra={currentDialerType === 2 ? 
              'For Pitch BPO, token is automatically set to 70942646-125b-4ddd-96fc-b9a142c698b8' : 
              currentDialerType === 3 ?
                'For Convoso, authentication is handled via environment variables (CONVOSO_AUTH_TOKEN)' :
              (currentListId && listTokenMap[currentListId] && !editMode ? 
                `This List ID is already associated with token: ${listTokenMap[currentListId]}` : null)}
          >
             {currentDialerType === 2 ? (
              <Input 
                placeholder="e.g., 7f108eff2dbf3ab07d562174da6dbe53"
                disabled={true}
                value={PITCH_BPO_TOKEN}
                suffix={
                  <Tooltip title="Pitch BPO always uses a fixed token">
                    <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                  </Tooltip>
                }
              />
            ) : currentDialerType === 3 ? (
              <Input 
                placeholder="Environment variable: CONVOSO_AUTH_TOKEN"
                disabled={true}
                value={CONVOSO_TOKEN}
                suffix={
                  <Tooltip title="Convoso authentication is handled via environment variables">
                    <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                  </Tooltip>
                }
              />
            ) : (
              <Input 
                placeholder="e.g., 7f108eff2dbf3ab07d562174da6dbe53" 
                disabled={(!editMode && !!currentListId && !!listTokenMap[currentListId])}
                suffix={
                  <Tooltip title="Authentication token for the dialer API. Each List ID uses the same token across all routings.">
                    <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                  </Tooltip>
                }
              />
            )}
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input placeholder="e.g., Juiced Media Default Routing" />
          </Form.Item>
          
          <Form.Item
            name="data_source_type"
            label="Data Source Type"
            rules={[{ required: true, message: 'Please select a data source type' }]}
            initialValue="on_hour"
            tooltip="Specify when these leads are typically received and processed"
          >
            <Select 
              placeholder="Select data source type"
              onChange={(value) => setSelectedDataSourceType(value)}
            >
              <Select.Option value="on_hour">⏰ On Hour - Live leads during business hours</Select.Option>
              <Select.Option value="after_hour">🌙 After Hour - Leads received outside business hours</Select.Option>
              <Select.Option value="aged">📅 Aged - Older leads being reprocessed</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="vertical"
            label="Vertical Assignment"
            rules={[{ required: true, message: 'Please select a vertical' }]}
            initialValue="ACA"
            tooltip="Categorize the type of insurance or product this List ID represents"
          >
            <Select 
              placeholder="Select vertical"
              onChange={(value) => setSelectedVertical(value)}
            >
              <Select.Option value="ACA">🏥 ACA - Affordable Care Act Health Insurance</Select.Option>
              <Select.Option value="Final Expense">⚰️ Final Expense - Burial/Funeral Insurance</Select.Option>
              <Select.Option value="Medicare">👴 Medicare - Senior Health Insurance</Select.Option>
            </Select>
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
            name="dialer_type"
            label="Dialer"
            initialValue={1}
            tooltip="Select which dialer system to route leads to"
          >
            <Select onChange={(value) => {
              // When Pitch BPO is selected, update form fields
              if (value === 2) {
                form.setFieldsValue({
                  token: PITCH_BPO_TOKEN,
                });
                // Hide campaign and cadence fields by forcing rerender
                setCurrentDialerType(2);
              } else if (value === 3) {
                // Convoso uses environment variables, no token needed in form
                form.setFieldsValue({
                  token: CONVOSO_TOKEN,
                });
                setCurrentDialerType(3);
              } else {
                setCurrentDialerType(1);
              }
            }}>
              <Select.Option value={1}>Internal Dialer</Select.Option>
              <Select.Option value={2}>Pitch BPO</Select.Option>
              <Select.Option value={3}>Convoso (IBP BPO)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="active"
            label="Active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="auto_claim_trusted_form"
            label="Auto-Claim TrustedForm"
            valuePropName="checked"
            initialValue={false}
            tooltip="Automatically claim TrustedForm certificates for leads in this routing"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="approved_dialers"
            label="Approved Dialers"
            rules={[{ required: true, message: 'Please select at least one approved dialer' }]}
            initialValue={[1, 2, 3]}
            tooltip="Select which dialers are approved for compliance reasons. Only approved dialers can receive leads from this List ID."
          >
            <Select 
              mode="multiple"
              placeholder="Select approved dialers"
              onChange={(values) => setApprovedDialers(values)}
              style={{ width: '100%' }}
            >
              <Select.Option value={1}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    background: '#10b981', 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontSize: '11px' 
                  }}>INTERNAL</span>
                  Internal Dialer
                </div>
              </Select.Option>
              <Select.Option value={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    background: '#3b82f6', 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontSize: '11px' 
                  }}>PITCH BPO</span>
                  Pitch BPO
                </div>
              </Select.Option>
              <Select.Option value={3}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    background: '#8b5cf6', 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontSize: '11px' 
                  }}>CONVOSO</span>
                  Convoso (IBP BPO)
                </div>
              </Select.Option>
            </Select>
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
