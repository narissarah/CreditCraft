import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Select,
  Stack,
  ButtonGroup,
  Button,
  Text,
  SkeletonBodyText,
  DatePicker,
  Tabs,
  EmptyState
} from '@shopify/polaris';
import {
  CalendarTimeMinor,
  ResetMinor,
  AnalyticsMajor,
  ExportMinor
} from '@shopify/polaris-icons';
import { useAPI } from '../../hooks/useAPI';

// Import Chart.js if available
let Chart: any;
let Line: any;
let Bar: any;
let Doughnut: any;

try {
  // Try to import Chart.js components
  const ChartJS = require('chart.js/auto');
  const ChartComponents = require('react-chartjs-2');
  
  Chart = ChartJS;
  Line = ChartComponents.Line;
  Bar = ChartComponents.Bar;
  Doughnut = ChartComponents.Doughnut;
  
  // Register required Chart.js components
  if (Chart?.register) {
    Chart.register(
      Chart.CategoryScale,
      Chart.LinearScale,
      Chart.PointElement,
      Chart.LineElement,
      Chart.BarElement,
      Chart.ArcElement,
      Chart.Tooltip,
      Chart.Legend
    );
  }
} catch (error) {
  console.warn('Chart.js not available:', error);
}

interface TransactionReportVisualizerProps {
  customerId?: string;
  creditId?: string;
  onExport?: () => void;
}

