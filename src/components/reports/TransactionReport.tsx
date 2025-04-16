import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Tabs,
  DatePicker,
  Button,
  ButtonGroup,
  Select,
  Stack,
  Filters,
  Text,
  Spinner,
  Banner,
  EmptyState,
  SkeletonBodyText,
  SkeletonDisplayText,
  Modal,
  Form,
  FormLayout,
  TextField,
  Popover,
  ActionList,
  Box,
  Icon,
  TextContainer,
  Tooltip,
  LegacyCard,
  FilterInterface
} from '@shopify/polaris';
import { 
  CalendarMinor, 
  ExportMinor, 
  ReportMinor, 
  EmailMajor,
  InfoMinor
} from '@shopify/polaris-icons';
import { useAPI } from '../../hooks/useAPI';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { SummaryCard } from '../common/AdminUIComponents';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface ReportFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  locationId: string;
  staffId: string;
  creditType: string;
  groupBy: 'day' | 'week' | 'month';
}

export default function TransactionReport() {
  const api = useAPI();
  
  // Tab state
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Data state
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [dateValue, setDateValue] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
    end: new Date(),
  });
  const [monthYear, setMonthYear] = useState({
    month: dateValue.start.getMonth(),
    year: dateValue.start.getFullYear(),
  });
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: dateValue.start,
    dateTo: dateValue.end,
    locationId: '',
    staffId: '',
    creditType: '',
    groupBy: 'day',
  });
  
  // Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleDay, setScheduleDay] = useState('monday');
  
  // Export state
  const [isExportPopoverActive, setIsExportPopoverActive] = useState(false);
  
  // Filter options
  const [locations, setLocations] = useState<Array<{label: string, value: string}>>([]);
  const [staffMembers, setStaffMembers] = useState<Array<{label: string, value: string}>>([]);
  
  // Polaris filters state
  const [appliedFilters, setAppliedFilters] = useState<FilterInterface[]>([]);
  
  // Fetch report data
  const fetchReportData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = {
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        locationId: filters.locationId || undefined,
        staffId: filters.staffId || undefined,
        creditType: filters.creditType || undefined,
        groupBy: filters.groupBy,
      };
      
      const response = await api.get('/reports/transactions', { params });
      
      if (response.data.success) {
        setReportData(response.data);
      } else {
        setError(response.data.error || 'Failed to fetch report data');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('There was an error loading the report data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [api, filters]);
  
  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      // Fetch locations
      const locationsResponse = await api.get('/locations');
      if (locationsResponse.data.success) {
        setLocations([
          { label: 'All Locations', value: '' },
          ...locationsResponse.data.locations.map((loc: any) => ({
            label: loc.name,
            value: loc.id,
          })),
        ]);
      }
      
      // Fetch staff members
      const staffResponse = await api.get('/staff');
      if (staffResponse.data.success) {
        setStaffMembers([
          { label: 'All Staff', value: '' },
          ...staffResponse.data.staff.map((staff: any) => ({
            label: staff.name,
            value: staff.id,
          })),
        ]);
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  }, [api]);
  
  // Initial data load
  useEffect(() => {
    fetchReportData();
    fetchFilterOptions();
  }, [fetchReportData, fetchFilterOptions]);
  
  // Handle filter changes
  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };
  
  // Handle date range selection
  const handleDateChange = (range: { start: Date; end: Date }) => {
    setDateValue(range);
    handleFilterChange('dateFrom', range.start);
    handleFilterChange('dateTo', range.end);
  };
  
  const handleMonthChange = (month: number, year: number) => {
    setMonthYear({ month, year });
  };
  
  // Toggle export popover
  const toggleExportPopover = useCallback(() => {
    setIsExportPopoverActive(prev => !prev);
  }, []);
  
  // Export report
  const handleExport = useCallback(async (format: 'csv' | 'pdf') => {
    try {
      const params = {
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        locationId: filters.locationId || undefined,
        staffId: filters.staffId || undefined,
        creditType: filters.creditType || undefined,
        groupBy: filters.groupBy,
        format,
      };
      
      const response = await api.get('/reports/transactions/export', {
        params,
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transaction-report-${formatDate(new Date())}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setIsExportPopoverActive(false);
    } catch (err) {
      console.error(`Error exporting report as ${format}:`, err);
      setError(`Failed to export report as ${format}. Please try again.`);
    }
  }, [api, filters]);
  
  // Schedule report
  const handleScheduleReport = useCallback(async () => {
    try {
      await api.post('/reports/schedule', {
        reportType: 'transactions',
        email: scheduleEmail,
        frequency: scheduleFrequency,
        day: scheduleDay,
        filters: {
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString(),
          locationId: filters.locationId,
          staffId: filters.staffId,
          creditType: filters.creditType,
          groupBy: filters.groupBy,
        },
      });
      
      setIsScheduleModalOpen(false);
      // Show success message
      // TODO: Add toast message
    } catch (err) {
      console.error('Error scheduling report:', err);
      setError('Failed to schedule report. Please try again.');
    }
  }, [api, scheduleEmail, scheduleFrequency, scheduleDay, filters]);
  
  // Apply filters
  const handleApplyFilters = useCallback(() => {
    fetchReportData();
  }, [fetchReportData]);
  
  // Handle filter reset
  const handleResetFilters = useCallback(() => {
    setFilters({
      dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)),
      dateTo: new Date(),
      locationId: '',
      staffId: '',
      creditType: '',
      groupBy: 'day',
    });
    
    setDateValue({
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date(),
    });
    
    setMonthYear({
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
    });
    
    setAppliedFilters([]);
  }, []);
  
  // Handle Polaris filter changes
  const handlePolarisFilterChange = useCallback((appliedFilters: FilterInterface[]) => {
    setAppliedFilters(appliedFilters);
    
    // Update filters based on applied filters
    appliedFilters.forEach(filter => {
      switch (filter.key) {
        case 'location':
          handleFilterChange('locationId', filter.value as string);
          break;
        case 'staff':
          handleFilterChange('staffId', filter.value as string);
          break;
        case 'creditType':
          handleFilterChange('creditType', filter.value as string);
          break;
        case 'groupBy':
          handleFilterChange('groupBy', filter.value as 'day' | 'week' | 'month');
          break;
      }
    });
  }, []);
  
  // Prepare chart data for transaction volume
  const getVolumeChartData = () => {
    if (!reportData || !reportData.volumes) return null;
    
    const labels = reportData.volumes.map((item: any) => item.date);
    const issueData = reportData.volumes.map((item: any) => item.issueCount);
    const redeemData = reportData.volumes.map((item: any) => item.redeemCount);
    const adjustData = reportData.volumes.map((item: any) => item.adjustCount);
    
    return {
      labels,
      datasets: [
        {
          label: 'Issue',
          data: issueData,
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: 'rgba(52, 152, 219, 1)',
        },
        {
          label: 'Redeem',
          data: redeemData,
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: 'rgba(46, 204, 113, 1)',
        },
        {
          label: 'Adjust',
          data: adjustData,
          backgroundColor: 'rgba(243, 156, 18, 0.2)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: 'rgba(243, 156, 18, 1)',
        },
      ],
    };
  };
  
  // Prepare chart data for transaction amounts
  const getAmountChartData = () => {
    if (!reportData || !reportData.amounts) return null;
    
    const labels = reportData.amounts.map((item: any) => item.date);
    const issueData = reportData.amounts.map((item: any) => item.issueAmount);
    const redeemData = reportData.amounts.map((item: any) => item.redeemAmount);
    const adjustData = reportData.amounts.map((item: any) => item.adjustAmount);
    
    return {
      labels,
      datasets: [
        {
          label: 'Issue Amount',
          data: issueData,
          backgroundColor: 'rgba(52, 152, 219, 0.5)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1,
        },
        {
          label: 'Redeem Amount',
          data: redeemData.map(val => -val), // Negative for redemptions
          backgroundColor: 'rgba(46, 204, 113, 0.5)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 1,
        },
        {
          label: 'Adjust Amount',
          data: adjustData,
          backgroundColor: 'rgba(243, 156, 18, 0.5)',
          borderColor: 'rgba(243, 156, 18, 1)',
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Prepare chart data for transaction distribution
  const getDistributionChartData = () => {
    if (!reportData || !reportData.distribution) return null;
    
    return {
      labels: ['Issue', 'Redeem', 'Adjust', 'Cancel'],
      datasets: [
        {
          data: [
            reportData.distribution.issueCount,
            reportData.distribution.redeemCount,
            reportData.distribution.adjustCount,
            reportData.distribution.cancelCount,
          ],
          backgroundColor: [
            'rgba(52, 152, 219, 0.7)',
            'rgba(46, 204, 113, 0.7)',
            'rgba(243, 156, 18, 0.7)',
            'rgba(231, 76, 60, 0.7)',
          ],
          borderColor: [
            'rgba(52, 152, 219, 1)',
            'rgba(46, 204, 113, 1)',
            'rgba(243, 156, 18, 1)',
            'rgba(231, 76, 60, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => value,
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.raw}`;
          },
        },
      },
    },
  };
  
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => formatCurrency(value),
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatCurrency(Math.abs(context.raw))}`;
          },
        },
      },
    },
  };
  
  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((acc: number, curr: number) => acc + curr, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };
  
  // Render summary cards
  const renderSummaryCards = () => {
    if (!reportData || !reportData.summary) return null;
    
    const { summary } = reportData;
    
    return (
      <Stack distribution="fillEvenly">
        <SummaryCard
          title="Total Transactions"
          value={summary.totalTransactions.toString()}
          loading={isLoading}
          trend={summary.totalTransactionsTrend}
        />
        <SummaryCard
          title="Total Issued"
          value={formatCurrency(summary.issuedAmount)}
          loading={isLoading}
          trend={summary.issuedAmountTrend}
        />
        <SummaryCard
          title="Total Redeemed"
          value={formatCurrency(summary.redeemedAmount)}
          loading={isLoading}
          trend={summary.redeemedAmountTrend}
        />
        <SummaryCard
          title="Net Balance"
          value={formatCurrency(summary.netBalance)}
          loading={isLoading}
          trend={summary.netBalanceTrend}
        />
      </Stack>
    );
  };
  
  // Render line chart for transaction volume
  const renderVolumeChart = () => {
    const chartData = getVolumeChartData();
    
    if (isLoading) {
      return (
        <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </div>
      );
    }
    
    if (!chartData) {
      return (
        <EmptyState
          heading="No transaction volume data"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Try changing the filters or date range</p>
        </EmptyState>
      );
    }
    
    return (
      <div style={{ height: '350px' }}>
        <Line data={chartData} options={lineChartOptions} />
      </div>
    );
  };
  
  // Render bar chart for transaction amounts
  const renderAmountChart = () => {
    const chartData = getAmountChartData();
    
    if (isLoading) {
      return (
        <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </div>
      );
    }
    
    if (!chartData) {
      return (
        <EmptyState
          heading="No transaction amount data"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Try changing the filters or date range</p>
        </EmptyState>
      );
    }
    
    return (
      <div style={{ height: '350px' }}>
        <Bar data={chartData} options={barChartOptions} />
      </div>
    );
  };
  
  // Render doughnut chart for transaction distribution
  const renderDistributionChart = () => {
    const chartData = getDistributionChartData();
    
    if (isLoading) {
      return (
        <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </div>
      );
    }
    
    if (!chartData) {
      return (
        <EmptyState
          heading="No transaction distribution data"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Try changing the filters or date range</p>
        </EmptyState>
      );
    }
    
    return (
      <div style={{ height: '350px' }}>
        <Doughnut data={chartData} options={doughnutChartOptions} />
      </div>
    );
  };
  
  // Render filter controls
  const renderFilterControls = () => {
    const filterConfig = [
      {
        key: 'location',
        label: 'Location',
        filter: (
          <Select
            label="Location"
            options={locations}
            onChange={(value) => handleFilterChange('locationId', value)}
            value={filters.locationId}
          />
        ),
      },
      {
        key: 'staff',
        label: 'Staff Member',
        filter: (
          <Select
            label="Staff Member"
            options={staffMembers}
            onChange={(value) => handleFilterChange('staffId', value)}
            value={filters.staffId}
          />
        ),
      },
      {
        key: 'creditType',
        label: 'Credit Type',
        filter: (
          <Select
            label="Credit Type"
            options={[
              { label: 'All Types', value: '' },
              { label: 'Store Credit', value: 'STORE_CREDIT' },
              { label: 'Gift Card', value: 'GIFT_CARD' },
              { label: 'Reward', value: 'REWARD' },
            ]}
            onChange={(value) => handleFilterChange('creditType', value)}
            value={filters.creditType}
          />
        ),
      },
      {
        key: 'groupBy',
        label: 'Group By',
        filter: (
          <Select
            label="Group By"
            options={[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
            ]}
            onChange={(value) => handleFilterChange('groupBy', value as 'day' | 'week' | 'month')}
            value={filters.groupBy}
          />
        ),
      },
    ];
    
    return (
      <Filters
        filters={filterConfig}
        appliedFilters={appliedFilters}
        onClearAll={handleResetFilters}
        onQueryChange={() => {}}
        onQueryClear={() => {}}
        onFiltersChange={handlePolarisFilterChange}
        hideQueryField
      />
    );
  };
  
  // Render date picker
  const renderDatePicker = () => {
    return (
      <Card sectioned>
        <Stack alignment="center">
          <Stack.Item>
            <Text variant="bodyMd" fontWeight="bold">
              Date Range:
            </Text>
          </Stack.Item>
          <Stack.Item fill>
            <DatePicker
              month={monthYear.month}
              year={monthYear.year}
              onChange={handleDateChange}
              onMonthChange={handleMonthChange}
              selected={dateValue}
              allowRange
            />
          </Stack.Item>
          <Stack.Item>
            <Select
              options={[
                { label: 'Last 7 days', value: '7days' },
                { label: 'Last 30 days', value: '30days' },
                { label: 'Last 90 days', value: '90days' },
                { label: 'Year to date', value: 'ytd' },
                { label: 'Last year', value: 'lastyear' },
              ]}
              onChange={(value) => {
                const now = new Date();
                let start = new Date();
                
                switch (value) {
                  case '7days':
                    start = new Date(now.setDate(now.getDate() - 7));
                    break;
                  case '30days':
                    start = new Date(now.setDate(now.getDate() - 30));
                    break;
                  case '90days':
                    start = new Date(now.setDate(now.getDate() - 90));
                    break;
                  case 'ytd':
                    start = new Date(now.getFullYear(), 0, 1);
                    break;
                  case 'lastyear':
                    start = new Date(now.getFullYear() - 1, 0, 1);
                    const end = new Date(now.getFullYear() - 1, 11, 31);
                    setDateValue({ start, end });
                    handleFilterChange('dateFrom', start);
                    handleFilterChange('dateTo', end);
                    setMonthYear({ month: start.getMonth(), year: start.getFullYear() });
                    return;
                }
                
                setDateValue({ start, end: new Date() });
                handleFilterChange('dateFrom', start);
                handleFilterChange('dateTo', new Date());
                setMonthYear({ month: start.getMonth(), year: start.getFullYear() });
              }}
              value=""
              placeholder="Quick select"
            />
          </Stack.Item>
          <Stack.Item>
            <Button primary onClick={handleApplyFilters}>Apply Filters</Button>
          </Stack.Item>
        </Stack>
      </Card>
    );
  };
  
  // Render action buttons
  const renderActions = () => {
    const exportButton = (
      <Popover
        active={isExportPopoverActive}
        activator={
          <Button
            icon={ExportMinor}
            onClick={toggleExportPopover}
            disabled={!reportData}
          >
            Export
          </Button>
        }
        onClose={toggleExportPopover}
      >
        <ActionList
          items={[
            {
              content: 'Export as CSV',
              onAction: () => handleExport('csv'),
            },
            {
              content: 'Export as PDF',
              onAction: () => handleExport('pdf'),
            },
          ]}
        />
      </Popover>
    );
    
    return (
      <Stack>
        <ButtonGroup>
          {exportButton}
          <Button 
            icon={EmailMajor} 
            onClick={() => setIsScheduleModalOpen(true)}
            disabled={!reportData}
          >
            Schedule Report
          </Button>
        </ButtonGroup>
      </Stack>
    );
  };
  
  // Render schedule modal
  const renderScheduleModal = () => {
    return (
      <Modal
        open={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Transaction Report"
        primaryAction={{
          content: 'Schedule',
          onAction: handleScheduleReport,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsScheduleModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Form onSubmit={handleScheduleReport}>
            <FormLayout>
              <TextField
                label="Email"
                value={scheduleEmail}
                onChange={setScheduleEmail}
                type="email"
                autoComplete="email"
                placeholder="Enter email address"
                required
              />
              
              <Select
                label="Frequency"
                options={[
                  { label: 'Daily', value: 'daily' },
                  { label: 'Weekly', value: 'weekly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
                value={scheduleFrequency}
                onChange={setScheduleFrequency}
              />
              
              {scheduleFrequency === 'weekly' && (
                <Select
                  label="Day of Week"
                  options={[
                    { label: 'Monday', value: 'monday' },
                    { label: 'Tuesday', value: 'tuesday' },
                    { label: 'Wednesday', value: 'wednesday' },
                    { label: 'Thursday', value: 'thursday' },
                    { label: 'Friday', value: 'friday' },
                    { label: 'Saturday', value: 'saturday' },
                    { label: 'Sunday', value: 'sunday' },
                  ]}
                  value={scheduleDay}
                  onChange={setScheduleDay}
                />
              )}
              
              {scheduleFrequency === 'monthly' && (
                <Select
                  label="Day of Month"
                  options={Array.from({ length: 31 }, (_, i) => ({
                    label: `${i + 1}`,
                    value: `${i + 1}`,
                  }))}
                  value={scheduleDay}
                  onChange={setScheduleDay}
                />
              )}
              
              <TextContainer>
                <Text variant="bodyMd">
                  Current report filters will be saved with this schedule.
                </Text>
              </TextContainer>
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    );
  };
  
  const tabs = [
    {
      id: 'summary',
      content: 'Summary',
      accessibilityLabel: 'Summary tab',
      panelID: 'summary-panel',
    },
    {
      id: 'volume',
      content: 'Transaction Volume',
      accessibilityLabel: 'Transaction volume tab',
      panelID: 'volume-panel',
    },
    {
      id: 'amount',
      content: 'Transaction Amounts',
      accessibilityLabel: 'Transaction amounts tab',
      panelID: 'amount-panel',
    },
    {
      id: 'distribution',
      content: 'Distribution',
      accessibilityLabel: 'Distribution tab',
      panelID: 'distribution-panel',
    },
  ];
  
  return (
    <>
      <Card>
        <Card.Header
          title="Transaction Report"
          actions={[renderActions()]}
        />
        
        {renderDatePicker()}
        
        <Card.Section>
          {renderFilterControls()}
        </Card.Section>
        
        {error && (
          <Card.Section>
            <Banner status="critical">{error}</Banner>
          </Card.Section>
        )}
        
        <Card.Section>
          <Tabs
            tabs={tabs}
            selected={selectedTab}
            onSelect={setSelectedTab}
          />
          
          <Box paddingBlockStart="400">
            {selectedTab === 0 && (
              <>
                <TextContainer>
                  <Text variant="headingMd">Transaction Summary</Text>
                  <Text variant="bodyMd" color="subdued">
                    Overview of transactions in the selected period
                  </Text>
                </TextContainer>
                
                <Box paddingBlockStart="400">
                  {renderSummaryCards()}
                </Box>
                
                <Box paddingBlockStart="400">
                  {renderDistributionChart()}
                </Box>
              </>
            )}
            
            {selectedTab === 1 && (
              <>
                <TextContainer>
                  <Text variant="headingMd">Transaction Volume</Text>
                  <Text variant="bodyMd" color="subdued">
                    Number of transactions by type over time
                  </Text>
                </TextContainer>
                
                <Box paddingBlockStart="400">
                  {renderVolumeChart()}
                </Box>
              </>
            )}
            
            {selectedTab === 2 && (
              <>
                <TextContainer>
                  <Text variant="headingMd">Transaction Amounts</Text>
                  <Text variant="bodyMd" color="subdued">
                    Monetary value of transactions by type over time
                  </Text>
                </TextContainer>
                
                <Box paddingBlockStart="400">
                  {renderAmountChart()}
                </Box>
              </>
            )}
            
            {selectedTab === 3 && (
              <>
                <TextContainer>
                  <Text variant="headingMd">Transaction Distribution</Text>
                  <Text variant="bodyMd" color="subdued">
                    Breakdown of transaction types in the selected period
                  </Text>
                </TextContainer>
                
                <Box paddingBlockStart="400">
                  {renderDistributionChart()}
                </Box>
              </>
            )}
          </Box>
        </Card.Section>
      </Card>
      
      {renderScheduleModal()}
    </>
  );
} 