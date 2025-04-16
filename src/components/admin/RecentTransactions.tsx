import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  ResourceList, 
  ResourceItem, 
  TextStyle, 
  Stack, 
  Badge, 
  Button, 
  Pagination,
  TextContainer,
  SkeletonBodyText
} from '@shopify/polaris';
import { useShopifyBridge } from '../../hooks/useAppBridge';
import { StatusBadge } from '../common/AdminUIComponents';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface Transaction {
  id: string;
  type: 'issue' | 'redeem' | 'expire' | 'adjust' | 'cancel';
  amount: number;
  customerName: string;
  customerId: string;
  creditId: string;
  createdAt: string;
  location: string;
  staff?: string;
}

export const RecentTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const { authenticatedFetch, redirect } = useShopifyBridge();

  const pageSize = 5; // Number of transactions per page

  const fetchTransactions = useCallback(async (page: number) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`/api/transactions/recent?page=${page}&limit=${pageSize}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }

      const data = await response.json();
      setTransactions(data.transactions);
      setHasNextPage(data.pagination.hasNext);
      setHasPreviousPage(data.pagination.hasPrevious);
      setError(null);
    } catch (err) {
      console.error('Error fetching recent transactions:', err);
      setError('Failed to load recent transactions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchTransactions(currentPage);
  }, [fetchTransactions, currentPage]);

  const handleNextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const handlePreviousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPreviousPage]);

  const getTransactionTypeLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'issue':
        return 'Issued';
      case 'redeem':
        return 'Redeemed';
      case 'expire':
        return 'Expired';
      case 'adjust':
        return 'Adjusted';
      case 'cancel':
        return 'Cancelled';
      default:
        return type;
    }
  };

  const getTransactionStatus = (type: Transaction['type']) => {
    switch (type) {
      case 'issue':
        return 'success';
      case 'redeem':
        return 'info';
      case 'expire':
        return 'warning';
      case 'adjust':
        return 'attention';
      case 'cancel':
        return 'critical';
      default:
        return 'new';
    }
  };

  const handleViewTransaction = useCallback((id: string) => {
    redirect(`/admin/transactions/${id}`);
  }, [redirect]);

  const handleViewCustomer = useCallback((id: string) => {
    redirect(`/admin/customers/${id}`);
  }, [redirect]);

  const handleViewCredit = useCallback((id: string) => {
    redirect(`/admin/credits/${id}`);
  }, [redirect]);

  if (error) {
    return (
      <Card title="Recent Transactions">
        <Card.Section>
          <TextContainer>
            <p>{error}</p>
          </TextContainer>
        </Card.Section>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card title="Recent Transactions">
        <Card.Section>
          <SkeletonBodyText lines={5} />
        </Card.Section>
      </Card>
    );
  }

  return (
    <Card title="Recent Transactions">
      <ResourceList
        resourceName={{ singular: 'transaction', plural: 'transactions' }}
        items={transactions}
        renderItem={(transaction) => (
          <ResourceItem
            id={transaction.id}
            onClick={() => handleViewTransaction(transaction.id)}
            shortcutActions={[
              {
                content: 'View Customer',
                accessibilityLabel: `View ${transaction.customerName}`,
                onClick: (e) => {
                  e.stopPropagation();
                  handleViewCustomer(transaction.customerId);
                },
              },
              {
                content: 'View Credit',
                accessibilityLabel: `View credit ${transaction.creditId}`,
                onClick: (e) => {
                  e.stopPropagation();
                  handleViewCredit(transaction.creditId);
                },
              },
            ]}
          >
            <Stack>
              <Stack.Item fill>
                <h3>
                  <TextStyle variation="strong">
                    {transaction.customerName}
                  </TextStyle>
                </h3>
                <div>{formatDate(new Date(transaction.createdAt))}</div>
              </Stack.Item>
              <Stack.Item>
                <StatusBadge
                  status={getTransactionStatus(transaction.type)}
                  text={getTransactionTypeLabel(transaction.type)}
                />
              </Stack.Item>
              <Stack.Item>
                <TextStyle variation={transaction.type === 'issue' ? 'positive' : transaction.type === 'redeem' ? 'negative' : 'subdued'}>
                  {formatCurrency(transaction.amount)}
                </TextStyle>
              </Stack.Item>
            </Stack>
          </ResourceItem>
        )}
      />
      <Card.Section>
        <div style={{ textAlign: 'center' }}>
          <Pagination
            hasPrevious={hasPreviousPage}
            onPrevious={handlePreviousPage}
            hasNext={hasNextPage}
            onNext={handleNextPage}
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Button onClick={() => redirect('/admin/transactions')}>
            View All Transactions
          </Button>
        </div>
      </Card.Section>
    </Card>
  );
}; 