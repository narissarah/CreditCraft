import React, { useState, useEffect, useCallback } from 'react';
import { Page, Layout, PageActions, Button, Toast } from '@shopify/polaris';
import TransactionList from '../../components/transactions/TransactionList';
import TransactionFilters, { TransactionFilterValues } from '../../components/transactions/TransactionFilters';
import { Transaction } from '@prisma/client';
import { useNavigate } from 'react-router-dom';

const TransactionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilterValues>({});
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  const fetchTransactions = useCallback(
    async (page = 1) => {
      setIsLoading(true);

      try {
        // Prepare query parameters from filters and pagination
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: '10', // Set an appropriate limit
          ...(filters.type && { type: filters.type }),
          ...(filters.customerId && { customerId: filters.customerId }),
          ...(filters.creditId && { creditId: filters.creditId }),
          ...(filters.staffId && { staffId: filters.staffId }),
          ...(filters.locationId && { locationId: filters.locationId }),
          ...(filters.dateFrom && { dateFrom: filters.dateFrom.toISOString() }),
          ...(filters.dateTo && { dateTo: filters.dateTo.toISOString() }),
          ...(filters.orderId && { orderId: filters.orderId }),
        });

        const response = await fetch(`/api/transactions?${queryParams}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();

        if (data.success) {
          setTransactions(data.transactions);
          setTotalPages(data.pageCount);
          setCurrentPage(data.page);
        } else {
          throw new Error(data.error || 'Failed to fetch transactions');
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        showToast((error as Error).message, true);
      } finally {
        setIsLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  const handlePageChange = (page: number) => {
    fetchTransactions(page);
  };

  const handleFiltersChange = (newFilters: TransactionFilterValues) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setCurrentPage(1);
  };

  const handleExportClick = () => {
    // Prepare export URL with current filters
    const queryParams = new URLSearchParams({
      format: 'csv',
      ...(filters.type && { type: filters.type }),
      ...(filters.customerId && { customerId: filters.customerId }),
      ...(filters.creditId && { creditId: filters.creditId }),
      ...(filters.staffId && { staffId: filters.staffId }),
      ...(filters.locationId && { locationId: filters.locationId }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom.toISOString() }),
      ...(filters.dateTo && { dateTo: filters.dateTo.toISOString() }),
      ...(filters.orderId && { orderId: filters.orderId }),
    });

    window.open(`/api/transactions/export?${queryParams}`, '_blank');
  };

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const hideToast = () => {
    setToastActive(false);
  };

  return (
    <Page
      title="Transactions"
      subtitle="View and manage all credit transactions"
      primaryAction={{
        content: 'Dashboard',
        onAction: () => navigate('/transactions/dashboard'),
      }}
    >
      <Layout>
        <Layout.Section>
          <TransactionFilters onFiltersChange={handleFiltersChange} initialFilters={filters} />
        </Layout.Section>

        <Layout.Section>
          <TransactionList
            transactions={transactions}
            isLoading={isLoading}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </Layout.Section>

        <Layout.Section>
          <PageActions
            primaryAction={{
              content: 'Export',
              onAction: handleExportClick,
            }}
            secondaryActions={[
              {
                content: 'Refresh',
                onAction: () => fetchTransactions(currentPage),
              },
            ]}
          />
        </Layout.Section>
      </Layout>

      {toastActive && (
        <Toast content={toastMessage} error={toastError} onDismiss={hideToast} />
      )}
    </Page>
  );
};

export default TransactionListPage; 