'use client';

import { useState, useEffect } from 'react';
import { Table, Modal, Button, Typography, Spin, Tag, Space, Input, DatePicker, Tooltip } from 'antd';
import { SearchOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { format } from 'date-fns';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// Define lead type based on database schema
interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  list_id: string;
  campaign_id: string;
  policy_status?: string; // Added policy_status field
  custom_fields?: Record<string, any>;
  // Add other optional fields
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  trusted_form_cert_url?: string;
  traffic_source?: string;
  raw_submission?: any; // For storing the original submission data
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Fetch leads on component mount
  useEffect(() => {
    fetchLeads();
  }, []);

  // Filter leads when search text or date range changes
  useEffect(() => {
    filterLeads();
  }, [leads, searchText, dateRange]);

  // Function to fetch leads from the API
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leads/list', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setLeads(result.data);
        setPagination({
          ...pagination,
          total: result.data.length,
        });
      } else {
        console.error('Failed to fetch leads:', result.error);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to filter leads based on search text and date range
  const filterLeads = () => {
    let filtered = [...leads];
    
    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.first_name?.toLowerCase().includes(searchLower) ||
        lead.last_name?.toLowerCase().includes(searchLower) ||
        lead.email?.toLowerCase().includes(searchLower) ||
        lead.phone?.includes(searchText) ||
        lead.list_id?.includes(searchText) ||
        lead.campaign_id?.includes(searchText) ||
        lead.policy_status?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by date range
    if (dateRange && dateRange[0] && dateRange[1]) {
      const startDate = new Date(dateRange[0]);
      const endDate = new Date(dateRange[1]);
      
      filtered = filtered.filter(lead => {
        const leadDate = new Date(lead.created_at);
        return leadDate >= startDate && leadDate <= endDate;
      });
    }
    
    setFilteredLeads(filtered);
    setPagination({
      ...pagination,
      total: filtered.length,
    });
  };

  // Handle viewing lead details
  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailModalVisible(true);
  };

  // Handle viewing raw JSON data
  const handleViewJson = () => {
    if (selectedLead) {
      setJsonModalVisible(true);
    }
  };

  // Function to get status tag color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'blue';
      case 'success':
        return 'green';
      case 'error':
      case 'failed':
        return 'red';
      case 'processing':
        return 'orange';
      case 'warning':
        return 'orange';
      case 'rejected':
        return 'red';
      case 'duplicate':
        return 'purple';
      // Policy statuses
      case 'pending':
        return 'blue';
      case 'issued':
        return 'cyan';
      case 'paid':
        return 'green';
      case 'cancelled':
        return 'orange';
      default:
        return 'default';
    }
  };

  // Function to get policy status display text
  const getPolicyStatusDisplay = (status?: string) => {
    if (!status) return 'None';
    
    // Capitalize first letter
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Format JSON data for display
  const formatJsonData = (data: any) => {
    return JSON.stringify(data, null, 2);
  };

  // Table columns
  const columns: TableProps<Lead>['columns'] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => (
        <Tooltip title={id}>
          <span>{id.substring(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.first_name} ${record.last_name}`,
      sorter: (a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
      ellipsis: true,
    },
    {
      title: 'Campaign ID',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'New', value: 'new' },
        { text: 'Success', value: 'success' },
        { text: 'Error', value: 'error' },
        { text: 'Failed', value: 'failed' },
        { text: 'Processing', value: 'processing' },
      ],
      onFilter: (value, record) => record.status.toLowerCase() === value,
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => format(new Date(date), 'MMM dd, yyyy HH:mm:ss'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Policy Status',
      dataIndex: 'policy_status',
      key: 'policy_status',
      render: (status: string) => (
        <Tag color={status ? getStatusColor(status) : 'default'}>
          {getPolicyStatusDisplay(status)}
        </Tag>
      ),
      filters: [
        { text: 'None', value: '' },
        { text: 'Pending', value: 'pending' },
        { text: 'Issued', value: 'issued' },
        { text: 'Paid', value: 'paid' },
        { text: 'Cancelled', value: 'cancelled' },
        { text: 'Rejected', value: 'rejected' },
      ],
      onFilter: (value, record) => {
        if (value === '') {
          return !record.policy_status;
        }
        return record.policy_status === value;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="text" 
          icon={<EyeOutlined />} 
          onClick={() => handleViewDetails(record)}
          aria-label="View lead details"
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Lead Submissions</Title>
      
      {/* Filters */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Space>
          <Input
            placeholder="Search leads..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          
          <RangePicker 
            onChange={(dates, dateStrings) => setDateRange(dateStrings as [string, string])}
            style={{ width: 300 }}
          />
        </Space>
        
        <Button type="primary" onClick={fetchLeads}>
          Refresh
        </Button>
      </div>
      
      {/* Leads Table */}
      <Spin spinning={loading}>
        <Table 
          columns={columns} 
          dataSource={filteredLeads}
          rowKey="id"
          pagination={pagination}
          onChange={(pagination) => setPagination(pagination as any)}
        />
      </Spin>
      
      {/* Lead Details Modal */}
      <Modal
        title={selectedLead ? `Lead Details: ${selectedLead.first_name} ${selectedLead.last_name}` : 'Lead Details'}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="json" onClick={handleViewJson}>
            View Raw JSON
          </Button>,
          <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedLead && (
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Title level={4}>Contact Information</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text strong>First Name:</Text> {selectedLead.first_name}
                  </div>
                  <div>
                    <Text strong>Last Name:</Text> {selectedLead.last_name}
                  </div>
                  <div>
                    <Text strong>Email:</Text> {selectedLead.email}
                  </div>
                  <div>
                    <Text strong>Phone:</Text> {selectedLead.phone}
                  </div>
                  <div>
                    <Text strong>Address:</Text> {selectedLead.address || 'N/A'}
                  </div>
                  <div>
                    <Text strong>City:</Text> {selectedLead.city || 'N/A'}
                  </div>
                  <div>
                    <Text strong>State:</Text> {selectedLead.state || 'N/A'}
                  </div>
                  <div>
                    <Text strong>Zip Code:</Text> {selectedLead.zip_code || 'N/A'}
                  </div>
                </div>
              </div>
              
              <div>
                <Title level={4}>Lead Information</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text strong>List ID:</Text> {selectedLead.list_id || 'N/A'}
                  </div>
                  <div>
                    <Text strong>Campaign ID:</Text> {selectedLead.campaign_id || 'N/A'}
                  </div>
                  <div>
                    <Text strong>Traffic Source:</Text> {selectedLead.traffic_source || 'N/A'}
                  </div>
                  <div>
                    <Text strong>Status:</Text>{' '}
                    <Tag color={getStatusColor(selectedLead.status)}>
                      {selectedLead.status.toUpperCase()}
                    </Tag>
                  </div>
                  <div>
                    <Text strong>Policy Status:</Text>{' '}
                    <Tag color={selectedLead.policy_status ? getStatusColor(selectedLead.policy_status) : 'default'}>
                      {getPolicyStatusDisplay(selectedLead.policy_status)}
                    </Tag>
                  </div>
                  <div>
                    <Text strong>Created At:</Text>{' '}
                    {format(new Date(selectedLead.created_at), 'MMM dd, yyyy HH:mm:ss')}
                  </div>
                  <div>
                    <Text strong>TrustedForm Certificate:</Text>{' '}
                    {selectedLead.trusted_form_cert_url ? (
                      <a href={selectedLead.trusted_form_cert_url} target="_blank" rel="noopener noreferrer">
                        View Certificate
                      </a>
                    ) : 'N/A'}
                  </div>
                </div>
              </div>
              
              {selectedLead.custom_fields && Object.keys(selectedLead.custom_fields).length > 0 && (
                <div>
                  <Title level={4}>Custom Fields</Title>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {Object.entries(selectedLead.custom_fields).map(([key, value]) => (
                      <div key={key}>
                        <Text strong>{key}:</Text> {String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Space>
          </div>
        )}
      </Modal>
      
      {/* Raw JSON Modal */}
      <Modal
        title="Raw JSON Data"
        open={jsonModalVisible}
        onCancel={() => setJsonModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" type="primary" onClick={() => setJsonModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedLead && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                This shows the complete lead data, including the original submission payload.
              </Text>
            </div>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: 16, 
              borderRadius: 4,
              maxHeight: '60vh',
              overflow: 'auto'
            }}>
              {formatJsonData(selectedLead)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
