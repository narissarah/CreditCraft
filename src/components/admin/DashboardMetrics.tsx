import React, { useState, useEffect } from 'react';
import { Card, Layout, TextContainer, SkeletonBodyText, SkeletonDisplayText } from '@shopify/polaris';
import { SummaryCard } from '../common/AdminUIComponents';
import { useShopifyBridge } from '../../hooks/useAppBridge';

interface Metrics {
  totalActiveCredits: number;
  totalCreditsIssued: number;
  totalCreditsRedeemed: number;
  activeCustomers: number;
  averageCreditAmount: number;
  creditExpiringThisMonth: number;
  pendingAdjustments: number;
}

export const DashboardMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authenticatedFetch } = useShopifyBridge();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        const response = await authenticatedFetch('/api/metrics/dashboard');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }

        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        setError('Failed to load dashboard metrics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh metrics every 5 minutes
    const intervalId = setInterval(fetchMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [authenticatedFetch]);

  if (error) {
    return (
      <Card>
        <Card.Section>
          <TextContainer>
            <p>{error}</p>
          </TextContainer>
        </Card.Section>
      </Card>
    );
  }

  return (
    <Layout>
      <Layout.Section oneHalf>
        <SummaryCard
          title="Active Credits"
          value={metrics?.totalActiveCredits?.toLocaleString() || '0'}
          loading={isLoading}
          trend={{
            value: 5,
            direction: 'up'
          }}
          tooltipContent="Total number of active, non-expired credits"
        />
      </Layout.Section>
      
      <Layout.Section oneHalf>
        <SummaryCard
          title="Credits Issued (30 days)"
          value={metrics?.totalCreditsIssued?.toLocaleString() || '0'}
          loading={isLoading}
          trend={{
            value: 12,
            direction: 'up'
          }}
          tooltipContent="Total number of credits issued in the last 30 days"
        />
      </Layout.Section>

      <Layout.Section oneHalf>
        <SummaryCard
          title="Credits Redeemed (30 days)"
          value={metrics?.totalCreditsRedeemed?.toLocaleString() || '0'}
          loading={isLoading}
          trend={{
            value: 8,
            direction: 'up'
          }}
          tooltipContent="Total number of credits redeemed in the last 30 days"
        />
      </Layout.Section>

      <Layout.Section oneHalf>
        <SummaryCard
          title="Active Customers"
          value={metrics?.activeCustomers?.toLocaleString() || '0'}
          loading={isLoading}
          trend={{
            value: 3,
            direction: 'up'
          }}
          tooltipContent="Total number of customers with active credits"
        />
      </Layout.Section>

      <Layout.Section oneHalf>
        <SummaryCard
          title="Average Credit Amount"
          value={metrics?.averageCreditAmount ? `$${metrics.averageCreditAmount.toFixed(2)}` : '$0.00'}
          loading={isLoading}
          tooltipContent="Average amount of all active credits"
        />
      </Layout.Section>

      <Layout.Section oneHalf>
        <SummaryCard
          title="Credits Expiring Soon"
          value={metrics?.creditExpiringThisMonth?.toLocaleString() || '0'}
          loading={isLoading}
          trend={{
            value: 2,
            direction: 'up'
          }}
          trendColor="warning"
          tooltipContent="Credits expiring in the next 30 days"
        />
      </Layout.Section>
    </Layout>
  );
}; 