const TransactionReportVisualizer: React.FC<TransactionReportVisualizerProps> = ({ 
  customerId,
  creditId,
  onExport 
}) => {
  const api = useAPI();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [timeFrame, setTimeFrame] = useState('daily');
  const [chartType, setChartType] = useState('bar');
  const [selectedTab, setSelectedTab] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [month, setMonth] = useState(dateRange.start.getMonth());
  const [year, setYear] = useState(dateRange.start.getFullYear());
  
  // Tabs
  const tabs = [
    {
      id: 'transaction-volume',
      content: 'Volume',
      accessibilityLabel: 'Transaction volume',
      panelID: 'transaction-volume-panel',
    },
    {
      id: 'transaction-type',
      content: 'By Type',
      accessibilityLabel: 'Transactions by type',
      panelID: 'transaction-type-panel',
    },
    {
      id: 'transaction-value',
      content: 'Value',
      accessibilityLabel: 'Transaction value',
      panelID: 'transaction-value-panel',
    },
  ];
  
  // Time frame options
  const timeFrameOptions = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];
  
  // Chart type options
  const chartTypeOptions = [
    { label: 'Bar Chart', value: 'bar' },
    { label: 'Line Chart', value: 'line' },
    { label: 'Doughnut Chart', value: 'doughnut' },
  ];
  
  // Fetch report data
  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Prepare query params
      const params: Record<string, string> = {
        timeFrame,
        startDate: dateRange.start.toISOString().split('T')[0],
        endDate: dateRange.end.toISOString().split('T')[0],
      };
      
      // Add optional filters
      if (customerId) params.customerId = customerId;
      if (creditId) params.creditId = creditId;
      
      // Convert params to query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      
      // Fetch data
      const response = await api.get(`/api/transactions/stats?${queryString}`);
      
      if (response.data) {
        setReportData(response.data);
      } else {
        setError('Failed to load report data');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('There was an error loading the report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load data when dependencies change
  useEffect(() => {
    fetchReportData();
  }, [timeFrame, dateRange, customerId, creditId]);
  
  // Handle date range change
  const handleDateRangeChange = (range: { start: Date, end: Date }) => {
    setDateRange(range);
  };
  
  // Handle month change in date picker
  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  };
  
  // Handle time frame change
  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value);
  };
  
  // Handle chart type change
  const handleChartTypeChange = (value: string) => {
    setChartType(value);
  };
  
  // Handle tab change
  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  };
  
  // Reset filters
  const handleResetFilters = () => {
    setTimeFrame('daily');
    setChartType('bar');
    setDateRange({
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
    });
    setMonth(new Date().getMonth());
    setYear(new Date().getFullYear());
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  // Prepare chart data based on tab and report data
  const chartData = useMemo(() => {
    if (!reportData) return null;
    
    const timeline = reportData.timeline || [];
    if (timeline.length === 0) return null;
    
    const labels = timeline.map((item: any) => item.date);
    
    // Different datasets based on selected tab
    switch (selectedTab) {
      case 0: // Transaction Volume (count)
        return {
          labels,
          datasets: [
            {
              label: 'Transaction Count',
              data: timeline.map((item: any) => item.count || 0),
              backgroundColor: 'rgba(52, 152, 219, 0.5)',
              borderColor: 'rgba(52, 152, 219, 1)',
              borderWidth: 1,
            }
          ]
        };
      
      case 1: // By Transaction Type
        return {
          labels,
          datasets: [
            {
              label: 'Issued',
              data: timeline.map((item: any) => item.issuedCount || 0),
              backgroundColor: 'rgba(46, 204, 113, 0.5)',
              borderColor: 'rgba(46, 204, 113, 1)',
              borderWidth: 1,
            },
            {
              label: 'Redeemed',
              data: timeline.map((item: any) => item.redeemedCount || 0),
              backgroundColor: 'rgba(231, 76, 60, 0.5)',
              borderColor: 'rgba(231, 76, 60, 1)',
              borderWidth: 1,
            },
            {
              label: 'Adjusted',
              data: timeline.map((item: any) => item.adjustedCount || 0),
              backgroundColor: 'rgba(241, 196, 15, 0.5)',
              borderColor: 'rgba(241, 196, 15, 1)',
              borderWidth: 1,
            }
          ]
        };
      
      case 2: // Transaction Value
        return {
          labels,
          datasets: [
            {
              label: 'Total Value',
              data: timeline.map((item: any) => item.totalAmount || 0),
              backgroundColor: 'rgba(155, 89, 182, 0.5)',
              borderColor: 'rgba(155, 89, 182, 1)',
              borderWidth: 1,
            }
          ]
        };
      
      default:
        return null;
    }
  }, [reportData, selectedTab]);
  
  // Chart options
  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (selectedTab === 2) {
                label += formatCurrency(context.raw);
              } else {
                label += context.raw;
              }
              return label;
            }
          }
        }
      },
      scales: selectedTab === 2 ? {
        y: {
          ticks: {
            callback: (value: number) => formatCurrency(value)
          }
        }
      } : undefined
    };
  }, [selectedTab]);
  
  // Summary metrics
  const renderSummaryMetrics = () => {
    if (!reportData || !reportData.totals) return null;
    
    const { totals } = reportData;
    
    return (
      <Stack distribution="fillEvenly">
        <Stack vertical spacing="extraTight">
          <Text variant="headingLg" as="h3">
            {totals.count || 0}
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            Total Transactions
          </Text>
        </Stack>
        
        <Stack vertical spacing="extraTight">
          <Text variant="headingLg" as="h3">
            {totals.issuedAmount ? formatCurrency(totals.issuedAmount) : '$0.00'}
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            Issued
          </Text>
        </Stack>
        
        <Stack vertical spacing="extraTight">
          <Text variant="headingLg" as="h3">
            {totals.redeemedAmount ? formatCurrency(totals.redeemedAmount) : '$0.00'}
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            Redeemed
          </Text>
        </Stack>
      </Stack>
    );
  };
  
  // Render appropriate chart
  const renderChart = () => {
    if (!chartData || !Chart) {
      return (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack vertical spacing="tight" alignment="center">
            <Text>Chart visualization not available</Text>
            <Text variant="bodyMd" as="p" color="subdued">
              Chart.js components could not be loaded
            </Text>
          </Stack>
        </div>
      );
    }
    
    const containerStyle = { height: '300px' };
    
    switch (chartType) {
      case 'line':
        return Line ? (
          <div style={containerStyle}>
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : null;
      
      case 'doughnut':
        // For doughnut charts, we need to transform data
        const doughnutData = {
          labels: ['Issued', 'Redeemed', 'Adjusted'],
          datasets: [{
            data: [
              reportData.totals?.issuedAmount || 0,
              reportData.totals?.redeemedAmount || 0,
              reportData.totals?.adjustedAmount || 0
            ],
            backgroundColor: [
              'rgba(46, 204, 113, 0.5)',
              'rgba(231, 76, 60, 0.5)',
              'rgba(241, 196, 15, 0.5)'
            ],
            borderColor: [
              'rgba(46, 204, 113, 1)',
              'rgba(231, 76, 60, 1)',
              'rgba(241, 196, 15, 1)'
            ],
            borderWidth: 1
          }]
        };
        
        return Doughnut ? (
          <div style={containerStyle}>
            <Doughnut data={doughnutData} options={chartOptions} />
          </div>
        ) : null;
      
      case 'bar':
      default:
        return Bar ? (
          <div style={containerStyle}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : null;
    }
  };
  
  // Render filters
  const renderFilters = () => {
    return (
      <Stack distribution="fillEvenly">
        <Stack.Item fill>
          <Select
            label="Time frame"
            options={timeFrameOptions}
            value={timeFrame}
            onChange={handleTimeFrameChange}
          />
        </Stack.Item>
        <Stack.Item fill>
          <Select
            label="Chart type"
            options={chartTypeOptions}
            value={chartType}
            onChange={handleChartTypeChange}
          />
        </Stack.Item>
      </Stack>
    );
  };
  
  // Render date picker
  const renderDatePicker = () => {
    return (
      <div style={{ marginTop: '1rem' }}>
        <Text variant="bodyMd" as="p">Date range</Text>
        {DatePicker && (
          <DatePicker
            month={month}
            year={year}
            onChange={handleDateRangeChange}
            onMonthChange={handleMonthChange}
            selected={dateRange}
            allowRange
          />
        )}
      </div>
    );
  };
  
  // Render empty state
  const renderEmptyState = () => {
    return (
      <EmptyState
        heading="No transaction data available"
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        action={{ content: 'Reset Filters', onAction: handleResetFilters }}
      >
        <p>
          There are no transactions matching your selected filters.
          Try changing the date range or filters to see data.
        </p>
      </EmptyState>
    );
  };
  
  // Main render
  return (
    <Card>
      <Card.Section title="Transaction Reports">
        {/* Filters */}
        <Stack vertical spacing="tight">
          {renderFilters()}
          {renderDatePicker()}
          
          <div style={{ marginTop: '1rem' }}>
            <ButtonGroup>
              <Button 
                icon={ResetMinor} 
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
              
              {onExport && (
                <Button 
                  icon={ExportMinor} 
                  onClick={onExport}
                  disabled={loading || !reportData}
                >
                  Export Data
                </Button>
              )}
            </ButtonGroup>
          </div>
        </Stack>
      </Card.Section>
      
      {/* Summary Metrics */}
      {!loading && !error && reportData && (
        <Card.Section>
          {renderSummaryMetrics()}
        </Card.Section>
      )}
      
      {/* Chart */}
      <Card.Section>
        <Tabs
          tabs={tabs}
          selected={selectedTab}
          onSelect={handleTabChange}
          fitted
        />
        
        <div style={{ marginTop: '1rem' }}>
          {loading ? (
            <SkeletonBodyText lines={8} />
          ) : error ? (
            <Stack vertical alignment="center">
              <Text color="critical">{error}</Text>
              <Button onClick={fetchReportData}>Retry</Button>
            </Stack>
          ) : !chartData ? (
            renderEmptyState()
          ) : (
            renderChart()
          )}
        </div>
      </Card.Section>
    </Card>
  );
};

export default TransactionReportVisualizer; 