'use client';

import { useState, useEffect } from 'react';
import { Table, Modal, Button, Typography, Spin, Tag, Space, Input, DatePicker, Tooltip } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
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
  bid?: number | string; // Amount bid for the lead
  call_status?: string; // Status of the call (answered, voicemail, etc.)
  call_length?: number | string; // Length of the call in seconds or formatted string
  custom_fields?: Record<string, any>;
  // Add other optional fields
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  trusted_form_cert_url?: string;
  traffic_source?: string;
  birth_date?: string; // Add birth_date as a possible direct field
  age_range?: string; // Add age_range as a possible direct field
  income_bracket?: string; // Add income_bracket as a possible direct field
  homeowner_status?: string; // Add homeowner_status as a possible direct field
  raw_submission?: any; // For storing the original submission data
  [key: string]: any; // Allow for dynamic field access
}

// Define a type for list routing data
interface ListRouting {
  id: string;
  list_id: string;
  campaign_id: string;
  description?: string;
  bid: number;
  active: boolean;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  // Add state for list routings
  const [listRoutings, setListRoutings] = useState<ListRouting[]>([]);
  const [listRoutingsLoading, setListRoutingsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  
  // Create a map for quick lookup of list routings by list_id
  const [listRoutingMap, setListRoutingMap] = useState<Record<string, number>>({});

  // Fetch leads on component mount or when pagination changes
  useEffect(() => {
    fetchLeads();
    fetchListRoutings(); // Also fetch list routings
  }, [pagination.current, pagination.pageSize]);
  
  // Fetch list routings and create a lookup map
  const fetchListRoutings = async () => {
    try {
      setListRoutingsLoading(true);
      const response = await fetch('/api/list-routings', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setListRoutings(result.data);
        
        // Create a mapping of list_id to bid for quick lookup
        const routingMap: Record<string, number> = {};
        result.data.forEach((routing: ListRouting) => {
          if (routing.active && routing.list_id && routing.bid) {
            routingMap[routing.list_id] = routing.bid;
          }
        });
        
        setListRoutingMap(routingMap);
        console.log('List routing map created:', routingMap);
      } else {
        console.error('Failed to fetch list routings:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching list routings:', error);
    } finally {
      setListRoutingsLoading(false);
    }
  };

  // When search text or date range changes, reset to first page and trigger a new fetch
  useEffect(() => {
    // Only trigger if the values actually changed and are not initial render
    if (searchText !== '' || dateRange !== null) {
      setPagination({
        ...pagination,
        current: 1, // Reset to first page
      });
    }
  }, [searchText, dateRange]);

  // Function to fetch leads from the API with pagination
  const fetchLeads = async () => {
    try {
      setLoading(true);
      
      // Create URL with pagination parameters
      const url = new URL('/api/leads/list', window.location.origin);
      url.searchParams.append('page', pagination.current.toString());
      url.searchParams.append('pageSize', pagination.pageSize.toString());
      
      // Add search and date filters if present
      if (searchText) url.searchParams.append('search', searchText);
      if (dateRange && dateRange[0] && dateRange[1]) {
        url.searchParams.append('startDate', dateRange[0]);
        url.searchParams.append('endDate', dateRange[1]);
      }
      
      const response = await fetch(url.toString(), {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'test_key_123' }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setLeads(result.data); // Set leads directly from API
        
        // Update pagination with the total from the API
        if (result.pagination) {
          setPagination({
            current: result.pagination.page,
            pageSize: result.pagination.pageSize,
            total: result.pagination.total,
          });
        }
      } else {
        console.error('Failed to fetch leads:', result.error);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search and filter action handlers
  const handleSearch = () => {
    setPagination({
      ...pagination,
      current: 1, // Reset to first page
    });
    // fetchLeads will be triggered by the useEffect that watches pagination
  };
  
  const handleClearFilters = () => {
    setSearchText('');
    setDateRange(null);
    setPagination({
      ...pagination,
      current: 1, // Reset to first page
    });
    // fetchLeads will be triggered by the useEffect that watches pagination
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

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    // Handle different phone formats (E.164, etc.)
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX if it's a 10-digit US number
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // Handle +1 prefixed numbers
      return `+1 (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7)}`;
    }
    
    // Return original if not a standard format
    return phone;
  };

  // Helper function to get value from custom_fields or directly from lead
  const getLeadField = (record: Lead, fieldName: string) => {
    // Check if the field exists directly on the lead object
    if (record[fieldName as keyof Lead] !== undefined) {
      return record[fieldName as keyof Lead];
    }
    // Otherwise check in custom_fields
    if (record.custom_fields && record.custom_fields[fieldName] !== undefined) {
      return record.custom_fields[fieldName];
    }
    // Also check common variations of the field name
    const variations = {
      'income_bracket': ['income', 'income_level', 'annual_income'],
      'age_range': ['age', 'age_group'],
      'dob': ['date_of_birth', 'birth_date', 'birthdate', 'birth_date'],
      'homeowner_status': ['homeowner', 'home_owner', 'owns_home', 'property_ownership'],
      'subIDs': ['sub_id', 'subid', 'sub_ids', 'subids', 'sub']
    };
    
    if (variations[fieldName as keyof typeof variations]) {
      for (const variant of variations[fieldName as keyof typeof variations]) {
        if (record.custom_fields && record.custom_fields[variant] !== undefined) {
          return record.custom_fields[variant];
        }
      }
    }
    
    return null;
  };
  
  // Format age information - prioritize birth_date as requested
  const formatAgeInfo = (record: Lead) => {
    // Check for birth_date directly in the record and in custom_fields
    let birthDate = null;
    
    // First try direct birth_date field
    if (record.birth_date) {
      birthDate = record.birth_date;
    } else if (record.custom_fields?.birth_date) {
      birthDate = record.custom_fields.birth_date;
    } 
    // Then check for variations
    else {
      const dobValue = getLeadField(record, 'dob');
      if (dobValue) birthDate = dobValue;
    }
    
    // If we have a birth date, format it and calculate age
    if (birthDate) {
      try {
        const dateObj = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - dateObj.getFullYear();
        const m = today.getMonth() - dateObj.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dateObj.getDate())) {
          age--;
        }
        
        // Format date in a readable way
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        return `${age} years (${formattedDate})`;
      } catch (e) {
        // If parsing fails, just show the raw value
        return String(birthDate);
      }
    }
    
    // Fallback to age_range if available
    const ageRange = getLeadField(record, 'age_range');
    if (ageRange) {
      return ageRange;
    }
    
    return 'N/A';
  };
  
  // Format SubIDs (might be an array or a string)
  const formatSubIDs = (record: Lead) => {
    const subIDs = getLeadField(record, 'subIDs');
    if (!subIDs) return 'N/A';
    
    if (Array.isArray(subIDs)) {
      return subIDs.join(', ');
    }
    return String(subIDs);
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
      sorter: (a, b) => a.id.localeCompare(b.id),
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
      sorter: (a, b) => a.email.localeCompare(b.email),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      sorter: (a, b) => a.phone.localeCompare(b.phone),
    },
    {
      title: 'List ID',
      dataIndex: 'list_id',
      key: 'list_id',
      ellipsis: true,
      sorter: (a, b) => a.list_id.localeCompare(b.list_id),
    },
    {
      title: 'State',
      key: 'state',
      render: (_, record) => record.state || getLeadField(record, 'state') || 'N/A',
      width: 80,
      sorter: (a, b) => {
        const stateA = a.state || getLeadField(a, 'state') || 'N/A';
        const stateB = b.state || getLeadField(b, 'state') || 'N/A';
        return stateA.localeCompare(stateB);
      },
    },
    {
      title: 'Income',
      key: 'income_bracket',
      render: (_, record) => getLeadField(record, 'income_bracket') || 'N/A',
      sorter: (a, b) => {
        const incomeA = getLeadField(a, 'income_bracket') || 'N/A';
        const incomeB = getLeadField(b, 'income_bracket') || 'N/A';
        return incomeA.localeCompare(incomeB);
      },
    },
    {
      title: 'Age/DOB',
      key: 'age_info',
      render: (_, record) => formatAgeInfo(record),
      sorter: (a, b) => {
        // Try to sort by birth_date first if available
        const dateA = a.birth_date || (a.custom_fields?.birth_date) || getLeadField(a, 'dob');
        const dateB = b.birth_date || (b.custom_fields?.birth_date) || getLeadField(b, 'dob');
        
        if (dateA && dateB) {
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        }
        
        // Otherwise sort by the display string
        return formatAgeInfo(a).localeCompare(formatAgeInfo(b));
      },
    },
    {
      title: 'Homeowner',
      key: 'homeowner_status',
      render: (_, record) => {
        const status = getLeadField(record, 'homeowner_status');
        if (status === true || status === 'true' || status === 'yes' || status === 'Yes' || status === 'owner') {
          return <Tag color="green">Yes</Tag>;
        } else if (status === false || status === 'false' || status === 'no' || status === 'No' || status === 'renter') {
          return <Tag color="orange">No</Tag>;
        }
        return status || 'N/A';
      },
      sorter: (a, b) => {
        const statusA = getLeadField(a, 'homeowner_status');
        const statusB = getLeadField(b, 'homeowner_status');
        
        // Convert to normalized string values for comparison
        const getNormalizedValue = (status: any) => {
          if (status === true || status === 'true' || status === 'yes' || status === 'Yes' || status === 'owner') {
            return 'yes';
          } else if (status === false || status === 'false' || status === 'no' || status === 'No' || status === 'renter') {
            return 'no';
          }
          return String(status || 'N/A');
        };
        
        return getNormalizedValue(statusA).localeCompare(getNormalizedValue(statusB));
      },
    },
    {
      title: 'SubIDs',
      key: 'subIDs',
      render: (_, record) => formatSubIDs(record),
      ellipsis: true,
      sorter: (a, b) => formatSubIDs(a).localeCompare(formatSubIDs(b)),
    },
    {
      title: 'Campaign ID',
      dataIndex: 'campaign_id',
      key: 'campaign_id',
      ellipsis: true,
      sorter: (a, b) => a.campaign_id.localeCompare(b.campaign_id),
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
      title: 'Bid',
      dataIndex: 'bid',
      key: 'bid',
      render: (_, record) => {
        // IMPORTANT: Always prioritize the stored bid value in the lead record
        // This ensures we display the historical bid value from when the lead was created
        // even if list routing settings have changed since then
        const recordBid = record.bid || getLeadField(record, 'bid');
        if (recordBid !== undefined && recordBid !== null) {
          return `$${parseFloat(String(recordBid)).toFixed(2)}`;
        }
        
        // Only as a fallback for older leads without stored bid values,
        // we can look up from current list routing settings
        if (record.list_id && listRoutingMap[record.list_id]) {
          return `$${listRoutingMap[record.list_id].toFixed(2)}`;
        }
        
        // Last resort fallback for specific vendors (only for leads created before this update)
        if (record.list_id) {
          if (record.list_id.toLowerCase().includes('onpoint')) {
            return '$0.50';
          } else if (record.list_id.toLowerCase().includes('juiced')) {
            return '$1.00';
          }
        }
        
        return 'N/A';
      },
      sorter: (a, b) => {
        const bidA = parseFloat(a.bid || getLeadField(a, 'bid') || 0);
        const bidB = parseFloat(b.bid || getLeadField(b, 'bid') || 0);
        return bidA - bidB;
      },
    },
    {
      title: 'Call Status',
      key: 'call_status',
      render: (_, record) => {
        const callStatus = record.call_status || getLeadField(record, 'call_status');
        if (!callStatus) return <Tag color="default">Not Available</Tag>;
        
        // Define tag colors based on call status (can be expanded later)
        const statusColors: Record<string, string> = {
          'answered': 'green',
          'completed': 'green',
          'voicemail': 'orange',
          'no-answer': 'red',
          'busy': 'red',
          'failed': 'red',
          'in-progress': 'blue',
          'scheduled': 'purple',
        };
        
        const color = statusColors[callStatus.toLowerCase()] || 'default';
        return <Tag color={color}>{callStatus}</Tag>;
      },
      sorter: (a, b) => {
        const statusA = (a.call_status || getLeadField(a, 'call_status') || '').toLowerCase();
        const statusB = (b.call_status || getLeadField(b, 'call_status') || '').toLowerCase();
        return statusA.localeCompare(statusB);
      },
    },
    {
      title: 'Call Length',
      key: 'call_length',
      render: (_, record) => {
        const callLength = record.call_length || getLeadField(record, 'call_length');
        if (!callLength) return 'N/A';
        
        // Format seconds to MM:SS format
        if (typeof callLength === 'number') {
          const minutes = Math.floor(callLength / 60);
          const seconds = callLength % 60;
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // If already formatted, return as is
        return callLength;
      },
      sorter: (a, b) => {
        const lengthA = a.call_length || getLeadField(a, 'call_length') || 0;
        const lengthB = b.call_length || getLeadField(b, 'call_length') || 0;
        
        // Handle numeric or string values
        if (typeof lengthA === 'number' && typeof lengthB === 'number') {
          return lengthA - lengthB;
        }
        
        return String(lengthA).localeCompare(String(lengthB));
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
            onPressEnter={handleSearch}
          />
          
          <RangePicker 
            onChange={(dates, dateStrings) => setDateRange(dateStrings as [string, string])}
            style={{ width: 300 }}
          />
          
          <Button onClick={handleSearch} type="primary">
            Search
          </Button>
          
          <Button onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </Space>
        
        <Button onClick={fetchLeads}>
          Refresh
        </Button>
      </div>
      
      {/* Leads Table */}
      <Spin spinning={loading}>
        <Table 
          columns={columns} 
          dataSource={leads}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            showTotal: (total: number) => `Total ${total} leads`
          }}
          onChange={(paginationInfo) => {
            setPagination({
              current: paginationInfo.current || 1,
              pageSize: paginationInfo.pageSize || 10,
              total: pagination.total,
            });
          }}
        />
      </Spin>
      
      {/* Lead Details Modal */}
      <Modal
        title="Lead Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="view-json" onClick={handleViewJson}>
            View Raw JSON
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedLead && (
          <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}>Contact Information</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text strong>Name:</Text>{' '}
                    {selectedLead.first_name} {selectedLead.last_name}
                  </div>
                  <div>
                    <Text strong>Email:</Text>{' '}
                    <a href={`mailto:${selectedLead.email}`}>{selectedLead.email}</a>
                  </div>
                  <div>
                    <Text strong>Phone:</Text>{' '}
                    <a href={`tel:${selectedLead.phone}`}>{formatPhoneNumber(selectedLead.phone)}</a>
                  </div>
                  <div>
                    <Text strong>Address:</Text>{' '}
                    {selectedLead.address ? (
                      <>
                        {selectedLead.address}, {selectedLead.city}, {selectedLead.state} {selectedLead.zip_code}
                      </>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <Title level={4}>Tracking Information</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text strong>List ID:</Text>{' '}
                    {selectedLead.list_id}
                  </div>
                  <div>
                    <Text strong>Campaign ID:</Text>{' '}
                    {selectedLead.campaign_id}
                  </div>
                  <div>
                    <Text strong>Source:</Text>{' '}
                    {selectedLead.traffic_source || selectedLead.source || 'N/A'}
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
                </div>
              </div>
                
              <div>
                <Title level={4}>Additional Information</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text strong>Income Bracket:</Text>{' '}
                    {getLeadField(selectedLead, 'income_bracket') || 'N/A'}
                  </div>
                  <div>
                    <Text strong>Age/DOB:</Text>{' '}
                    {formatAgeInfo(selectedLead)}
                  </div>
                  <div>
                    <Text strong>Homeowner Status:</Text>{' '}
                    {getLeadField(selectedLead, 'homeowner_status') || 'N/A'}
                  </div>
                  <div>
                    <Text strong>SubIDs:</Text>{' '}
                    {formatSubIDs(selectedLead)}
                  </div>
                  <div>
                    <Text strong>TrustedForm Certificate:</Text>{' '}
                    {selectedLead.trusted_form_cert_url ? (
                      <a href={selectedLead.trusted_form_cert_url} target="_blank" rel="noopener noreferrer">
                        View Certificate
                      </a>
                    ) : 'N/A'}
                  </div>
                  <div>
                    <Text strong>Bid Amount:</Text>{' '}
                    {(() => {
                      // IMPORTANT: Always prioritize the stored bid value in the lead record
                      // This ensures we display the historical bid value from when the lead was created
                      // even if list routing settings have changed since then
                      const recordBid = selectedLead.bid || getLeadField(selectedLead, 'bid');
                      if (recordBid !== undefined && recordBid !== null) {
                        return `$${parseFloat(String(recordBid)).toFixed(2)}`;
                      }
                      
                      // Only as a fallback for older leads without stored bid values,
                      // we can look up from current list routing settings
                      if (selectedLead.list_id && listRoutingMap[selectedLead.list_id]) {
                        return `$${listRoutingMap[selectedLead.list_id].toFixed(2)}`;
                      }
                      
                      // Last resort fallback for specific vendors (only for leads created before this update)
                      if (selectedLead.list_id) {
                        if (selectedLead.list_id.toLowerCase().includes('onpoint')) {
                          return '$0.50';
                        } else if (selectedLead.list_id.toLowerCase().includes('juiced')) {
                          return '$1.00';
                        }
                      }
                      
                      return 'N/A';
                    })()}
                  </div>
                </div>
              </div>
                
              <div>
                <Title level={4}>Call Information</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text strong>Call Status:</Text>{' '}
                    {selectedLead.call_status || getLeadField(selectedLead, 'call_status') || 'N/A'}
                  </div>
                  <div>
                    <Text strong>Call Length:</Text>{' '}
                    {(() => {
                      const callLength = selectedLead.call_length || getLeadField(selectedLead, 'call_length');
                      if (!callLength) return 'N/A';
                      
                      // Format seconds to MM:SS format if it's a number
                      if (typeof callLength === 'number') {
                        const minutes = Math.floor(callLength / 60);
                        const seconds = callLength % 60;
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      }
                      
                      // If already formatted, return as is
                      return callLength;
                    })()}
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
