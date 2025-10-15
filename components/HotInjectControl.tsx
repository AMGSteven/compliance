'use client';

import { useState, useEffect } from 'react';
import { Card, Switch, Spin, message, Alert } from 'antd';
import { FireOutlined, PauseCircleOutlined } from '@ant-design/icons';

interface VerticalSetting {
  vertical: string;
  hot_inject_enabled: boolean;
}

export default function HotInjectControl() {
  const [settings, setSettings] = useState<VerticalSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Fetch current settings
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/pitch-bpo-hot-inject');
      const result = await response.json();
      
      if (result.success) {
        setSettings(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching hot inject settings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSettings();
  }, []);
  
  // Toggle hot inject for a vertical
  const handleToggle = async (vertical: string, newValue: boolean) => {
    setUpdating(vertical);
    try {
      const response = await fetch('/api/pitch-bpo-hot-inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical, enabled: newValue })
      });
      
      const result = await response.json();
      
      if (result.success) {
        message.success(`${vertical}: Hot inject ${newValue ? 'enabled' : 'disabled'}`);
        // Update local state
        setSettings(prev => prev.map(s => 
          s.vertical === vertical ? { ...s, hot_inject_enabled: newValue } : s
        ));
      } else {
        message.error(`Failed to update ${vertical}: ${result.error}`);
      }
    } catch (error) {
      console.error('Error toggling hot inject:', error);
      message.error('Failed to update setting');
    } finally {
      setUpdating(null);
    }
  };
  
  return (
    <Card title={<span className="flex items-center gap-2"><FireOutlined />Hot Inject Pitch BPO</span>} className="w-full">
      <Alert
        message="ImportOnly Parameter Control"
        description={
          <div className="text-xs">
            <div><strong>ON (🔥)</strong>: ImportOnly=0 - Leads inserted into dial queue immediately</div>
            <div><strong>OFF (❄️)</strong>: ImportOnly=1 - Leads imported only, not queued for dialing</div>
          </div>
        }
        type="info"
        showIcon
        className="mb-4"
      />
      
      <Spin spinning={loading}>
        <div className="space-y-3">
          {settings.map((setting) => (
            <div 
              key={setting.vertical} 
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                {setting.hot_inject_enabled ? (
                  <FireOutlined className="text-orange-500 text-lg" />
                ) : (
                  <PauseCircleOutlined className="text-blue-400 text-lg" />
                )}
                <div>
                  <div className="font-semibold">{setting.vertical}</div>
                  <div className="text-xs text-gray-500">
                    {setting.hot_inject_enabled ? 'Hot Inject (ImportOnly=0)' : 'Import Only (ImportOnly=1)'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {setting.hot_inject_enabled ? 'Hot' : 'Cold'}
                </span>
                <Switch
                  checked={setting.hot_inject_enabled}
                  onChange={(checked) => handleToggle(setting.vertical, checked)}
                  loading={updating === setting.vertical}
                  checkedChildren="🔥"
                  unCheckedChildren="⏸"
                />
              </div>
            </div>
          ))}
        </div>
      </Spin>
    </Card>
  );
}

