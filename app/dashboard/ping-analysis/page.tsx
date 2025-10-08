'use client';

import { useState, useEffect } from 'react';
import { Card, Table, Typography, DatePicker, Button, Select, Space, Statistic, Row, Col, Spin, Tabs, Badge, Tooltip, message, Alert } from 'antd';
import { BarChartOutlined, DownloadOutlined, ReloadOutlined, HeatMapOutlined, TableOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Interfaces
interface ListStats {
  list_id: string;
  description: string;
  partner_name: string;
  vertical: string;
  bid: number;
  total_pings: number;
  accepted: number;
  duplicates: number;
  duplicate_rate: number;
  unique_duplicate_phones: number;
  avg_days_between: number;
  top_matched_lists: Array<{
    list_id: string;
    description: string;
    partner_name: string;
    duplicate_count: number;
  }>;
}

interface HeatmapCell {
  incoming_list_id: string;
  incoming_description: string;
  incoming_partner: string;
  incoming_vertical: string;
  matched_list_id: string;
  matched_description: string;
  matched_partner: string;
  matched_vertical: string;
  duplicate_count: number;
  unique_phones: number;
  duplicate_rate?: number;
  sample_phones?: string[];
}

export default function PingAnalysisPage() {
  // State
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days'),  // Default to 1 week
    dayjs()
  ]);
  const [selectedVertical, setSelectedVertical] = useState<string>('ACA');  // Default to ACA for heat map
  const [minDuplicateRate, setMinDuplicateRate] = useState<number>(0);
  const [minPings, setMinPings] = useState<number>(50);  // Filter out low-volume lists
  
  // Heat map specific state
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [heatmapLists, setHeatmapLists] = useState<any[]>([]);
  
  // Data state
  const [sameVerticalStats, setSameVerticalStats] = useState<ListStats[]>([]);
  const [crossVerticalData, setCrossVerticalData] = useState<HeatmapCell[]>([]);
  const [crossVerticalLists, setCrossVerticalLists] = useState<any[]>([]);
  
  // Summary stats
  const [totalPings, setTotalPings] = useState(0);
  const [totalRejections, setTotalRejections] = useState(0);
  const [totalAccepted, setTotalAccepted] = useState(0);
  const [overallDuplicateRate, setOverallDuplicateRate] = useState(0);
  
  // Active tab
  const [activeTab, setActiveTab] = useState('heatmap');  // Default to heat map
  
  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].toISOString();
      const endDate = dateRange[1].toISOString();
      
      // Fetch same-vertical rejection stats
      const statsParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        min_rate: minDuplicateRate.toString(),
        min_pings: minPings.toString()
      });
      
      if (selectedVertical !== 'all') {
        statsParams.append('vertical', selectedVertical);
      }
      
      const statsResponse = await fetch(`/api/ping-analysis/stats?${statsParams}`);
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setSameVerticalStats(statsData.data || []);
        
        // Use metadata from API (SQL-aggregated totals, respects ALL filters including date range)
        const metadata = statsData.metadata || {};
        setTotalPings(metadata.total_pings || 0);
        setTotalRejections(metadata.total_rejections || 0);
        setTotalAccepted(metadata.total_accepted || 0);
        setOverallDuplicateRate(parseFloat(metadata.overall_duplicate_rate || '0'));
        
        console.log('[PING ANALYSIS] Summary stats (respects date filter):', {
          dateRange: `${startDate} to ${endDate}`,
          vertical: selectedVertical,
          minPings: minPings,
          pings: metadata.total_pings,
          accepted: metadata.total_accepted,
          rejected: metadata.total_rejections,
          rate: metadata.overall_duplicate_rate
        });
      }
      
      // Fetch cross-vertical duplicates
      const crossParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        min_threshold: '1'
      });
      
      const crossResponse = await fetch(`/api/ping-analysis/cross-vertical?${crossParams}`);
      const crossData = await crossResponse.json();
      
      if (crossData.success) {
        setCrossVerticalData(crossData.data?.matrix || []);
        setCrossVerticalLists(crossData.data?.lists || []);
      }
      
      // Fetch heat map data (same-vertical duplicate matrix)
      const heatmapParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        min_threshold: '0',
        min_pings: minPings.toString()
      });
      
      if (selectedVertical !== 'all') {
        heatmapParams.append('vertical', selectedVertical);
      }
      
      const heatmapResponse = await fetch(`/api/ping-analysis/heatmap?${heatmapParams}`);
      const heatmapDataResult = await heatmapResponse.json();
      
      if (heatmapDataResult.success) {
        setHeatmapData(heatmapDataResult.data?.matrix || []);
        setHeatmapLists(heatmapDataResult.data?.lists || []);
      }
      
    } catch (error) {
      console.error('Error fetching ping analysis data:', error);
      message.error('Failed to fetch ping analysis data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  
  // Handle filter changes
  const handleApplyFilters = () => {
    fetchData();
  };
  
  // Export to CSV
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      message.warning('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const value = row[h];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        return '';
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Get color for duplicate rate
  const getDuplicateRateColor = (rate: number): string => {
    if (rate < 5) return 'success';
    if (rate < 20) return 'warning';
    return 'error';
  };
  
  // Get background color for heat map cells based on PERCENTAGE of overlap
  // Formula: (duplicates between A and B) / (total duplicates for A + total duplicates for B) * 100
  const getHeatmapColorByPercentage = (percentage: number): string => {
    if (percentage === 0 || !percentage) return '#ffffff';  // White - 0%
    if (percentage < 5) return '#fef3c7';    // Light yellow - <5%
    if (percentage < 10) return '#fde68a';   // Yellow - 5-10%
    if (percentage < 20) return '#fcd34d';   // Medium yellow - 10-20%
    if (percentage < 30) return '#fbbf24';   // Dark yellow - 20-30%
    if (percentage < 40) return '#f59e0b';   // Orange - 30-40%
    if (percentage < 50) return '#f97316';   // Dark orange - 40-50%
    if (percentage < 70) return '#ef4444';   // Red - 50-70%
    return '#dc2626';  // Dark red - 70%+
  };
  
  // Build heat map matrix for visualization
  const buildHeatMapMatrix = () => {
    if (!heatmapLists || heatmapLists.length === 0) return null;
    
    // Create a lookup map for quick cell access
    const cellMap = new Map<string, number>();
    heatmapData.forEach((cell: any) => {
      const key = `${cell.incoming_list_id}__${cell.matched_list_id}`;
      cellMap.set(key, cell.duplicate_count || 0);
    });
    
    // Find max count for relative scaling (optional)
    const maxCount = Math.max(...heatmapData.map((c: any) => c.duplicate_count || 0), 1);
    
    return { cellMap, maxCount, lists: heatmapLists };
  };
  
  // Same-vertical rejection table columns
  const sameVerticalColumns = [
    {
      title: 'Partner',
      dataIndex: 'partner_name',
      key: 'partner_name',
      sorter: (a: ListStats, b: ListStats) => a.partner_name.localeCompare(b.partner_name),
      width: 150,
    },
    {
      title: 'List Description',
      dataIndex: 'description',
      key: 'description',
      sorter: (a: ListStats, b: ListStats) => a.description.localeCompare(b.description),
      width: 250,
    },
    {
      title: 'Vertical',
      dataIndex: 'vertical',
      key: 'vertical',
      width: 120,
      filters: [
        { text: 'ACA', value: 'ACA' },
        { text: 'Medicare', value: 'Medicare' },
        { text: 'Final Expense', value: 'Final Expense' }
      ],
      onFilter: (value: any, record: ListStats) => record.vertical === value,
      render: (vertical: string) => (
        <Badge 
          color={vertical === 'ACA' ? 'blue' : vertical === 'Medicare' ? 'green' : 'purple'} 
          text={vertical} 
        />
      ),
    },
    {
      title: <Tooltip title="Total ping attempts (accepted + rejected)">Total Pings</Tooltip>,
      dataIndex: 'total_pings',
      key: 'total_pings',
      sorter: (a: ListStats, b: ListStats) => a.total_pings - b.total_pings,
      width: 120,
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: 'Accepted',
      dataIndex: 'accepted',
      key: 'accepted',
      sorter: (a: ListStats, b: ListStats) => a.accepted - b.accepted,
      width: 100,
      render: (val: number) => <Text type="success">{val.toLocaleString()}</Text>,
    },
    {
      title: 'Duplicates',
      dataIndex: 'duplicates',
      key: 'duplicates',
      sorter: (a: ListStats, b: ListStats) => a.duplicates - b.duplicates,
      width: 100,
      render: (val: number) => <Text type="danger">{val.toLocaleString()}</Text>,
    },
    {
      title: 'Dupe Rate',
      dataIndex: 'duplicate_rate',
      key: 'duplicate_rate',
      sorter: (a: ListStats, b: ListStats) => a.duplicate_rate - b.duplicate_rate,
      width: 100,
      render: (rate: number) => {
        const color = rate < 5 ? '#52c41a' : rate < 20 ? '#faad14' : '#ff4d4f';
        return (
          <Text style={{ color, fontWeight: 'bold' }}>
            {rate.toFixed(2)}%
          </Text>
        );
      },
    },
    {
      title: 'Unique Phones',
      dataIndex: 'unique_duplicate_phones',
      key: 'unique_duplicate_phones',
      sorter: (a: ListStats, b: ListStats) => a.unique_duplicate_phones - b.unique_duplicate_phones,
      width: 120,
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: <Tooltip title="Average days between original submission and duplicate attempt">Avg Days</Tooltip>,
      dataIndex: 'avg_days_between',
      key: 'avg_days_between',
      sorter: (a: ListStats, b: ListStats) => a.avg_days_between - b.avg_days_between,
      width: 100,
      render: (days: number) => `${days.toFixed(1)}d`,
    },
  ];
  
  // Cross-vertical duplicate table columns
  const crossVerticalColumns = [
    {
      title: 'List A',
      dataIndex: 'incoming_description',
      key: 'incoming_description',
      width: 200,
      render: (text: string, record: HeatmapCell) => (
        <div>
          <div className="font-medium">{record.incoming_partner}</div>
          <div className="text-xs text-gray-500">{text}</div>
          <Badge color={record.incoming_vertical === 'ACA' ? 'blue' : record.incoming_vertical === 'Medicare' ? 'green' : 'purple'} 
                 text={record.incoming_vertical} />
        </div>
      ),
    },
    {
      title: 'List B',
      dataIndex: 'matched_description',
      key: 'matched_description',
      width: 200,
      render: (text: string, record: HeatmapCell) => (
        <div>
          <div className="font-medium">{record.matched_partner}</div>
          <div className="text-xs text-gray-500">{text}</div>
          <Badge color={record.matched_vertical === 'ACA' ? 'blue' : record.matched_vertical === 'Medicare' ? 'green' : 'purple'} 
                 text={record.matched_vertical} />
        </div>
      ),
    },
    {
      title: 'Shared Phones',
      dataIndex: 'unique_phones',
      key: 'unique_phones',
      sorter: (a: HeatmapCell, b: HeatmapCell) => a.unique_phones - b.unique_phones,
      width: 130,
      render: (val: number) => <Text strong>{val.toLocaleString()}</Text>,
    },
    {
      title: 'Total Overlaps',
      dataIndex: 'duplicate_count',
      key: 'duplicate_count',
      sorter: (a: HeatmapCell, b: HeatmapCell) => a.duplicate_count - b.duplicate_count,
      width: 130,
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: 'Sample Phones',
      dataIndex: 'sample_phones',
      key: 'sample_phones',
      width: 250,
      render: (phones: string[]) => (
        <div className="text-xs font-mono">
          {phones?.slice(0, 3).map((phone, idx) => (
            <div key={idx}>{phone}</div>
          ))}
          {phones?.length > 3 && <div className="text-gray-500">+{phones.length - 3} more...</div>}
        </div>
      ),
    },
  ];
  
  return (
    <div className="p-6 ml-16">
      <div className="mb-6">
        <Title level={2}>
          <BarChartOutlined className="mr-2" />
          Ping Analysis
        </Title>
        <Text type="secondary">
          Analyze duplicate lead patterns across lists and verticals
        </Text>
      </div>
      
      {/* Filter Controls */}
      <Card className="mb-6">
        <Space size="middle" wrap>
          <div>
            <Text strong>Date Range:</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                }
              }}
              className="ml-2"
            />
          </div>
          
          <div>
            <Text strong>Vertical:</Text>
            <Select
              value={selectedVertical}
              onChange={(value) => {
                setSelectedVertical(value);
                console.log('Vertical changed to:', value);
              }}
              style={{ width: 150, marginLeft: 8 }}
            >
              <Option value="ACA">ACA</Option>
              <Option value="Medicare">Medicare</Option>
              <Option value="Final Expense">Final Expense</Option>
              <Option value="all">All Verticals</Option>
            </Select>
          </div>
          
          <div>
            <Text strong>Min Dupe Rate:</Text>
            <Select
              value={minDuplicateRate}
              onChange={setMinDuplicateRate}
              style={{ width: 120, marginLeft: 8 }}
            >
              <Option value={0}>0%</Option>
              <Option value={5}>5%</Option>
              <Option value={10}>10%</Option>
              <Option value={20}>20%</Option>
              <Option value={30}>30%</Option>
            </Select>
          </div>
          
          <div>
            <Text strong>Min Pings:</Text>
            <Select
              value={minPings}
              onChange={setMinPings}
              style={{ width: 120, marginLeft: 8 }}
            >
              <Option value={0}>No Min</Option>
              <Option value={50}>50+</Option>
              <Option value={100}>100+</Option>
              <Option value={500}>500+</Option>
              <Option value={1000}>1,000+</Option>
              <Option value={5000}>5,000+</Option>
            </Select>
          </div>
          
          <Button 
            type="primary" 
            icon={<ReloadOutlined />}
            onClick={handleApplyFilters}
            loading={loading}
          >
            Apply Filters
          </Button>
        </Space>
      </Card>
      
      {/* Summary Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title={`Total Pings (${dateRange[0].format('MMM D')} - ${dateRange[1].format('MMM D')})`}
              value={totalPings}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Accepted Leads"
              value={totalAccepted}
              valueStyle={{ color: '#52c41a' }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {selectedVertical !== 'all' && `${selectedVertical} vertical`}
              {minPings > 0 && ` • ${minPings}+ pings`}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Rejected (Dupes)"
              value={totalRejections}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div className="text-xs text-gray-500 mt-1">
              Same-vertical duplicates
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Overall Dupe Rate"
              value={overallDuplicateRate.toFixed(2)}
              suffix="%"
              valueStyle={{ 
                color: overallDuplicateRate < 5 ? '#52c41a' : overallDuplicateRate < 20 ? '#faad14' : '#ff4d4f' 
              }}
            />
            <div className="text-xs text-gray-500 mt-1">
              {totalPings > 0 ? `${totalRejections.toLocaleString()} of ${totalPings.toLocaleString()} pings` : 'No data'}
            </div>
          </Card>
        </Col>
      </Row>
      
      {/* Tabbed Views */}
      <Card>
        <Tabs 
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'heatmap',
              label: (
                <span>
                  <HeatMapOutlined /> Duplicate Heat Map
                  {heatmapData.length > 0 && <Badge count={heatmapData.length} style={{ marginLeft: 8 }} />}
                </span>
              ),
              children: (
                <>
                  <div className="mb-4">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Alert
                        message="Same-Vertical Duplicate Heat Map"
                        description={`Shows duplicate overlap between lists in the ${selectedVertical} vertical. Each cell represents how many duplicates one list shares with another. Diagonal cells (same list) are empty.`}
                        type="info"
                        showIcon
                        icon={<InfoCircleOutlined />}
                      />
                      
                      <div className="flex items-center justify-between">
                        <Text strong>Heat Map for: {selectedVertical} vertical</Text>
                        <Text type="secondary">
                          {heatmapLists.length} lists • {heatmapData.length} list pairs with overlaps
                        </Text>
                      </div>
                    </Space>
                  </div>
                  
                  <Spin spinning={loading}>
                    {heatmapLists.length === 0 ? (
                      <Card className="text-center p-8">
                        <InfoCircleOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                        <Title level={4}>No Data Available Yet</Title>
                        <Text>
                          Heat map data will appear once rejection tracking accumulates.
                          Check back in 24-48 hours, or view Cross-Vertical Duplicates for immediate insights.
                        </Text>
                      </Card>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="inline-block min-w-full">
                          <table className="border-collapse" style={{ fontSize: '11px' }}>
                            <thead>
                              <tr>
                                <th className="sticky left-0 bg-white z-10 p-2 border border-gray-300 min-w-[120px]"></th>
                                {heatmapLists.map((list: any, idx: number) => (
                                  <th 
                                    key={idx} 
                                    className="p-1 border border-gray-300 min-w-[100px] max-w-[100px]"
                                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', height: '200px' }}
                                  >
                                    <div className="text-xs truncate" title={list.description}>
                                      {list.description || 'Unknown'}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {heatmapLists.map((rowList: any, rowIdx: number) => (
                                <tr key={rowIdx}>
                                  <td className="sticky left-0 bg-white z-10 p-2 border border-gray-300 text-xs">
                                    <div className="truncate max-w-[180px]" title={rowList.description}>
                                      {rowList.description || 'Unknown'}
                                    </div>
                                  </td>
                                  {heatmapLists.map((colList: any, colIdx: number) => {
                                    // Same list - keep empty/white
                                    if (rowList.list_id === colList.list_id) {
                                      return (
                                        <td 
                                          key={colIdx} 
                                          className="border border-gray-300 min-w-[100px] max-w-[100px] h-[100px]"
                                          style={{ backgroundColor: '#f5f5f5' }}
                                        >
                                          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                                            —
                                          </div>
                                        </td>
                                      );
                                    }
                                    
                                    // Different lists - show duplicate count and calculate overlap percentage
                                    const cellData = heatmapData.find(
                                      (d: any) => d.incoming_list_id === rowList.list_id && d.matched_list_id === colList.list_id
                                    );
                                    
                                    // Also check reverse direction for bidirectional data
                                    const reverseCellData = heatmapData.find(
                                      (d: any) => d.incoming_list_id === colList.list_id && d.matched_list_id === rowList.list_id
                                    );
                                    
                                    const duplicateCount = cellData?.duplicate_count || 0;
                                    const reverseDuplicateCount = reverseCellData?.duplicate_count || 0;
                                    
                                    // Get total duplicates for both lists
                                    const rowListTotalDupes = sameVerticalStats.find(s => s.list_id === rowList.list_id)?.duplicates || 0;
                                    const colListTotalDupes = sameVerticalStats.find(s => s.list_id === colList.list_id)?.duplicates || 0;
                                    const totalDupesBothLists = rowListTotalDupes + colListTotalDupes;
                                    
                                    // Calculate overlap percentage: (duplicates between A and B) / (total duplicates for A + B) * 100
                                    const overlapPercentage = totalDupesBothLists > 0 
                                      ? ((duplicateCount + reverseDuplicateCount) / totalDupesBothLists) * 100 
                                      : 0;
                                    
                                    const bgColor = getHeatmapColorByPercentage(overlapPercentage);
                                    const textColor = overlapPercentage > 40 ? '#ffffff' : '#000000';
                                    
                                    return (
                                      <Tooltip 
                                        key={colIdx}
                                        title={
                                          <div>
                                            <div><strong>From:</strong> {rowList.description}</div>
                                            <div><strong>To:</strong> {colList.description}</div>
                                            <div><strong>Duplicates:</strong> {duplicateCount}</div>
                                            {reverseDuplicateCount > 0 && <div><strong>Reverse:</strong> {reverseDuplicateCount}</div>}
                                            <div><strong>Overlap %:</strong> {overlapPercentage.toFixed(1)}%</div>
                                            <div className="text-xs mt-1 opacity-75">
                                              ({duplicateCount + reverseDuplicateCount} of {totalDupesBothLists} total dupes)
                                            </div>
                                          </div>
                                        }
                                      >
                                        <td 
                                          className="border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity min-w-[100px] max-w-[100px] h-[100px]"
                                          style={{ 
                                            backgroundColor: bgColor,
                                            color: textColor
                                          }}
                                        >
                                          <div className="flex flex-col items-center justify-center h-full">
                                            {(duplicateCount > 0 || reverseDuplicateCount > 0) && (
                                              <>
                                                <div className="font-bold text-base">{duplicateCount || reverseDuplicateCount}</div>
                                                <div className="text-xs mt-0.5">{overlapPercentage.toFixed(0)}%</div>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </Tooltip>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Legend */}
                        <div className="mt-4 p-4 bg-gray-50 rounded">
                          <Text strong className="block mb-2">Color Scale (Overlap Percentage):</Text>
                          <Text className="text-xs text-gray-600 block mb-3">
                            Percentage = (Duplicates between lists A & B) / (Total duplicates for A + Total duplicates for B) × 100
                          </Text>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#ffffff' }}></div>
                              <Text className="text-xs">0%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#fef3c7' }}></div>
                              <Text className="text-xs">&lt;5%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#fde68a' }}></div>
                              <Text className="text-xs">5-10%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#fcd34d' }}></div>
                              <Text className="text-xs">10-20%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#fbbf24' }}></div>
                              <Text className="text-xs">20-30%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#f59e0b' }}></div>
                              <Text className="text-xs">30-40%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#f97316' }}></div>
                              <Text className="text-xs">40-50%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#ef4444' }}></div>
                              <Text className="text-xs">50-70%</Text>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-8 border border-gray-300" style={{ backgroundColor: '#dc2626' }}></div>
                              <Text className="text-xs">70%+</Text>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Spin>
                </>
              ),
            },
            {
              key: 'same-vertical',
              label: (
                <span>
                  <TableOutlined /> List Stats Table
                  {totalRejections > 0 && <Badge count={totalRejections} style={{ marginLeft: 8 }} />}
                </span>
              ),
              children: (
                <>
                  {sameVerticalStats.length === 0 && !loading && (
                    <Card className="mb-4 bg-blue-50 border-blue-200">
                      <Space>
                        <InfoCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                        <div>
                          <Title level={5} className="mb-0">Collecting Data...</Title>
                          <Text>
                            Same-vertical duplicate rejections will appear here as they occur.
                            This data started collecting from the moment this feature was deployed.
                            Check back in 24-48 hours for meaningful analytics.
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  )}
                  
                  <div className="mb-4">
                    <Button 
                      icon={<DownloadOutlined />}
                      onClick={() => exportToCSV(sameVerticalStats, 'same-vertical-duplicates')}
                      disabled={sameVerticalStats.length === 0}
                    >
                      Export to CSV
                    </Button>
                  </div>
                  
                  <Spin spinning={loading}>
                    <Table
                      columns={sameVerticalColumns}
                      dataSource={sameVerticalStats}
                      rowKey="list_id"
                      pagination={{
                        pageSize: 50,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} lists`
                      }}
                      expandable={{
                        expandedRowRender: (record) => {
                          if (!record.top_matched_lists || record.top_matched_lists.length === 0) {
                            return <Text type="secondary">No matched lists data available</Text>;
                          }
                          
                          return (
                            <div className="p-4 bg-gray-50">
                              <Title level={5}>Top Duplicate Sources:</Title>
                              <ul className="list-disc pl-6">
                                {record.top_matched_lists.map((matched, idx) => (
                                  <li key={idx}>
                                    <Text strong>{matched.partner_name}</Text> - {matched.description}
                                    <Text type="danger" className="ml-2">({matched.duplicate_count} duplicates)</Text>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        },
                        rowExpandable: (record) => record.top_matched_lists && record.top_matched_lists.length > 0
                      }}
                      scroll={{ x: 1200 }}
                    />
                  </Spin>
                </>
              ),
            },
            {
              key: 'cross-vertical',
              label: (
                <span>
                  <HeatMapOutlined /> Cross-Vertical Duplicates
                  {crossVerticalData.length > 0 && <Badge count={crossVerticalData.length} style={{ marginLeft: 8 }} />}
                </span>
              ),
              children: (
                <>
                  <Card className="mb-4 bg-yellow-50 border-yellow-200">
                    <Space>
                      <WarningOutlined style={{ fontSize: 24, color: '#faad14' }} />
                      <div>
                        <Title level={5} className="mb-0">Cross-Vertical Duplicates (Accepted Leads)</Title>
                        <Text>
                          These leads were ACCEPTED despite having duplicate phone numbers because they came from different verticals.
                          This shows potential cross-vertical contamination in your data sources.
                        </Text>
                      </div>
                    </Space>
                  </Card>
                  
                  <div className="mb-4">
                    <Space>
                      <Button 
                        icon={<DownloadOutlined />}
                        onClick={() => exportToCSV(crossVerticalData, 'cross-vertical-duplicates')}
                        disabled={crossVerticalData.length === 0}
                      >
                        Export to CSV
                      </Button>
                      <Text type="secondary">
                        Showing {crossVerticalData.length} list pairs with phone overlaps
                      </Text>
                    </Space>
                  </div>
                  
                  <Spin spinning={loading}>
                    <Table
                      columns={crossVerticalColumns}
                      dataSource={crossVerticalData}
                      rowKey={(record) => `${record.incoming_list_id}-${record.matched_list_id}`}
                      pagination={{
                        pageSize: 50,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} list pairs`
                      }}
                      scroll={{ x: 1000 }}
                    />
                  </Spin>
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

