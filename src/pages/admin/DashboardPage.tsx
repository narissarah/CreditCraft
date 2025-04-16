import React, { useState, useEffect } from 'react';
import {
  Page,
  Card,
  Layout,
  TextContainer,
  Heading,
  Badge,
  SkeletonBodyText,
  Button,
  LegacyStack,
  Tabs,
  EmptyState,
  DataTable,
} from '@shopify/polaris';
import { AdminLayout, useAdminLayout } from '../../components/layouts/AdminLayout';
import { SummaryCard, StatusBadge } from '../../components/common/AdminUIComponents';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const DashboardPage: React.FC = () => {
  const { showToast, setIsLoading } = useAdminLayout();
  const navigate = useNavigate();
  
  // State for all dashboard data
  const [isLoading, setIsPageLoading] = useState(true);
  const [summaryData, setSummaryData] = useState({
    activeCredits: 0,
    totalCustomersWithCredit: 0,
    creditsIssuedThisMonth: 0,
    totalCreditsAmount: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentCredits, setRecentCredits] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsPageLoading(true);
      setIsLoading(true);
      
      try {
        // In a real app, these would be separate API calls
        // For demo, we'll simulate the API calls with a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data
        setSummaryData({
          activeCredits: 245,
          totalCustomersWithCredit: 183,
          creditsIssuedThisMonth: 57,
          totalCreditsAmount: 12580.75,
        });
        
        setRecentTransactions([
          {
            id: 'txn-1',
            date: new Date(),
            customerId: 'cust-123',
            customerName: 'John Smith',
            amount: 50.00,
            type: 'CREDIT_APPLIED',
            location: 'POS',
          },
          {
            id: 'txn-2',
            date: new Date(Date.now() - 86400000),
            customerId: 'cust-456',
            customerName: 'Emily Johnson',
            amount: 25.50,
            type: 'CREDIT_ISSUED',
            location: 'Online',
          },
          {
            id: 'txn-3',
            date: new Date(Date.now() - 172800000),
            customerId: 'cust-789',
            customerName: 'Michael Brown',
            amount: 100.00,
            type: 'CREDIT_ISSUED',
            location: 'Admin',
          },
        ]);
        
        setRecentCredits([
          {
            id: 'credit-1',
            customerId: 'cust-123',
            customerName: 'John Smith',
            amount: 50.00,
            remaining: 35.25,
            status: 'ACTIVE',
            issueDate: new Date(),
            expiryDate: new Date(Date.now() + 30 * 86400000),
          },
          {
            id: 'credit-2',
            customerId: 'cust-456',
            customerName: 'Emily Johnson',
            amount: 75.00,
            remaining: 75.00,
            status: 'ACTIVE',
            issueDate: new Date(Date.now() - 86400000),
            expiryDate: new Date(Date.now() + 60 * 86400000),
          },
          {
            id: 'credit-3',
            customerId: 'cust-789',
            customerName: 'Michael Brown',
            amount: 100.00,
            remaining: 0,
            status: 'USED',
            issueDate: new Date(Date.now() - 172800000),
            expiryDate: new Date(Date.now() + 45 * 86400000),
          },
        ]);
        
        // Show success toast
        showToast('Dashboard data loaded successfully');
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        showToast('Failed to load dashboard data', true);
      } finally {
        setIsPageLoading(false);
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [showToast, setIsLoading]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };
  
  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // Tab change handler
  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  };

  // Tabs config
  const tabs = [
    {
      id: 'recent-transactions',
      content: 'Recent Transactions',
      accessibilityLabel: 'Recent Transactions',
      panelID: 'recent-transactions-content',
    },
    {
      id: 'recent-credits',
      content: 'Recent Credits',
      accessibilityLabel: 'Recent Credits',
      panelID: 'recent-credits-content',
    },
  ];

  // Transaction rows
  const transactionRows = recentTransactions.map(transaction => [
    transaction.id,
    formatDate(transaction.date),
    transaction.customerName,
    formatCurrency(transaction.amount),
    <Badge status={transaction.type === 'CREDIT_APPLIED' ? 'success' : 'info'}>
      {transaction.type.replace('_', ' ')}
    </Badge>,
    transaction.location,
    <Button plain onClick={() => navigate(`/admin/transactions/${transaction.id}`)}>
      View
    </Button>,
  ]);

  // Credit rows
  const creditRows = recentCredits.map(credit => [
    credit.id,
    credit.customerName,
    formatCurrency(credit.amount),
    formatCurrency(credit.remaining),
    <StatusBadge status={credit.status} />,
    formatDate(credit.issueDate),
    formatDate(credit.expiryDate),
    <Button plain onClick={() => navigate(`/admin/credits/${credit.id}`)}>
      View
    </Button>,
  ]);

  // Render content based on tab
  const renderTabContent = () => {
    if (isLoading) {
      return (
        <Card>
          <Card.Section>
            <SkeletonBodyText lines={10} />
          </Card.Section>
        </Card>
      );
    }

    if (selectedTab === 0) {
      return (
        <Card>
          <DataTable
            columnContentTypes={[
              'text',
              'text',
              'text',
              'numeric',
              'text',
              'text',
              'text',
            ]}
            headings={[
              'ID',
              'Date',
              'Customer',
              'Amount',
              'Type',
              'Location',
              '',
            ]}
            rows={transactionRows}
            footerContent={
              <Button onClick={() => navigate('/admin/transactions')}>
                View all transactions
              </Button>
            }
            emptyState={
              <EmptyState
                heading="No recent transactions"
                image=""
              >
                <p>No transactions have been recorded yet.</p>
              </EmptyState>
            }
          />
        </Card>
      );
    } else {
      return (
        <Card>
          <DataTable
            columnContentTypes={[
              'text',
              'text',
              'numeric',
              'numeric',
              'text',
              'text',
              'text',
              'text',
            ]}
            headings={[
              'ID',
              'Customer',
              'Amount',
              'Remaining',
              'Status',
              'Issue Date',
              'Expiry Date',
              '',
            ]}
            rows={creditRows}
            footerContent={
              <Button onClick={() => navigate('/admin/credits')}>
                View all credits
              </Button>
            }
            emptyState={
              <EmptyState
                heading="No recent credits"
                image=""
              >
                <p>No credits have been issued yet.</p>
              </EmptyState>
            }
          />
        </Card>
      );
    }
  };

  return (
    <AdminLayout>
      <Page title="Dashboard" fullWidth>
        <Layout>
          <Layout.Section>
            <LegacyStack distribution="fillEvenly">
              <SummaryCard
                title="Active Credits"
                value={summaryData.activeCredits.toString()}
                loading={isLoading}
                trend={{
                  value: 12,
                  isUpward: true
                }}
              />
              <SummaryCard
                title="Customers With Credit"
                value={summaryData.totalCustomersWithCredit.toString()}
                loading={isLoading}
                trend={{
                  value: 8,
                  isUpward: true
                }}
              />
              <SummaryCard
                title="Credits Issued This Month"
                value={summaryData.creditsIssuedThisMonth.toString()}
                loading={isLoading}
                trend={{
                  value: 5,
                  isUpward: true
                }}
              />
              <SummaryCard
                title="Total Credit Value"
                value={formatCurrency(summaryData.totalCreditsAmount)}
                loading={isLoading}
                trend={{
                  value: 15.2,
                  isUpward: true
                }}
              />
            </LegacyStack>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />
              <Card.Section>
                {renderTabContent()}
              </Card.Section>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card sectioned>
              <TextContainer>
                <Heading>Quick Actions</Heading>
              </TextContainer>
              <LegacyStack distribution="fill" spacing="loose">
                <Button primary onClick={() => navigate('/admin/credits/new')}>
                  Issue New Credit
                </Button>
                <Button onClick={() => navigate('/admin/customers')}>
                  Browse Customers
                </Button>
                <Button onClick={() => navigate('/admin/settings')}>
                  Manage Settings
                </Button>
              </LegacyStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </AdminLayout>
  );
};

export default DashboardPage; 