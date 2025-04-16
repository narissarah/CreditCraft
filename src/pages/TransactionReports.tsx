import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Page,
  Layout,
  Card,
  Loading,
  Banner,
  Button,
  DatePicker,
  Select,
  Stack,
  Frame,
  Toast,
  SkeletonBodyText,
  Text,
  ButtonGroup,
  EmptyState,
  Spinner,
  TextField,
  Icon,
  Badge,
  Tabs,
  LegacyCard,
  DataTable,
  SkeletonDisplayText
} from '@shopify/polaris';
import { 
  ChartBarMajor, 
  ExportMinor, 
  PrintMinor,
  DiamondAlertMajor,
  ResetMinor,
  CalendarTimeMinor
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks/useAPI';
import ReportScheduleManager from '../components/reports/ReportScheduleManager';

// Try to use this import, if it doesn't exist in the codebase, we'll fallback to a simpler solution
// In a real project we'd verify and install these dependencies
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

try {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
  );
} catch (error) {
  console.warn('Chart.js not available:', error);
}

export default function TransactionReportsPage() {
  const navigate = useNavigate();
  const api = useAPI();
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionStats, setTransactionStats] = useState<any>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [timeFrame, setTimeFrame] = useState('daily');
  const [groupBy, setGroupBy] = useState('type');
  
  // Report data calculation
  const chartData = useMemo(() => {
    if (!transactionStats || !transactionStats.timeline) {
      return null;
    }
    
    let labels = [];
    let datasets = [];
    
    // Format based on timeframe and groupBy
    if (groupBy === 'type') {
      // Group by transaction type
      const issueData = [];
      const redeemData = [];
      const adjustData = [];
      
      for (const entry of transactionStats.timeline) {
        labels.push(entry.date);
        issueData.push(entry.issued);
        redeemData.push(entry.redeemed);
        adjustData.push(entry.adjusted);
      }
      
      datasets = [
        {
          label: 'Issued',
          data: issueData,
          borderColor: 'rgba(52, 152, 219, 1)',
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
        },
        {
          label: 'Redeemed',
          data: redeemData,
          borderColor: 'rgba(46, 204, 113, 1)',
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
        },
        {
          label: 'Adjusted',
          data: adjustData,
          borderColor: 'rgba(243, 156, 18, 1)',
          backgroundColor: 'rgba(243, 156, 18, 0.2)',
        }
      ];
    } else {
      // Group by other criteria
      const amountData = [];
      const countData = [];
      
      for (const entry of transactionStats.timeline) {
        labels.push(entry.date);
        amountData.push(entry.totalAmount);
        countData.push(entry.count);
      }
      
      datasets = [
        {
          label: 'Amount',
          data: amountData,
          borderColor: 'rgba(155, 89, 182, 1)',
          backgroundColor: 'rgba(155, 89, 182, 0.2)',
          yAxisID: 'y',
        },
        {
          label: 'Count',
          data: countData,
          borderColor: 'rgba(231, 76, 60, 1)',
          backgroundColor: 'rgba(231, 76, 60, 0.2)',
          yAxisID: 'y1',
        }
      ];
    }
    
    return {
      labels,
      datasets
    };
  }, [transactionStats, groupBy]);
  
  // Tabs
  const tabs = [
    {
      id: 'overview',
      content: 'Overview',
      accessibilityLabel: 'Overview',
      panelID: 'overview-content',
    },
    {
      id: 'trends',
      content: 'Trends',
      accessibilityLabel: 'Trends',
      panelID: 'trends-content',
    },
    {
      id: 'summary',
      content: 'Summary',
      accessibilityLabel: 'Summary',
      panelID: 'summary-content',
    },
    {
      id: 'schedules',
      content: 'Schedules',
      accessibilityLabel: 'Report Schedules',
      panelID: 'schedules-content',
    },
  ];
  
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Format dates for API
      const startDate = dateRange.start.toISOString().split('T')[0];
      const endDate = dateRange.end.toISOString().split('T')[0];
      
      // Fetch transaction stats
      const response = await api.get(`/api/transactions/stats?startDate=${startDate}&endDate=${endDate}&timeFrame=${timeFrame}`);
      
      setTransactionStats(response.data);
    } catch (err) {
      console.error('Error fetching transaction stats:', err);
      setError('Failed to load transaction reports data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, dateRange, timeFrame]);
  
  // Initial data load
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);
  
  // Handle date range selection
  const handleDateRangeChange = useCallback((range: { start: Date, end: Date }) => {
    setDateRange(range);
  }, []);
  
  // Handle time frame selection
  const timeFrameOptions = [
    {label: 'Daily', value: 'daily'},
    {label: 'Weekly', value: 'weekly'},
    {label: 'Monthly', value: 'monthly'},
  ];
  
  const handleTimeFrameChange = useCallback((value: string) => {
    setTimeFrame(value);
  }, []);
  
  // Handle group by selection
  const groupByOptions = [
    {label: 'Transaction Type', value: 'type'},
    {label: 'Amount & Count', value: 'amount'},
  ];
  
  const handleGroupByChange = useCallback((value: string) => {
    setGroupBy(value);
  }, []);
  
  // Export data
  const handleExportCSV = useCallback(() => {
    if (!transactionStats) return;
    
    const startDate = dateRange.start.toISOString().split('T')[0];
    const endDate = dateRange.end.toISOString().split('T')[0];
    
    window.open(`/api/transactions/export?format=csv&startDate=${startDate}&endDate=${endDate}`, '_blank');
    
    setToastMessage('Export started. Your download will begin shortly.');
    setToastError(false);
    setToastActive(true);
  }, [transactionStats, dateRange]);
  
  // Print report
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  }, []);
  
  // Reset filters
  const handleResetFilters = useCallback(() => {
    setDateRange({
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
    });
    setTimeFrame('daily');
    setGroupBy('type');
  }, []);
  
  // Toast handlers
  const dismissToast = useCallback(() => setToastActive(false), []);
  
  return (
    <Frame>
      <Page
        title="Transaction Reports"
        primaryAction={{
          content: 'Back to Transactions',
          onAction: () => navigate('/transactions'),
        }}
        secondaryActions={[
          {
            content: 'Export',
            icon: ExportMinor,
            onAction: handleExportCSV,
            disabled: !transactionStats || loading,
          },
          {
            content: 'Print',
            icon: PrintMinor,
            onAction: handlePrint,
            disabled: !transactionStats || loading,
          },
        ]}
        divider
      >
        {loading && <Loading />}
        
        {error && (
          <Layout.Section>
            <Banner
              title="Error loading reports"
              status="critical"
              icon={DiamondAlertMajor}
              action={{content: 'Try again', onAction: fetchReportData}}
            >
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}
        
        <Layout>
          {/* Filters */}
          {selectedTab < 3 && (
            <Layout.Section oneHalf>
              <Card>
                <Card.Section title="Report Filters">
                  <Stack vertical spacing="tight">
                    <Stack distribution="fillEvenly">
                      <Stack.Item fill>
                        <Select
                          label="Time frame"
                          options={timeFrameOptions}
                          value={timeFrame}
                          onChange={handleTimeFrameChange}
                          helpText="Group data by time period"
                        />
                      </Stack.Item>
                      <Stack.Item fill>
                        <Select
                          label="Group by"
                          options={groupByOptions}
                          value={groupBy}
                          onChange={handleGroupByChange}
                          helpText="How to group the chart data"
                        />
                      </Stack.Item>
                    </Stack>
                    
                    <div style={{ margin: '1rem 0' }}>
                      <Text variant="bodyMd" as="p">Date range</Text>
                      {typeof DatePicker !== 'undefined' && (
                        <DatePicker
                          month={dateRange.start.getMonth()}
                          year={dateRange.start.getFullYear()}
                          onChange={handleDateRangeChange}
                          selected={{
                            start: dateRange.start,
                            end: dateRange.end,
                          }}
                          allowRange
                        />
                      )}
                    </div>
                    
                    <div style={{ marginTop: '1rem' }}>
                      <Button 
                        icon={ResetMinor} 
                        onClick={handleResetFilters}
                      >
                        Reset filters
                      </Button>
                    </div>
                  </Stack>
                </Card.Section>
              </Card>
            </Layout.Section>
          )}
          
          {/* Summary stats */}
          {selectedTab < 3 && (
            <Layout.Section oneHalf>
              <Card>
                <Card.Section title="Summary">
                  {loading ? (
                    <SkeletonBodyText lines={3} />
                  ) : transactionStats ? (
                    <Stack distribution="fillEvenly">
                      <Stack vertical spacing="extraTight">
                        <Text variant="headingLg" as="h3">
                          {transactionStats.totals?.count || 0}
                        </Text>
                        <Text variant="bodyMd" as="p" color="subdued">
                          Transactions
                        </Text>
                      </Stack>
                      
                      <Stack vertical spacing="extraTight">
                        <Text variant="headingLg" as="h3">
                          {transactionStats.totals?.issued ? 
                            `${transactionStats.currency} ${transactionStats.totals.issued.toFixed(2)}` : 
                            `$0.00`}
                        </Text>
                        <Text variant="bodyMd" as="p" color="subdued">
                          Issued
                        </Text>
                      </Stack>
                      
                      <Stack vertical spacing="extraTight">
                        <Text variant="headingLg" as="h3">
                          {transactionStats.totals?.redeemed ? 
                            `${transactionStats.currency} ${transactionStats.totals.redeemed.toFixed(2)}` : 
                            `$0.00`}
                        </Text>
                        <Text variant="bodyMd" as="p" color="subdued">
                          Redeemed
                        </Text>
                      </Stack>
                    </Stack>
                  ) : (
                    <Text>No data available</Text>
                  )}
                </Card.Section>
                
                <Card.Section title="Report Actions">
                  <ButtonGroup>
                    <Button 
                      icon={ExportMinor}
                      onClick={handleExportCSV}
                      disabled={!transactionStats || loading}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      icon={PrintMinor}
                      onClick={handlePrint}
                      disabled={!transactionStats || loading}
                    >
                      Print
                    </Button>
                  </ButtonGroup>
                </Card.Section>
              </Card>
            </Layout.Section>
          )}
          
          {/* Tabs */}
          <Layout.Section>
            <Card>
              <Tabs 
                tabs={tabs} 
                selected={selectedTab} 
                onSelect={handleTabChange}
                fitted
              />
              
              <Card.Section>
                {selectedTab === 0 && (
                  <div>
                    {loading ? (
                      <SkeletonBodyText lines={10} />
                    ) : !chartData ? (
                      <EmptyState
                        heading="No transaction data available"
                        image=""
                        action={{content: 'Refresh', onAction: fetchReportData}}
                      >
                        <p>
                          There's no transaction data available for the selected time period.
                          Try adjusting your filters or adding some transactions.
                        </p>
                      </EmptyState>
                    ) : (
                      <div style={{ height: '400px' }}>
                        {/* Check if Chart.js components are available */}
                        {typeof Bar !== 'undefined' ? (
                          <Bar
                            data={chartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                title: {
                                  display: true,
                                  text: `Transaction Overview (${timeFrameOptions.find(o => o.value === timeFrame)?.label})`,
                                },
                                legend: {
                                  position: 'top',
                                },
                              },
                            }}
                          />
                        ) : (
                          <LegacyCard>
                            <DataTable
                              columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                              headings={['Date', 'Issued', 'Redeemed', 'Adjusted']}
                              rows={transactionStats.timeline.map(item => [
                                item.date,
                                item.issued?.toFixed(2) || '0.00',
                                item.redeemed?.toFixed(2) || '0.00',
                                item.adjusted?.toFixed(2) || '0.00'
                              ])}
                            />
                          </LegacyCard>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {selectedTab === 1 && (
                  <div>
                    {loading ? (
                      <SkeletonBodyText lines={10} />
                    ) : !chartData ? (
                      <EmptyState
                        heading="No trend data available"
                        image=""
                        action={{content: 'Refresh', onAction: fetchReportData}}
                      >
                        <p>
                          There's no trend data available for the selected time period.
                          Try adjusting your filters or adding some transactions.
                        </p>
                      </EmptyState>
                    ) : (
                      <div style={{ height: '400px' }}>
                        {/* Check if Chart.js components are available */}
                        {typeof Line !== 'undefined' ? (
                          <Line
                            data={chartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                title: {
                                  display: true,
                                  text: `Transaction Trends (${timeFrameOptions.find(o => o.value === timeFrame)?.label})`,
                                },
                                legend: {
                                  position: 'top',
                                },
                              },
                              scales: groupBy === 'amount' ? {
                                y: {
                                  type: 'linear',
                                  display: true,
                                  position: 'left',
                                  title: {
                                    display: true,
                                    text: 'Amount',
                                  },
                                },
                                y1: {
                                  type: 'linear',
                                  display: true,
                                  position: 'right',
                                  grid: {
                                    drawOnChartArea: false,
                                  },
                                  title: {
                                    display: true,
                                    text: 'Count',
                                  },
                                },
                              } : undefined,
                            }}
                          />
                        ) : (
                          <LegacyCard>
                            <DataTable
                              columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                              headings={['Date', 'Issued', 'Redeemed', 'Adjusted']}
                              rows={transactionStats.timeline.map(item => [
                                item.date,
                                item.issued?.toFixed(2) || '0.00',
                                item.redeemed?.toFixed(2) || '0.00',
                                item.adjusted?.toFixed(2) || '0.00'
                              ])}
                            />
                          </LegacyCard>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {selectedTab === 2 && (
                  <div>
                    {loading ? (
                      <SkeletonBodyText lines={15} />
                    ) : !transactionStats ? (
                      <EmptyState
                        heading="No summary data available"
                        image=""
                        action={{content: 'Refresh', onAction: fetchReportData}}
                      >
                        <p>
                          There's no summary data available for the selected time period.
                          Try adjusting your filters or adding some transactions.
                        </p>
                      </EmptyState>
                    ) : (
                      <LegacyCard>
                        <DataTable
                          columnContentTypes={['text', 'numeric', 'numeric']}
                          headings={['Transaction Type', 'Count', 'Amount']}
                          rows={[
                            ['Issued', transactionStats.types?.ISSUE?.count || 0, transactionStats.types?.ISSUE?.amount?.toFixed(2) || '0.00'],
                            ['Redeemed', transactionStats.types?.REDEEM?.count || 0, transactionStats.types?.REDEEM?.amount?.toFixed(2) || '0.00'],
                            ['Adjusted', transactionStats.types?.ADJUST?.count || 0, transactionStats.types?.ADJUST?.amount?.toFixed(2) || '0.00'],
                            ['Voided', transactionStats.types?.VOID?.count || 0, transactionStats.types?.VOID?.amount?.toFixed(2) || '0.00'],
                            ['Expired', transactionStats.types?.EXPIRE?.count || 0, transactionStats.types?.EXPIRE?.amount?.toFixed(2) || '0.00'],
                            ['Total', transactionStats.totals?.count || 0, transactionStats.totals?.amount?.toFixed(2) || '0.00']
                          ]}
                          totals={['', '', transactionStats.totals?.amount?.toFixed(2) || '0.00']}
                        />
                      </LegacyCard>
                    )}
                  </div>
                )}
                
                {selectedTab === 3 && (
                  <div>
                    <ReportScheduleManager />
                  </div>
                )}
              </Card.Section>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      
      {toastActive && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={dismissToast}
          duration={4000}
        />
      )}
    </Frame>
  );
} 