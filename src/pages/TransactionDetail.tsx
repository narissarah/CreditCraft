import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  Layout,
  Stack,
  Text,
  Badge,
  Link,
  Icon,
  Banner,
  Frame,
  Toast,
  SkeletonBodyText,
  SkeletonDisplayText,
  EmptyState,
  Button,
  Box
} from '@shopify/polaris';
import {
  MobileBackArrowMajor,
  TransactionMajor,
  CircleAlertMajor,
  CircleTickMajor,
  CustomersMajor,
  OrdersMajor
} from '@shopify/polaris-icons';
import { useAPI } from '../hooks/useAPI';
import { Transaction } from '../types/credit';
import { CustomerType } from '../types/customer';

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useAPI();

  // State
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  // Fetch transaction data
  const fetchTransactionData = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch transaction details
      const response = await api.get(`/api/transactions/${id}`);
      const transactionData = response.data;
      setTransaction(transactionData);
      
      // Fetch credit details if available
      if (transactionData.creditId) {
        const creditResponse = await api.get(`/api/credits/${transactionData.creditId}`);
        const creditData = creditResponse.data;
        
        // If credit has a customer ID, fetch customer details
        if (creditData.customerId) {
          const customerResponse = await api.get(`/api/customers/${creditData.customerId}`);
          setCustomer(customerResponse.data);
        }
      }
    } catch (err) {
      console.error('Error fetching transaction details:', err);
      setError('Failed to load transaction details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  // Load data on component mount
  useEffect(() => {
    fetchTransactionData();
  }, [fetchTransactionData]);

  // Formatters
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get transaction type badge
  const getTransactionBadge = (type: string) => {
    const typeMap: Record<string, { status: 'success' | 'info' | 'warning' | 'critical', icon: React.ReactNode }> = {
      ISSUE: { 
        status: 'success', 
        icon: <CircleTickMajor />
      },
      REDEMPTION: { 
        status: 'info', 
        icon: <TransactionMajor />
      },
      ADJUSTMENT: { 
        status: 'warning', 
        icon: <CircleAlertMajor />
      },
      VOID: { 
        status: 'critical', 
        icon: <CircleAlertMajor />
      }
    };
    
    const { status: badgeStatus, icon } = typeMap[type] || { status: 'default', icon: null };
    
    return (
      <Stack spacing="tight" alignment="center">
        {icon && <Icon source={icon} />}
        <Badge status={badgeStatus}>{type}</Badge>
      </Stack>
    );
  };

  // Toast handler
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <Page
        breadcrumbs={[{ content: 'Transactions', url: '/transactions' }]}
        title="Loading Transaction Details"
      >
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={3} />
            </Card>
          </Layout.Section>
          <Layout.Section secondary>
            <Card sectioned>
              <SkeletonBodyText lines={2} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Error state
  if (error) {
    return (
      <Page
        breadcrumbs={[{ content: 'Transactions', url: '/transactions' }]}
        title="Transaction Details"
      >
        <Banner
          title="Error loading transaction"
          status="critical"
          action={{ content: 'Try again', onAction: fetchTransactionData }}
        >
          <p>{error}</p>
        </Banner>
      </Page>
    );
  }

  // Not found state
  if (!transaction) {
    return (
      <Page
        breadcrumbs={[{ content: 'Transactions', url: '/transactions' }]}
        title="Transaction Not Found"
      >
        <EmptyState
          heading="Transaction not found"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          action={{ content: 'Back to transactions', onAction: () => navigate('/transactions') }}
        >
          <p>The transaction you're looking for cannot be found or doesn't exist.</p>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Frame>
      <Page
        breadcrumbs={[{ content: 'Transactions', url: '/transactions' }]}
        title={`Transaction: ${transaction.id.substring(0, 8)}`}
        subtitle={`Created on ${formatDate(transaction.createdAt)}`}
        titleMetadata={getTransactionBadge(transaction.type)}
        primaryAction={{
          content: 'Back to transactions',
          icon: MobileBackArrowMajor,
          onAction: () => navigate('/transactions')
        }}
      >
        <Layout>
          <Layout.Section>
            <Card title="Transaction Details" sectioned>
              <Stack vertical spacing="loose">
                <Stack distribution="fillEvenly" wrap={false}>
                  <Stack.Item fill>
                    <Stack vertical spacing="extraTight">
                      <Text variant="headingMd" as="h3">Transaction Type</Text>
                      <Text variant="bodyLg" as="p">
                        {getTransactionBadge(transaction.type)}
                      </Text>
                    </Stack>
                  </Stack.Item>
                  <Stack.Item fill>
                    <Stack vertical spacing="extraTight">
                      <Text variant="headingMd" as="h3">Amount</Text>
                      <Text variant="bodyLg" as="p" fontWeight="bold">
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </Stack>
                  </Stack.Item>
                </Stack>

                <Stack distribution="fillEvenly" wrap={false}>
                  <Stack.Item fill>
                    <Stack vertical spacing="extraTight">
                      <Text variant="headingMd" as="h3">Date</Text>
                      <Text variant="bodyMd" as="p">{formatDate(transaction.createdAt)}</Text>
                    </Stack>
                  </Stack.Item>
                  <Stack.Item fill>
                    <Stack vertical spacing="extraTight">
                      <Text variant="headingMd" as="h3">Balance After</Text>
                      <Text variant="bodyMd" as="p">{formatCurrency(transaction.balanceAfter)}</Text>
                    </Stack>
                  </Stack.Item>
                </Stack>

                {transaction.note && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="headingMd" as="h3">Note</Text>
                    <Text variant="bodyMd" as="p">{transaction.note}</Text>
                  </Stack>
                )}

                {transaction.staffId && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="headingMd" as="h3">Staff Member</Text>
                    <Text variant="bodyMd" as="p">{transaction.staffId}</Text>
                  </Stack>
                )}

                {transaction.locationId && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="headingMd" as="h3">Location</Text>
                    <Text variant="bodyMd" as="p">{transaction.locationId}</Text>
                  </Stack>
                )}

                {transaction.orderId && (
                  <Stack vertical spacing="extraTight">
                    <Text variant="headingMd" as="h3">Order Reference</Text>
                    <Stack alignment="center">
                      <Icon source={OrdersMajor} color="base" />
                      <Link url={`/orders/${transaction.orderId}`}>
                        View Order {transaction.orderId}
                      </Link>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Layout.Section>

          <Layout.Section secondary>
            <Card title="Related Information" sectioned>
              <Stack vertical spacing="loose">
                {transaction.creditId && (
                  <Stack vertical spacing="tight">
                    <Text variant="headingMd" as="h3">Credit</Text>
                    <Stack alignment="center">
                      <Icon source={TransactionMajor} color="base" />
                      <Link url={`/credits/${transaction.creditId}`}>
                        View Credit Details
                      </Link>
                    </Stack>
                  </Stack>
                )}

                {customer && (
                  <Stack vertical spacing="tight">
                    <Text variant="headingMd" as="h3">Customer</Text>
                    <Stack alignment="center" spacing="tight">
                      <Icon source={CustomersMajor} color="base" />
                      <Link url={`/customers/${customer.id}`}>
                        {customer.firstName} {customer.lastName}
                      </Link>
                    </Stack>
                    <Text variant="bodyMd" as="p">{customer.email}</Text>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Toast notification */}
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
} 