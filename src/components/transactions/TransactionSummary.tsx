import React, { useState, useEffect } from 'react';
import { Card, Select, Stack, TextContainer, Text, ButtonGroup, Button, Spinner, EmptyState } from '@shopify/polaris';
import { formatCurrency } from '../../utils/formatters';

interface SummaryItem {
  group: string;
  count: number;
  totalAmount: number;
}

interface SummaryData {
  summary: SummaryItem[];
  groupBy: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionSummaryProps {
  title?: string;
}

const TransactionSummary: React.FC<TransactionSummaryProps> = ({ title = 'Transaction Summary' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [groupBy, setGroupBy] = useState<string>('type');
  const [dateRange, setDateRange] = useState<string>('month');
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryData = async () => {
    setIsLoading(true);
    setError(null);

    // Calculate date range based on selection
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    const now = new Date();
    dateTo = now.toISOString();

    switch (dateRange) {
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = weekAgo.toISOString();
        break;
      case 'month':
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFrom = monthAgo.toISOString();
        break;
      case 'quarter':
        const quarterAgo = new Date();
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        dateFrom = quarterAgo.toISOString();
        break;
      case 'year':
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateFrom = yearAgo.toISOString();
        break;
      case 'all':
        dateFrom = undefined;
        break;
    }

    try {
      const queryParams = new URLSearchParams({
        groupBy,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      const response = await fetch(`/api/transactions/summary?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch summary data');
      }

      const data = await response.json();

      if (data.success) {
        setSummaryData(data);
      } else {
        throw new Error(data.error || 'Failed to fetch summary data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching summary data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryData();
  }, [groupBy, dateRange]);

  const groupByOptions = [
    { label: 'Transaction Type', value: 'type' },
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Location', value: 'location' },
    { label: 'Staff', value: 'staff' },
  ];

  const dateRangeOptions = [
    { label: 'Last 7 days', value: 'week' },
    { label: 'Last 30 days', value: 'month' },
    { label: 'Last 90 days', value: 'quarter' },
    { label: 'Last year', value: 'year' },
    { label: 'All time', value: 'all' },
  ];

  if (isLoading) {
    return (
      <Card sectioned title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="large" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sectioned title={title}>
        <EmptyState
          heading="Could not load summary"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>{error}</p>
        </EmptyState>
      </Card>
    );
  }

  if (!summaryData || summaryData.summary.length === 0) {
    return (
      <Card sectioned title={title}>
        <EmptyState
          heading="No data available"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>No transaction data available for the selected criteria.</p>
        </EmptyState>
      </Card>
    );
  }

  // Calculate total amounts
  const totalAmount = summaryData.summary.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalCount = summaryData.summary.reduce((sum, item) => sum + item.count, 0);

  const formatGroupLabel = (group: string, groupByType: string): string => {
    if (groupByType === 'type') {
      const typeMap: Record<string, string> = {
        'ISSUE': 'Issued',
        'REDEEM': 'Redeemed',
        'ADJUST': 'Adjusted',
        'CANCEL': 'Cancelled',
        'EXPIRE': 'Expired',
      };
      return typeMap[group] || group;
    }
    return group || 'Unknown';
  };

  return (
    <Card title={title}>
      <Card.Section>
        <Stack distribution="equalSpacing">
          <Stack>
            <Select
              label="Group by"
              options={groupByOptions}
              onChange={setGroupBy}
              value={groupBy}
              labelInline
            />
            <Select
              label="Time period"
              options={dateRangeOptions}
              onChange={setDateRange}
              value={dateRange}
              labelInline
            />
          </Stack>
          <ButtonGroup>
            <Button onClick={() => fetchSummaryData()}>Refresh</Button>
            <Button
              url={`/api/transactions/export?format=csv&dateFrom=${summaryData.dateFrom || ''}&dateTo=${
                summaryData.dateTo || ''
              }`}
              external
            >
              Export CSV
            </Button>
          </ButtonGroup>
        </Stack>
      </Card.Section>

      <Card.Section>
        <TextContainer>
          <Stack distribution="equalSpacing">
            <Stack.Item>
              <Text variant="headingMd">Total Amount:</Text>
              <Text variant="heading2xl">{formatCurrency(totalAmount)}</Text>
            </Stack.Item>
            <Stack.Item>
              <Text variant="headingMd">Total Transactions:</Text>
              <Text variant="heading2xl">{totalCount}</Text>
            </Stack.Item>
          </Stack>
        </TextContainer>
      </Card.Section>

      <Card.Section title="Breakdown">
        <Stack vertical>
          {summaryData.summary.map((item) => (
            <Stack distribution="fillEvenly" key={item.group}>
              <Text variant="bodyMd">{formatGroupLabel(item.group, groupBy)}</Text>
              <Text variant="bodyMd">{item.count} transactions</Text>
              <Text variant="bodyMd" fontWeight="bold">
                {formatCurrency(item.totalAmount)}
              </Text>
              <Text variant="bodyMd">
                {((item.totalAmount / totalAmount) * 100).toFixed(1)}%
              </Text>
            </Stack>
          ))}
        </Stack>
      </Card.Section>
    </Card>
  );
};

export default TransactionSummary; 