import React, { useState, useEffect } from 'react';
import { Table, Card, Badge, Spin, Alert, Typography, Space, Button } from 'antd';
import { ReloadOutlined, WarningOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

interface RateLimitStat {
  totalViolations: number;
  recentViolations: number;
  topOffenders: Array<{ key: string; count: number }>;
  last24Hours: string;
  now: string;
}

interface RateLimitSettings {
  standard: number;
  auth: number;
  pos: number;
  admin: number;
  window: number;
}

interface StatsResponse {
  status: string;
  data: RateLimitStat;
  rateLimitSettings: RateLimitSettings;
}

const RateLimitStats: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RateLimitStat | null>(null);
  const [settings, setSettings] = useState<RateLimitSettings | null>(null);
  
  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get<StatsResponse>('/api/admin/rate-limit-stats');
      setStats(response.data.data);
      setSettings(response.data.rateLimitSettings);
    } catch (err) {
      setError('Failed to load rate limit statistics. Please try again later.');
      console.error('Error fetching rate limit stats:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchStats();
    
    // Refresh every 5 minutes
    const intervalId = setInterval(fetchStats, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const columns = [
    {
      title: 'Client',
      dataIndex: 'key',
      key: 'key',
      render: (text: string) => {
        // Parse the key to determine if it's IP:Shop or just IP
        const parts = text.split(':');
        if (parts.length > 1) {
          return (
            <span>
              <Text code>{parts[0]}</Text>
              <br />
              <Badge status="processing" text={`Shop: ${parts[1]}`} />
            </span>
          );
        }
        return <Text code>{text}</Text>;
      },
    },
    {
      title: 'Violations',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
      defaultSortOrder: 'descend' as 'descend',
      render: (count: number) => {
        let color = 'green';
        if (count > 50) color = 'red';
        else if (count > 20) color = 'orange';
        else if (count > 10) color = 'gold';
        
        return <Badge count={count} style={{ backgroundColor: color }} />;
      },
    },
  ];
  
  if (loading) {
    return (
      <Card>
        <Spin tip="Loading rate limit statistics...">
          <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Text type="secondary">Loading data...</Text>
          </div>
        </Spin>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={fetchStats}>
              Retry
            </Button>
          }
        />
      </Card>
    );
  }
  
  if (!stats || !settings) {
    return (
      <Card>
        <Alert
          message="No Data"
          description="No rate limit statistics available."
          type="info"
          showIcon
        />
      </Card>
    );
  }
  
  return (
    <Card
      title={
        <Space>
          <Title level={4}>Rate Limit Statistics</Title>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={fetchStats}
            title="Refresh data"
          />
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* Summary */}
        <Card size="small">
          <Space size="large">
            <Statistic
              title="Total Violations"
              value={stats.totalViolations}
              valueStyle={{ color: stats.totalViolations > 50 ? '#cf1322' : '#3f8600' }}
            />
            <Statistic
              title="Recent Violations (24h)"
              value={stats.recentViolations}
              valueStyle={{ color: stats.recentViolations > 20 ? '#cf1322' : '#3f8600' }}
              prefix={<ClockCircleOutlined />}
            />
            <Statistic
              title="Top Offender"
              value={stats.topOffenders.length > 0 ? stats.topOffenders[0].count : 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Space>
        </Card>
        
        {/* Current Settings */}
        <Card size="small" title="Rate Limit Settings">
          <Space wrap>
            <Badge color="blue" text={`Standard: ${settings.standard} req/${settings.window/1000}s`} />
            <Badge color="gold" text={`Auth: ${settings.auth} req/${settings.window/1000}s`} />
            <Badge color="orange" text={`POS: ${settings.pos} req/${settings.window/1000}s`} />
            <Badge color="purple" text={`Admin: ${settings.admin} req/${settings.window/1000}s`} />
          </Space>
        </Card>
        
        {/* Top Offenders Table */}
        <Card 
          size="small" 
          title="Top Offenders" 
          extra={<Text type="secondary">Last updated: {formatDate(stats.now)}</Text>}
        >
          <Table
            columns={columns}
            dataSource={stats.topOffenders}
            rowKey="key"
            pagination={false}
            size="small"
          />
        </Card>
      </Space>
    </Card>
  );
};

// Missing Statistic component from antd, let's define a simple version
const Statistic: React.FC<{
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
}> = ({ title, value, prefix, valueStyle }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <Text type="secondary">{title}</Text>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {prefix && <span>{prefix}</span>}
      <Text strong style={{ fontSize: '24px', ...valueStyle }}>{value}</Text>
    </div>
  </div>
);

export default RateLimitStats; 