import React, { useState, useEffect, useCallback } from 'react';
import { 
  Page,
  Layout,
  Card,
  Tabs,
  Frame,
  Toast,
  Button,
  ButtonGroup,
  Text,
  Stack,
  EmptyState,
  Icon,
  SkeletonBodyText
} from '@shopify/polaris';
import { 
  TransactionMajor, 
  ReportsMajor, 
  ListMajor, 
  AnalyticsMajor,
  ChartBarMajor
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import TransactionList from './TransactionList';
import TransactionDetail from './TransactionDetail';
import { Transaction } from '../../types/credit';

const TransactionDashboard: React.FC = () => {
  const navigate = useNavigate();
  const api = useAPI();
  
  // State
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [stats, setStats] = useState<any>(null);
  
  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  
  // Tabs
  const tabs = [
    {
      id: 'all-transactions',
      content: 'All Transactions',
      accessibilityLabel: 'All transactions',
      panelID: 'all-transactions-panel',
      icon: ListMajor,
    },
    {
      id: 'transaction-reports',
      content: 'Reports & Analytics',
      accessibilityLabel: 'Transaction reports and analytics',
      panelID: 'transaction-reports-panel',
      icon: ChartBarMajor,
    },
  ];
  
  // Fetch transaction stats
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/transactions/stats');
      
      if (response.data.success) {
        setStats(response.data.stats);
      } else {
        setError(response.data.error || 'Failed to fetch transaction statistics');
      }
    } catch (err) {
      console.error('Error fetching transaction stats:', err);
      setError('There was an error loading transaction statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  
  // Load initial stats
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  
  // Handle tab change
  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    
    // Reset transaction detail view when switching tabs
    if (showTransactionDetail) {
      setShowTransactionDetail(false);
      setSelectedTransaction(null);
    }
  }, [showTransactionDetail]);
  
  // Handle transaction selection
  const handleTransactionSelect = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetail(true);
  }, []);
  
  // Handle back from transaction detail
  const handleBackFromDetail = useCallback(() => {
    setShowTransactionDetail(false);
    setSelectedTransaction(null);
  }, []);
  
  // Handle transaction void
  const handleVoidTransaction = useCallback(async (id: string, reason: string) => {
    try {
      const response = await api.post(`/api/transactions/${id}/void`, { reason });
      
      if (response.data.success) {
        setToastMessage('Transaction voided successfully');
        setToastError(false);
        setToastActive(true);
        
        // Reset detail view and refresh data
        setShowTransactionDetail(false);
        setSelectedTransaction(null);
        fetchStats();
      } else {
        setToastMessage(response.data.error || 'Failed to void transaction');
        setToastError(true);
        setToastActive(true);
      }
    } catch (err) {
      console.error('Error voiding transaction:', err);
      setToastMessage('There was an error voiding the transaction. Please try again.');
      setToastError(true);
      setToastActive(true);
    }
  }, [api, fetchStats]);
  
  // Navigate to full reports page
  const handleViewFullReports = useCallback(() => {
    navigate('/transaction-reports');
  }, [navigate]);
  
  // Toast handler
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  // Render
  return (
    <Frame>
      <Page
        title="Transaction Management"
        subtitle="View and manage all credit transactions"
        primaryAction={
          !showTransactionDetail ? {
            content: 'View Full Reports',
            icon: ReportsMajor,
            onAction: handleViewFullReports
          } : undefined
        }
      >
        {/* Summary Cards */}
        {!showTransactionDetail && selectedTab === 0 && (
          <Layout>
            <Layout.Section oneHalf>
              <Card>
                {loading ? (
                  <Card.Section>
                    <SkeletonBodyText lines={3} />
                  </Card.Section>
                ) : error ? (
                  <Card.Section>
                    <Text color="critical">{error}</Text>
                  </Card.Section>
                ) : stats ? (
                  <Card.Section>
                    <Stack distribution="fillEvenly">
                      <Stack vertical spacing="extraTight">
                        <Text variant="headingLg" as="h3">
                          {stats.totalTransactions || 0}
                        </Text>
                        <Text variant="bodyMd" as="p" color="subdued">
                          Total Transactions
                        </Text>
                      </Stack>
                      
                      <Stack vertical spacing="extraTight">
                        <Text variant="headingLg" as="h3">
                          {stats.issuedAmount ? formatCurrency(stats.issuedAmount) : '$0.00'}
                        </Text>
                        <Text variant="bodyMd" as="p" color="subdued">
                          Issued
                        </Text>
                      </Stack>
                      
                      <Stack vertical spacing="extraTight">
                        <Text variant="headingLg" as="h3">
                          {stats.redeemedAmount ? formatCurrency(stats.redeemedAmount) : '$0.00'}
                        </Text>
                        <Text variant="bodyMd" as="p" color="subdued">
                          Redeemed
                        </Text>
                      </Stack>
                    </Stack>
                  </Card.Section>
                ) : (
                  <Card.Section>
                    <Text>No transaction data available</Text>
                  </Card.Section>
                )}
              </Card>
            </Layout.Section>
            
            <Layout.Section oneHalf>
              <Card>
                <Card.Section title="Quick Actions">
                  <ButtonGroup>
                    <Button 
                      onClick={() => navigate('/transactions')}
                      icon={ListMajor}
                    >
                      All Transactions
                    </Button>
                    <Button 
                      onClick={() => navigate('/transaction-reports')}
                      icon={AnalyticsMajor}
                    >
                      Analytics
                    </Button>
                    <Button 
                      onClick={() => navigate('/credits')}
                      primary
                    >
                      Manage Credits
                    </Button>
                  </ButtonGroup>
                </Card.Section>
              </Card>
            </Layout.Section>
          </Layout>
        )}
        
        {/* Tabs Container */}
        <Card>
          <Tabs
            tabs={tabs}
            selected={selectedTab}
            onSelect={handleTabChange}
            fitted
          />
          
          {/* Tab Content */}
          <Card.Section>
            {/* Transaction Detail View */}
            {showTransactionDetail && selectedTransaction && (
              <TransactionDetail
                transaction={selectedTransaction}
                isLoading={false}
                error={null}
                onBack={handleBackFromDetail}
                onVoid={handleVoidTransaction}
              />
            )}
            
            {/* Transaction List View */}
            {!showTransactionDetail && selectedTab === 0 && (
              <TransactionList 
                title="Recent Transactions"
                showFilters={true}
                showStats={false}
                onFilterChange={() => fetchStats()}
              />
            )}
            
            {/* Reports Tab */}
            {!showTransactionDetail && selectedTab === 1 && (
              <Stack vertical alignment="center">
                <EmptyState
                  heading="Transaction Reports"
                  action={{
                    content: 'View Full Reports',
                    onAction: handleViewFullReports,
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Gain valuable insights with comprehensive transaction reports and analytics.
                    View transaction trends, filter by date ranges, and export data for further analysis.
                  </p>
                </EmptyState>
              </Stack>
            )}
          </Card.Section>
        </Card>
        
        {/* Toast */}
        {toastActive && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={dismissToast}
            duration={4000}
          />
        )}
      </Page>
    </Frame>
  );
};

export default TransactionDashboard; 