import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Layout,
  Tabs,
  Button,
  ButtonGroup,
  Page,
  Text,
  DatePicker,
  Select,
  EmptyState,
  Spinner,
  Toast,
  Banner,
  Stack,
  HorizontalStack,
  VerticalStack,
  Box,
  Popover,
  ActionList,
  Icon,
  Modal,
  Form,
  FormLayout,
  TextField,
  Checkbox,
  DropZone,
  PageActions
} from '@shopify/polaris';
import {
  AnalyticsMajor,
  CalendarMinor,
  ExportMinor,
  EmailMajor,
  FilterMajor,
  ResetMinor,
  SaveMinor,
  DeleteMinor,
  ChartColumnMajor,
  ChartBarMajor,
  ChartDonutMajor,
  ChartLineMajor,
  InfoMinor,
  PlusMinor
} from '@shopify/polaris-icons';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { useAPI } from '../../hooks/useAPI';
import { useToast } from '../../hooks/useToast';
import { DashboardMetrics } from '../../components/admin/DashboardMetrics';

// Import Chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Main component
const AnalyticsDashboard: React.FC = () => {
  const api = useAPI();
  const { showToast } = useToast();
  
  // State for tabs and report selection
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for date range
  const [{ month, year }, setDate] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDates, setSelectedDates] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  
  // State for report builder
  const [isReportBuilderOpen, setIsReportBuilderOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportConfig, setReportConfig] = useState<any>({
    metrics: [],
    dimensions: [],
    filters: {},
    chartType: 'bar'
  });
  const [savedReports, setSavedReports] = useState<any[]>([]);
  
  // State for report scheduling
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    reportId: '',
    frequency: 'weekly',
    recipients: '',
    format: 'pdf'
  });
  
  // State for export popover
  const [isExportPopoverActive, setIsExportPopoverActive] = useState(false);
  
  // State for report data
  const [reportData, setReportData] = useState<any>(null);
  
  // Load saved reports
  useEffect(() => {
    async function fetchSavedReports() {
      try {
        const response = await api.get('/api/reports/saved');
        if (response.data && response.data.reports) {
          setSavedReports(response.data.reports);
        }
      } catch (error) {
        console.error('Error fetching saved reports:', error);
      }
    }
    
    fetchSavedReports();
  }, [api]);
  
  // Define tabs
  const tabs = [
    {
      id: 'dashboard',
      content: 'Dashboard',
      accessibilityLabel: 'Dashboard tab',
      panelID: 'dashboard-panel',
    },
    {
      id: 'credits',
      content: 'Credit Analytics',
      accessibilityLabel: 'Credit analytics tab',
      panelID: 'credits-panel',
    },
    {
      id: 'customers',
      content: 'Customer Segmentation',
      accessibilityLabel: 'Customer segmentation tab',
      panelID: 'customers-panel',
    },
    {
      id: 'staff',
      content: 'Staff Performance',
      accessibilityLabel: 'Staff performance tab',
      panelID: 'staff-panel',
    },
    {
      id: 'custom',
      content: 'Custom Reports',
      accessibilityLabel: 'Custom reports tab',
      panelID: 'custom-panel',
    },
  ];
  
  // Handle tab change
  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setSelectedReport(null);
    setReportData(null);
  };
  
  // Handle date change
  const handleDateChange = (range: { start: Date; end: Date }) => {
    setSelectedDates(range);
  };
  
  // Handle month change
  const handleMonthChange = (month: number, year: number) => {
    setDate({ month, year });
  };
  
  // Toggle report builder
  const toggleReportBuilder = () => {
    setIsReportBuilderOpen(!isReportBuilderOpen);
  };
  
  // Toggle export popover
  const toggleExportPopover = () => {
    setIsExportPopoverActive(!isExportPopoverActive);
  };
  
  // Toggle schedule modal
  const toggleScheduleModal = () => {
    setIsScheduleModalOpen(!isScheduleModalOpen);
  };
  
  // Handle export
  const handleExport = async (format: string) => {
    if (!selectedReport && selectedTab !== 0) {
      showToast('Please select a report to export', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      let endpoint = '/api/reports/export';
      const params: any = {
        format,
        startDate: selectedDates.start.toISOString(),
        endDate: selectedDates.end.toISOString()
      };
      
      if (selectedReport) {
        params.reportId = selectedReport;
      } else {
        params.tabId = tabs[selectedTab].id;
      }
      
      const response = await api.get(endpoint, { 
        params,
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showToast('Report exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting report:', error);
      showToast('Failed to export report', 'error');
    } finally {
      setIsLoading(false);
      setIsExportPopoverActive(false);
    }
  };
  
  // Handle schedule submit
  const handleScheduleSubmit = async () => {
    if (!scheduleConfig.recipients) {
      showToast('Please enter at least one recipient email', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.post('/api/reports/schedule', scheduleConfig);
      
      if (response.data && response.data.success) {
        showToast('Report scheduled successfully', 'success');
        setIsScheduleModalOpen(false);
      } else {
        throw new Error(response.data?.error || 'Failed to schedule report');
      }
    } catch (error) {
      console.error('Error scheduling report:', error);
      showToast('Failed to schedule report', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle save custom report
  const handleSaveReport = async () => {
    if (!reportName) {
      showToast('Please enter a report name', 'error');
      return;
    }
    
    if (reportConfig.metrics.length === 0) {
      showToast('Please select at least one metric', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.post('/api/reports/save', {
        name: reportName,
        config: reportConfig
      });
      
      if (response.data && response.data.report) {
        setSavedReports([...savedReports, response.data.report]);
        showToast('Report saved successfully', 'success');
        setIsReportBuilderOpen(false);
        
        // Reset form
        setReportName('');
        setReportConfig({
          metrics: [],
          dimensions: [],
          filters: {},
          chartType: 'bar'
        });
      } else {
        throw new Error(response.data?.error || 'Failed to save report');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      showToast('Failed to save report', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load report data
  const loadReportData = async (reportId?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let endpoint = '/api/reports/data';
      const params: any = {
        startDate: selectedDates.start.toISOString(),
        endDate: selectedDates.end.toISOString()
      };
      
      if (reportId) {
        params.reportId = reportId;
      } else {
        params.tabId = tabs[selectedTab].id;
      }
      
      const response = await api.get(endpoint, { params });
      
      if (response.data) {
        setReportData(response.data);
      } else {
        throw new Error('No data returned from API');
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      setError('Failed to load report data. Please try again.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Effect to load report data when tab or dates change
  useEffect(() => {
    if (selectedTab !== 4) { // Not custom reports tab
      loadReportData();
    }
  }, [selectedTab, selectedDates]);
  
  // Handle selecting a saved report
  const handleSelectReport = (reportId: string) => {
    setSelectedReport(reportId);
    loadReportData(reportId);
  };
  
  // Render dashboard tab
  const renderDashboard = () => {
    return (
      <Layout>
        <Layout.Section>
          <DashboardMetrics />
        </Layout.Section>
      </Layout>
    );
  };
  
  // Create chart data
  const createChartData = (data: any, chartType: string) => {
    if (!data || !data.labels || !data.datasets) {
      return null;
    }
    
    return {
      labels: data.labels,
      datasets: data.datasets.map((dataset: any, index: number) => {
        const colors = [
          { bg: 'rgba(52, 152, 219, 0.5)', border: 'rgba(52, 152, 219, 1)' },
          { bg: 'rgba(46, 204, 113, 0.5)', border: 'rgba(46, 204, 113, 1)' },
          { bg: 'rgba(243, 156, 18, 0.5)', border: 'rgba(243, 156, 18, 1)' },
          { bg: 'rgba(155, 89, 182, 0.5)', border: 'rgba(155, 89, 182, 1)' },
          { bg: 'rgba(231, 76, 60, 0.5)', border: 'rgba(231, 76, 60, 1)' }
        ];
        
        const colorIndex = index % colors.length;
        
        return {
          label: dataset.label,
          data: dataset.data,
          backgroundColor: chartType === 'line' ? colors[colorIndex].border : colors[colorIndex].bg,
          borderColor: colors[colorIndex].border,
          borderWidth: 1,
          fill: chartType === 'line' ? false : undefined,
          tension: chartType === 'line' ? 0.1 : undefined
        };
      })
    };
  };
  
  // Render chart
  const renderChart = (chartType: string, chartData: any) => {
    const formattedData = createChartData(chartData, chartType);
    
    if (!formattedData) {
      return (
        <EmptyState
          heading="No data available"
          image=""
        >
          <p>There is no data available for the selected criteria.</p>
        </EmptyState>
      );
    }
    
    const chartOptions = {
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
              if (context.parsed.y !== null) {
                label += context.parsed.y;
              }
              return label;
            }
          }
        }
      }
    };
    
    const containerStyle = { height: '400px' };
    
    switch (chartType) {
      case 'line':
        return (
          <div style={containerStyle}>
            <Line data={formattedData} options={chartOptions} />
          </div>
        );
      case 'bar':
        return (
          <div style={containerStyle}>
            <Bar data={formattedData} options={chartOptions} />
          </div>
        );
      case 'doughnut':
        return (
          <div style={containerStyle}>
            <Doughnut data={formattedData} options={chartOptions} />
          </div>
        );
      case 'pie':
        return (
          <div style={containerStyle}>
            <Pie data={formattedData} options={chartOptions} />
          </div>
        );
      default:
        return (
          <div style={containerStyle}>
            <Bar data={formattedData} options={chartOptions} />
          </div>
        );
    }
  };
  
  // Render report content
  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>Loading report data...</Text>
          </div>
        </div>
      );
    }
    
    if (error) {
      return (
        <Banner status="critical">
          <p>{error}</p>
        </Banner>
      );
    }
    
    if (!reportData) {
      return (
        <EmptyState
          heading="No report selected"
          image=""
        >
          <p>Please select a report to view or adjust the date range.</p>
        </EmptyState>
      );
    }
    
    // Render summary metrics
    const renderSummaryMetrics = () => {
      if (!reportData.summary) return null;
      
      return (
        <HorizontalStack gap="4" wrap={true}>
          {Object.entries(reportData.summary).map(([key, value]: [string, any]) => (
            <Box key={key} background="bg-surface-secondary" padding="4" borderRadius="2" minWidth="200px">
              <VerticalStack gap="2">
                <Text variant="headingSm" fontWeight="semibold">
                  {key.split(/(?=[A-Z])/).join(' ')}
                </Text>
                <Text variant="heading2xl">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </Text>
              </VerticalStack>
            </Box>
          ))}
        </HorizontalStack>
      );
    };
    
    return (
      <VerticalStack gap="4">
        {reportData.summary && (
          <Card sectioned>
            <Text variant="headingMd" as="h3">Summary Metrics</Text>
            <Box paddingBlockStart="4">
              {renderSummaryMetrics()}
            </Box>
          </Card>
        )}
        
        {reportData.charts && Object.entries(reportData.charts).map(([chartName, chartData]: [string, any]) => (
          <Card key={chartName} sectioned>
            <Text variant="headingMd" as="h3">{chartName}</Text>
            <Box paddingBlockStart="4">
              {renderChart(chartData.type || 'bar', chartData)}
            </Box>
          </Card>
        ))}
        
        {reportData.tables && reportData.tables.map((table: any, index: number) => (
          <Card key={`table-${index}`} sectioned>
            <Text variant="headingMd" as="h3">{table.title || 'Data Table'}</Text>
            <Box paddingBlockStart="4">
              {/* Table component would go here */}
              <pre>{JSON.stringify(table.data, null, 2)}</pre>
            </Box>
          </Card>
        ))}
      </VerticalStack>
    );
  };
  
  // Render credits tab
  const renderCreditsTab = () => {
    return (
      <Layout>
        <Layout.Section>
          {renderReportContent()}
        </Layout.Section>
      </Layout>
    );
  };
  
  // Render customers tab
  const renderCustomersTab = () => {
    return (
      <Layout>
        <Layout.Section>
          {renderReportContent()}
        </Layout.Section>
      </Layout>
    );
  };
  
  // Render staff tab
  const renderStaffTab = () => {
    return (
      <Layout>
        <Layout.Section>
          {renderReportContent()}
        </Layout.Section>
      </Layout>
    );
  };
  
  // Render custom reports tab
  const renderCustomReportsTab = () => {
    return (
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Stack distribution="equalSpacing" alignment="center">
              <Stack.Item>
                <Text variant="headingMd">Saved Reports</Text>
              </Stack.Item>
              <Stack.Item>
                <Button primary onClick={toggleReportBuilder}>
                  Create New Report
                </Button>
              </Stack.Item>
            </Stack>
            
            {savedReports.length === 0 ? (
              <Box paddingBlockStart="4">
                <EmptyState
                  heading="No saved reports"
                  image=""
                >
                  <p>Create your first custom report to visualize the data that matters to your business.</p>
                </EmptyState>
              </Box>
            ) : (
              <Box paddingBlockStart="4">
                {savedReports.map(report => (
                  <Box key={report.id} paddingBlockEnd="3">
                    <Card>
                      <Card.Section>
                        <Stack alignment="center" distribution="equalSpacing">
                          <Stack.Item fill>
                            <Text variant="bodyMd" fontWeight="bold">{report.name}</Text>
                            <Text variant="bodySm" color="subdued">
                              Created: {new Date(report.createdAt).toLocaleDateString()}
                            </Text>
                          </Stack.Item>
                          <Stack.Item>
                            <ButtonGroup>
                              <Button 
                                onClick={() => handleSelectReport(report.id)}
                                primary={selectedReport === report.id}
                              >
                                View
                              </Button>
                              <Button 
                                icon={DeleteMinor}
                                plain
                                destructive
                              />
                            </ButtonGroup>
                          </Stack.Item>
                        </Stack>
                      </Card.Section>
                    </Card>
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        </Layout.Section>
        
        {selectedReport && (
          <Layout.Section>
            {renderReportContent()}
          </Layout.Section>
        )}
      </Layout>
    );
  };
  
  // Render report builder modal
  const renderReportBuilderModal = () => {
    const metricOptions = [
      { label: 'Credit Count', value: 'creditCount' },
      { label: 'Credit Amount', value: 'creditAmount' },
      { label: 'Transaction Count', value: 'transactionCount' },
      { label: 'Transaction Value', value: 'transactionValue' },
      { label: 'Customer Count', value: 'customerCount' },
      { label: 'Average Credit Value', value: 'avgCreditValue' },
      { label: 'Redemption Rate', value: 'redemptionRate' }
    ];
    
    const dimensionOptions = [
      { label: 'Date', value: 'date' },
      { label: 'Week', value: 'week' },
      { label: 'Month', value: 'month' },
      { label: 'Quarter', value: 'quarter' },
      { label: 'Year', value: 'year' },
      { label: 'Credit Type', value: 'creditType' },
      { label: 'Transaction Type', value: 'transactionType' },
      { label: 'Customer Segment', value: 'customerSegment' },
      { label: 'Staff Member', value: 'staffMember' },
      { label: 'Location', value: 'location' }
    ];
    
    const chartOptions = [
      { label: 'Bar Chart', value: 'bar' },
      { label: 'Line Chart', value: 'line' },
      { label: 'Pie Chart', value: 'pie' },
      { label: 'Doughnut Chart', value: 'doughnut' },
      { label: 'Table', value: 'table' }
    ];
    
    return (
      <Modal
        open={isReportBuilderOpen}
        onClose={toggleReportBuilder}
        title="Custom Report Builder"
        primaryAction={{
          content: 'Save Report',
          onAction: handleSaveReport,
          loading: isLoading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: toggleReportBuilder
          }
        ]}
        large
      >
        <Modal.Section>
          <Form onSubmit={handleSaveReport}>
            <FormLayout>
              <TextField
                label="Report Name"
                value={reportName}
                onChange={setReportName}
                autoComplete="off"
                required
              />
              
              <FormLayout.Group>
                <Select
                  label="Chart Type"
                  options={chartOptions}
                  value={reportConfig.chartType}
                  onChange={(value) => setReportConfig({...reportConfig, chartType: value})}
                />
              </FormLayout.Group>
              
              <FormLayout.Group>
                <Stack vertical>
                  <Text variant="headingMd">Metrics (Select at least one)</Text>
                  <HorizontalStack gap="3" wrap={true}>
                    {metricOptions.map(option => (
                      <Checkbox
                        key={option.value}
                        label={option.label}
                        checked={reportConfig.metrics.includes(option.value)}
                        onChange={(checked) => {
                          const metrics = checked 
                            ? [...reportConfig.metrics, option.value]
                            : reportConfig.metrics.filter((m: string) => m !== option.value);
                          setReportConfig({...reportConfig, metrics});
                        }}
                      />
                    ))}
                  </HorizontalStack>
                </Stack>
              </FormLayout.Group>
              
              <FormLayout.Group>
                <Stack vertical>
                  <Text variant="headingMd">Dimensions (How to group data)</Text>
                  <HorizontalStack gap="3" wrap={true}>
                    {dimensionOptions.map(option => (
                      <Checkbox
                        key={option.value}
                        label={option.label}
                        checked={reportConfig.dimensions.includes(option.value)}
                        onChange={(checked) => {
                          const dimensions = checked 
                            ? [...reportConfig.dimensions, option.value]
                            : reportConfig.dimensions.filter((d: string) => d !== option.value);
                          setReportConfig({...reportConfig, dimensions});
                        }}
                      />
                    ))}
                  </HorizontalStack>
                </Stack>
              </FormLayout.Group>
              
              {/* Additional filters would go here */}
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    );
  };
  
  // Render schedule modal
  const renderScheduleModal = () => {
    return (
      <Modal
        open={isScheduleModalOpen}
        onClose={toggleScheduleModal}
        title="Schedule Report"
        primaryAction={{
          content: 'Schedule',
          onAction: handleScheduleSubmit,
          loading: isLoading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: toggleScheduleModal
          }
        ]}
      >
        <Modal.Section>
          <Form onSubmit={handleScheduleSubmit}>
            <FormLayout>
              <Select
                label="Report"
                options={[
                  { label: 'Current Report', value: '' },
                  ...savedReports.map(report => ({
                    label: report.name,
                    value: report.id
                  }))
                ]}
                value={scheduleConfig.reportId}
                onChange={(value) => setScheduleConfig({...scheduleConfig, reportId: value})}
              />
              
              <Select
                label="Frequency"
                options={[
                  { label: 'Daily', value: 'daily' },
                  { label: 'Weekly', value: 'weekly' },
                  { label: 'Monthly', value: 'monthly' }
                ]}
                value={scheduleConfig.frequency}
                onChange={(value) => setScheduleConfig({...scheduleConfig, frequency: value})}
              />
              
              <TextField
                label="Recipients (comma separated)"
                value={scheduleConfig.recipients}
                onChange={(value) => setScheduleConfig({...scheduleConfig, recipients: value})}
                autoComplete="email"
                type="text"
                helpText="Enter email addresses separated by commas"
              />
              
              <Select
                label="Format"
                options={[
                  { label: 'PDF', value: 'pdf' },
                  { label: 'CSV', value: 'csv' },
                  { label: 'Excel', value: 'xlsx' }
                ]}
                value={scheduleConfig.format}
                onChange={(value) => setScheduleConfig({...scheduleConfig, format: value})}
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    );
  };
  
  return (
    <AdminLayout title="Analytics & Reporting">
      <Page
        fullWidth
        title="Analytics & Reporting"
        subtitle="Gain insights into your store credit program performance"
        primaryAction={{
          content: 'Create Report',
          onAction: toggleReportBuilder,
          icon: PlusMinor
        }}
      >
        <HorizontalStack gap="4" blockAlign="start" align="space-between">
          <Box minWidth="240px">
            <Card>
              <Card.Section title="Date Range">
                <VerticalStack gap="4">
                  <DatePicker
                    month={month}
                    year={year}
                    onChange={handleDateChange}
                    onMonthChange={handleMonthChange}
                    selected={selectedDates}
                    allowRange
                  />
                  
                  <Select
                    label="Quick Select"
                    labelHidden
                    options={[
                      { label: 'Custom', value: 'custom' },
                      { label: 'Last 7 days', value: '7days' },
                      { label: 'Last 30 days', value: '30days' },
                      { label: 'Last 90 days', value: '90days' },
                      { label: 'This year', value: 'thisyear' }
                    ]}
                    value="custom"
                    onChange={(value) => {
                      const now = new Date();
                      let start = new Date();
                      
                      switch (value) {
                        case '7days':
                          start = new Date(now);
                          start.setDate(now.getDate() - 7);
                          break;
                        case '30days':
                          start = new Date(now);
                          start.setDate(now.getDate() - 30);
                          break;
                        case '90days':
                          start = new Date(now);
                          start.setDate(now.getDate() - 90);
                          break;
                        case 'thisyear':
                          start = new Date(now.getFullYear(), 0, 1);
                          break;
                        default:
                          return;
                      }
                      
                      setSelectedDates({ start, end: now });
                    }}
                  />
                  
                  <ButtonGroup>
                    <Popover
                      active={isExportPopoverActive}
                      activator={
                        <Button
                          icon={ExportMinor}
                          onClick={toggleExportPopover}
                          disabled={isLoading}
                        >
                          Export
                        </Button>
                      }
                      onClose={toggleExportPopover}
                    >
                      <ActionList
                        items={[
                          {
                            content: 'Export as PDF',
                            onAction: () => handleExport('pdf'),
                          },
                          {
                            content: 'Export as CSV',
                            onAction: () => handleExport('csv'),
                          },
                          {
                            content: 'Export as Excel',
                            onAction: () => handleExport('xlsx'),
                          },
                        ]}
                      />
                    </Popover>
                    
                    <Button
                      icon={EmailMajor}
                      onClick={toggleScheduleModal}
                      disabled={isLoading}
                    >
                      Schedule
                    </Button>
                  </ButtonGroup>
                </VerticalStack>
              </Card.Section>
            </Card>
          </Box>
          
          <Box grow={1}>
            <Card>
              <Tabs
                tabs={tabs}
                selected={selectedTab}
                onSelect={handleTabChange}
                fitted
              />
              
              <Card.Section>
                {selectedTab === 0 && renderDashboard()}
                {selectedTab === 1 && renderCreditsTab()}
                {selectedTab === 2 && renderCustomersTab()}
                {selectedTab === 3 && renderStaffTab()}
                {selectedTab === 4 && renderCustomReportsTab()}
              </Card.Section>
            </Card>
          </Box>
        </HorizontalStack>
      </Page>
      
      {renderReportBuilderModal()}
      {renderScheduleModal()}
    </AdminLayout>
  );
};

export default AnalyticsDashboard; 