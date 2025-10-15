'use client';

import { useState, useEffect } from 'react';
import USAMap from 'react-usa-map';
import { Card, Select, DatePicker, Spin, Statistic, Row, Col, Tooltip as AntTooltip, message } from 'antd';
import { MapPin, TrendingUp } from 'lucide-react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface StateData {
  state_code: string;
  total_leads: number;
  aca_leads: number;
  medicare_leads: number;
  fe_leads: number;
  unique_phones: number;
  unique_lists: number;
  avg_bid: number;
}

interface StateLeadMapProps {
  defaultVertical?: string;
  defaultDays?: number;
}

export default function StateLeadMap({ defaultVertical = 'all', defaultDays = 30 }: StateLeadMapProps) {
  const [stateData, setStateData] = useState<StateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState(defaultVertical);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(defaultDays, 'days'),
    dayjs()
  ]);
  const [hoveredState, setHoveredState] = useState<StateData | null>(null);
  const [maxLeads, setMaxLeads] = useState(0);
  const [minLeads, setMinLeads] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  
  // Fetch state data
  const fetchStateData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].startOf('day').toISOString();
      const endDate = dateRange[1].add(1, 'day').startOf('day').toISOString();
      
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });
      
      if (selectedVertical !== 'all') {
        params.append('vertical', selectedVertical);
      }
      
      const response = await fetch(`/api/state-map-data?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setStateData(result.data || []);
        setMaxLeads(result.metadata?.max_leads || 0);
        setMinLeads(result.metadata?.min_leads || 0);
        setTotalLeads(result.metadata?.total_leads || 0);
      } else {
        message.error('Failed to load state map data');
      }
    } catch (error) {
      console.error('Error fetching state map data:', error);
      message.error('Error loading map data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchStateData();
  }, []);
  
  // Get color for state based on lead count (choropleth)
  const getStateColor = (stateCode: string): string => {
    const state = stateData.find(s => s.state_code === stateCode);
    if (!state || state.total_leads === 0) return '#e5e7eb';  // Gray for no data
    
    const leadCount = state.total_leads;
    const range = maxLeads - minLeads;
    const normalized = range > 0 ? (leadCount - minLeads) / range : 0;
    
    // Color scale from light blue to dark blue
    if (normalized === 0) return '#dbeafe';      // Very light blue
    if (normalized < 0.2) return '#bfdbfe';      // Light blue
    if (normalized < 0.4) return '#93c5fd';      // Medium light blue
    if (normalized < 0.6) return '#60a5fa';      // Medium blue
    if (normalized < 0.8) return '#3b82f6';      // Blue
    return '#1d4ed8';  // Dark blue
  };
  
  // Configure state colors
  const statesCustomConfig = () => {
    const config: any = {};
    stateData.forEach(state => {
      config[state.state_code] = {
        fill: getStateColor(state.state_code),
        clickHandler: () => handleStateClick(state)
      };
    });
    return config;
  };
  
  // Handle state click
  const handleStateClick = (state: StateData) => {
    console.log('State clicked:', state);
    setHoveredState(state);
  };
  
  // Handle state hover
  const mapHandler = (event: any) => {
    const stateCode = event.target.dataset.name;
    if (stateCode) {
      const state = stateData.find(s => s.state_code === stateCode);
      if (state) {
        setHoveredState(state);
      }
    }
  };
  
  return (
    <Card className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Lead Distribution by State</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Date Range:</span>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                }
              }}
              size="small"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Vertical:</span>
            <Select
              value={selectedVertical}
              onChange={setSelectedVertical}
              size="small"
              style={{ width: 150 }}
            >
              <Option value="all">All Verticals</Option>
              <Option value="ACA">ACA</Option>
              <Option value="Medicare">Medicare</Option>
              <Option value="Final Expense">Final Expense</Option>
            </Select>
          </div>
          
          <button
            onClick={fetchStateData}
            className="px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Update Map
          </button>
        </div>
      </div>
      
      {/* Summary Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Statistic
            title="Total Leads"
            value={totalLeads}
            prefix={<TrendingUp className="w-4 h-4" />}
            valueStyle={{ fontSize: '20px' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="States Active"
            value={stateData.length}
            valueStyle={{ fontSize: '20px' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Highest State"
            value={stateData[0]?.state_code || 'N/A'}
            suffix={stateData[0] ? `(${stateData[0].total_leads.toLocaleString()})` : ''}
            valueStyle={{ fontSize: '20px' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Range"
            value={`${minLeads} - ${maxLeads.toLocaleString()}`}
            valueStyle={{ fontSize: '16px' }}
          />
        </Col>
      </Row>
      
      <Spin spinning={loading}>
        <div className="relative">
          {/* US Map */}
          <div className="flex justify-center" onMouseMove={mapHandler}>
            <USAMap
              customize={statesCustomConfig()}
              width="100%"
              height="500px"
              defaultFill="#e5e7eb"
            />
          </div>
          
          {/* Hovered State Details */}
          {hoveredState && (
            <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 w-64">
              <h4 className="font-bold text-lg mb-2">{hoveredState.state_code}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Leads:</span>
                  <span className="font-semibold">{hoveredState.total_leads.toLocaleString()}</span>
                </div>
                {selectedVertical === 'all' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ACA:</span>
                      <span>{hoveredState.aca_leads.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Medicare:</span>
                      <span>{hoveredState.medicare_leads.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Final Expense:</span>
                      <span>{hoveredState.fe_leads.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Unique Phones:</span>
                  <span>{hoveredState.unique_phones.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Bid:</span>
                  <span>${hoveredState.avg_bid.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Color Legend */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="text-sm font-medium">Lead Volume:</span>
            <div className="flex items-center gap-1">
              <div className="w-12 h-6 rounded" style={{ backgroundColor: '#dbeafe' }}></div>
              <span className="text-xs">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-12 h-6 rounded" style={{ backgroundColor: '#93c5fd' }}></div>
              <span className="text-xs">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-12 h-6 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
              <span className="text-xs">High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-12 h-6 rounded" style={{ backgroundColor: '#1d4ed8' }}></div>
              <span className="text-xs">Very High</span>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <div className="w-12 h-6 rounded bg-gray-300"></div>
              <span className="text-xs">No Data</span>
            </div>
          </div>
        </div>
      </Spin>
    </Card>
  );
}

