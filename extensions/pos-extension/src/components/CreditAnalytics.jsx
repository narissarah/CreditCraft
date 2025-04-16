import React, { useState, useEffect, useMemo } from 'react';
import { Card, Tabs, Spinner, EmptyState, VerticalStack, HorizontalStack, Text, Banner } from '@shopify/polaris';
import { AnalyticsMinor, CreditCardMajor } from '@shopify/polaris-icons';
import { useAppBridge } from '../hooks/useAppBridge';
import { useLocationManager } from '../utils/locationManager';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, Title, Tooltip, Legend, PointElement } from 'chart.js';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, Title, Tooltip, Legend, PointElement);

/**
 * Credit Analytics Component
 * Displays credit usage metrics and trends for the POS extension
 */
export default function CreditAnalytics() {
  const { fetchWithAuth, showToast } = useAppBridge();
  const { currentLocation } = useLocationManager();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        // Include location ID if available
        const locationParam = currentLocation ? `?locationId=${currentLocation.id}` : '';
        const response = await fetchWithAuth(`/api/analytics/credits${locationParam}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to load analytics');
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError(err.message || 'Failed to load analytics data');
        showToast('Failed to load analytics data', 'critical');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [fetchWithAuth, currentLocation, showToast]);

  // Format date labels for charts
  const formatDateLabels = (dates) => {
    return dates.map(date => {
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!analytics) return null;

    // Credit issuance by day
    const issuanceData = {
      labels: formatDateLabels(analytics.issuanceByDay.map(d => d.date)),
      datasets: [
        {
          label: 'Credit Issued ($)',
          data: analytics.issuanceByDay.map(d => d.amount),
          backgroundColor: 'rgba(0, 128, 96, 0.6)',
          borderColor: 'rgba(0, 128, 96, 1)',
          borderWidth: 1,
        },
      ],
    };

    // Credit redemption by day
    const redemptionData = {
      labels: formatDateLabels(analytics.redemptionByDay.map(d => d.date)),
      datasets: [
        {
          label: 'Credit Redeemed ($)',
          data: analytics.redemptionByDay.map(d => d.amount),
          backgroundColor: 'rgba(50, 101, 178, 0.6)',
          borderColor: 'rgba(50, 101, 178, 1)',
          borderWidth: 1,
        },
      ],
    };

    // Credit balance trend
    const balanceTrendData = {
      labels: formatDateLabels(analytics.balanceTrend.map(d => d.date)),
      datasets: [
        {
          label: 'Outstanding Credit ($)',
          data: analytics.balanceTrend.map(d => d.amount),
          fill: false,
          borderColor: 'rgba(145, 40, 170, 1)',
          tension: 0.1,
          pointBackgroundColor: 'rgba(145, 40, 170, 1)',
        },
      ],
    };

    return { issuanceData, redemptionData, balanceTrendData };
  }, [analytics]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value;
          }
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  };

  // Tab content
  const tabs = [
    {
      id: 'summary',
      content: 'Summary',
      accessibilityLabel: 'Summary Tab',
      panelID: 'summary-panel',
    },
    {
      id: 'issuance',
      content: 'Issuance',
      accessibilityLabel: 'Issuance Tab',
      panelID: 'issuance-panel',
    },
    {
      id: 'redemption',
      content: 'Redemption',
      accessibilityLabel: 'Redemption Tab',
      panelID: 'redemption-panel',
    },
    {
      id: 'trends',
      content: 'Trends',
      accessibilityLabel: 'Trends Tab',
      panelID: 'trends-panel',
    },
  ];

  // Render summary metrics
  const renderSummary = () => {
    if (!analytics) return null;

    const { summary } = analytics;
    
    return (
      <VerticalStack gap="4">
        <HorizontalStack gap="4" wrap={false}>
          <Card padding="4" background="bg-surface-secondary" style={{ flex: 1 }}>
            <VerticalStack gap="2">
              <Text variant="headingMd" fontWeight="semibold">Total Active Credits</Text>
              <Text variant="heading3xl">{summary.activeCreditsCount}</Text>
              <Text variant="bodySm" color="subdued">Outstanding amount: ${summary.activeCreditsAmount.toFixed(2)}</Text>
            </VerticalStack>
          </Card>
          
          <Card padding="4" background="bg-surface-secondary" style={{ flex: 1 }}>
            <VerticalStack gap="2">
              <Text variant="headingMd" fontWeight="semibold">Credits Issued (30d)</Text>
              <Text variant="heading3xl">${summary.issuedLast30Days.toFixed(2)}</Text>
              <Text variant="bodySm" color="subdued">Count: {summary.issuedCountLast30Days}</Text>
            </VerticalStack>
          </Card>
          
          <Card padding="4" background="bg-surface-secondary" style={{ flex: 1 }}>
            <VerticalStack gap="2">
              <Text variant="headingMd" fontWeight="semibold">Credits Redeemed (30d)</Text>
              <Text variant="heading3xl">${summary.redeemedLast30Days.toFixed(2)}</Text>
              <Text variant="bodySm" color="subdued">Count: {summary.redeemedCountLast30Days}</Text>
            </VerticalStack>
          </Card>
        </HorizontalStack>
        
        <Card sectioned title="Recent Activity">
          {summary.recentTransactions && summary.recentTransactions.length > 0 ? (
            <div>
              {summary.recentTransactions.map((transaction, index) => (
                <div key={index} style={{ padding: '10px 0', borderBottom: index < summary.recentTransactions.length - 1 ? '1px solid #e6e6e6' : 'none' }}>
                  <HorizontalStack gap="4" align="space-between">
                    <div>
                      <Text variant="bodyMd" fontWeight="semibold">{transaction.type}</Text>
                      <Text variant="bodySm" color="subdued">{new Date(transaction.date).toLocaleString()}</Text>
                    </div>
                    <Text variant="bodyMd" fontWeight="bold" 
                      color={transaction.type === 'REDEMPTION' ? 'critical' : 'success'}>
                      {transaction.type === 'REDEMPTION' ? '-' : '+'} ${transaction.amount.toFixed(2)}
                    </Text>
                  </HorizontalStack>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState heading="No recent activity" image="">
              <p>No credit transactions have been recorded recently.</p>
            </EmptyState>
          )}
        </Card>
      </VerticalStack>
    );
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <VerticalStack gap="4" align="center">
            <Spinner size="large" />
            <Text variant="bodyMd">Loading analytics data...</Text>
          </VerticalStack>
        </div>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card>
        <Banner
          title="Failed to load analytics"
          status="critical"
        >
          <p>{error}</p>
        </Banner>
      </Card>
    );
  }

  // Render empty state if no data
  if (!analytics) {
    return (
      <Card sectioned>
        <EmptyState
          heading="No analytics data available"
          image=""
          action={{ content: 'Refresh', onAction: () => window.location.reload() }}
        >
          <p>There is no credit analytics data available at this time.</p>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <Tabs
        tabs={tabs}
        selected={selectedTab}
        onSelect={(index) => setSelectedTab(index)}
      >
        <Card.Section>
          {selectedTab === 0 && renderSummary()}
          
          {selectedTab === 1 && (
            <div style={{ height: '400px', padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Credit Issuance (Last 30 Days)</Text>
              {chartData && <Bar data={chartData.issuanceData} options={chartOptions} />}
            </div>
          )}
          
          {selectedTab === 2 && (
            <div style={{ height: '400px', padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Credit Redemption (Last 30 Days)</Text>
              {chartData && <Bar data={chartData.redemptionData} options={chartOptions} />}
            </div>
          )}
          
          {selectedTab === 3 && (
            <div style={{ height: '400px', padding: '1rem' }}>
              <Text variant="headingMd" as="h3">Outstanding Credit Balance Trend</Text>
              {chartData && <Line data={chartData.balanceTrendData} options={chartOptions} />}
            </div>
          )}
        </Card.Section>
      </Tabs>
    </Card>
  );
} 