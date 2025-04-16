import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  Filters,
  DataTable,
  Button,
  ButtonGroup,
  Pagination,
  Badge,
  Frame,
  Toast,
  EmptyState,
  Spinner,
  Icon,
  Text,
  Stack,
  ResourceList,
  Avatar,
  Popover,
  ActionList,
  TextField,
  DatePicker,
  Box,
} from '@shopify/polaris';
import {
  TransactionMajor,
  FilterMajor,
  SortMinor,
  CircleAlertMajor,
  CircleTickMajor,
  ExportMinor,
  CustomersMajor
} from '@shopify/polaris-icons';
import { useAPI } from '../hooks/useAPI';
import { Transaction } from '../types/credit';

interface TransactionsAPIResponse {
  transactions: Transaction[];
  totalCount: number;
  pageCount: number;
}

interface TransactionFilters {
  type?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  creditId?: string;
  minAmount?: number;
  maxAmount?: number;
  locationId?: string;
  staffId?: string;
}

export default function Transactions() {
  const navigate = useNavigate();
  const api = useAPI();
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filters
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [filterQueryValue, setFilterQueryValue] = useState('');
  
  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  
  // Filter popover
  const [filterPopoverActive, setFilterPopoverActive] = useState(false);
  
  // Date picker state
  const [{ month, year }, setDate] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [selectedDates, setSelectedDates] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)), // default to last 30 days
    end: new Date(),
  });
  
  // Fetch transaction data
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: rowsPerPage.toString(),
        sortBy,
        sortOrder: sortDirection,
      });
      
      // Add filters to query params
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.customerId) queryParams.append('customerId', filters.customerId);
      if (filters.creditId) queryParams.append('creditId', filters.creditId);
      if (filters.minAmount) queryParams.append('minAmount', filters.minAmount.toString());
      if (filters.maxAmount) queryParams.append('maxAmount', filters.maxAmount.toString());
      if (filters.locationId) queryParams.append('locationId', filters.locationId);
      if (filters.staffId) queryParams.append('staffId', filters.staffId);
      if (filterQueryValue) queryParams.append('search', filterQueryValue);
      
      const response = await api.get<TransactionsAPIResponse>(`/api/transactions?${queryParams.toString()}`);
      
      setTransactions(response.data.transactions);
      setTotalCount(response.data.totalCount);
      setPageCount(response.data.pageCount);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, currentPage, rowsPerPage, sortBy, sortDirection, filters, filterQueryValue]);
  
  // Load data on initial load and when dependencies change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);
  
  // Update date filters when date range changes
  useEffect(() => {
    if (selectedDates.start && selectedDates.end) {
      setFilters(prev => ({
        ...prev,
        startDate: selectedDates.start.toISOString().split('T')[0],
        endDate: selectedDates.end.toISOString().split('T')[0],
      }));
    }
  }, [selectedDates]);
  
  // Formatters
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
  
  // Handle pagination change
  const handlePaginationChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);
  
  // Handle sort change
  const handleSortChange = useCallback((headingIndex: number) => {
    const columns = ['id', 'type', 'amount', 'balanceAfter', 'createdAt', 'creditId', 'customerId'];
    const column = columns[headingIndex];
    
    if (column) {
      if (sortBy === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(column);
        setSortDirection('desc');
      }
    }
  }, [sortBy, sortDirection]);
  
  // Handle rows per page change
  const handleRowsPerPageChange = useCallback((value: string) => {
    setRowsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  }, []);
  
  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    setFilterQueryValue('');
    setSelectedDates({
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date(),
    });
  }, []);
  
  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof TransactionFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);
  
  // Handle date range change
  const handleDateChange = useCallback(({ start, end }: { start: Date, end: Date }) => {
    setSelectedDates({ start, end });
  }, []);
  
  // Export transactions
  const handleExportTransactions = useCallback(async () => {
    try {
      // Create query params with current filters
      const queryParams = new URLSearchParams();
      
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.customerId) queryParams.append('customerId', filters.customerId);
      if (filters.creditId) queryParams.append('creditId', filters.creditId);
      if (filters.minAmount) queryParams.append('minAmount', filters.minAmount.toString());
      if (filters.maxAmount) queryParams.append('maxAmount', filters.maxAmount.toString());
      if (filters.locationId) queryParams.append('locationId', filters.locationId);
      if (filters.staffId) queryParams.append('staffId', filters.staffId);
      if (filterQueryValue) queryParams.append('search', filterQueryValue);
      
      // Add export format
      queryParams.append('format', 'csv');
      
      // Trigger download
      const response = await api.get(`/api/transactions/export?${queryParams.toString()}`, {
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const currentDate = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `transactions-export-${currentDate}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      // Show success toast
      setToastMessage('Transactions exported successfully');
      setToastError(false);
      setToastActive(true);
    } catch (err) {
      console.error('Error exporting transactions:', err);
      setToastMessage('Failed to export transactions');
      setToastError(true);
      setToastActive(true);
    }
  }, [api, filters, filterQueryValue]);
  
  // Toast handler
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);
  
  // Prepare table rows
  const rows = useMemo(() => {
    return transactions.map(transaction => [
      <Button 
        plain 
        monochrome 
        removeUnderline 
        onClick={() => navigate(`/transactions/${transaction.id}`)}
      >
        {transaction.id.substring(0, 8)}...
      </Button>,
      getTransactionBadge(transaction.type),
      <Text fontWeight={transaction.amount > 0 ? 'bold' : 'regular'} color={transaction.amount > 0 ? 'success' : 'critical'}>
        {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
      </Text>,
      formatCurrency(transaction.balanceAfter),
      formatDate(transaction.createdAt),
      transaction.creditId ? (
        <Button 
          plain 
          monochrome 
          removeUnderline 
          onClick={() => navigate(`/credits/${transaction.creditId}`)}
        >
          {transaction.creditId.substring(0, 8)}...
        </Button>
      ) : '-',
      transaction.customerId ? (
        <Stack alignment="center" spacing="tight">
          <Icon source={CustomersMajor} color="base" />
          <Button 
            plain 
            monochrome 
            removeUnderline 
            onClick={() => transaction.customerId && navigate(`/customers/${transaction.customerId}`)}
          >
            {transaction.customerId.substring(0, 8)}...
          </Button>
        </Stack>
      ) : '-',
    ]);
  }, [transactions, navigate]);
  
  return (
    <Frame>
      <Page 
        title="Transactions"
        subtitle="View and manage credit transactions"
        primaryAction={{
          content: 'Export',
          icon: ExportMinor,
          onAction: handleExportTransactions,
          disabled: loading || transactions.length === 0
        }}
      >
        {/* Filters */}
        <Card>
          <Card.Section>
            <Filters
              queryValue={filterQueryValue}
              filters={[
                {
                  key: 'type',
                  label: 'Transaction Type',
                  filter: (
                    <Popover
                      active={filterPopoverActive}
                      activator={
                        <Button 
                          disclosure 
                          onClick={() => setFilterPopoverActive(!filterPopoverActive)}
                        >
                          {filters.type || 'All Types'}
                        </Button>
                      }
                      onClose={() => setFilterPopoverActive(false)}
                    >
                      <ActionList
                        items={[
                          { content: 'All Types', onAction: () => handleFilterChange('type', '') },
                          { content: 'Issue', onAction: () => handleFilterChange('type', 'ISSUE') },
                          { content: 'Redemption', onAction: () => handleFilterChange('type', 'REDEMPTION') },
                          { content: 'Adjustment', onAction: () => handleFilterChange('type', 'ADJUSTMENT') },
                          { content: 'Void', onAction: () => handleFilterChange('type', 'VOID') },
                        ]}
                      />
                    </Popover>
                  ),
                  shortcut: true,
                },
                {
                  key: 'date',
                  label: 'Date Range',
                  filter: (
                    <Popover
                      active={false}
                      activator={
                        <Button disclosure>
                          {filters.startDate && filters.endDate
                            ? `${filters.startDate} - ${filters.endDate}`
                            : 'Select Date Range'}
                        </Button>
                      }
                      onClose={() => {}}
                    >
                      <Popover.Pane>
                        <DatePicker
                          month={month}
                          year={year}
                          onChange={handleDateChange}
                          onMonthChange={(month, year) => setDate({ month, year })}
                          selected={selectedDates}
                          allowRange
                        />
                      </Popover.Pane>
                    </Popover>
                  ),
                  shortcut: true,
                },
              ]}
              onQueryChange={setFilterQueryValue}
              onQueryClear={() => setFilterQueryValue('')}
              onClearAll={handleClearFilters}
              queryPlaceholder="Search by transaction ID, note, or customer name"
            />
          </Card.Section>
          
          {/* Transactions Table */}
          <DataTable
            columnContentTypes={[
              'text',
              'text',
              'numeric',
              'numeric',
              'text',
              'text',
              'text',
            ]}
            headings={[
              'ID',
              'Type',
              'Amount',
              'Balance After',
              'Date',
              'Credit ID',
              'Customer',
            ]}
            rows={rows}
            sortable={[true, true, true, true, true, true, true]}
            defaultSortDirection="descending"
            initialSortColumnIndex={4}
            onSort={handleSortChange}
            footerContent={
              totalCount ? `Showing ${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, totalCount)} of ${totalCount} transactions` : null
            }
            verticalAlign="top"
            loading={loading}
            emptyState={
              <EmptyState
                heading="No transactions found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  {filterQueryValue || Object.values(filters).some(Boolean) 
                    ? "Try changing the filters or search terms" 
                    : "No transactions have been recorded yet"}
                </p>
              </EmptyState>
            }
          />
          
          {/* Pagination */}
          {!loading && transactions.length > 0 && (
            <Card.Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text>Rows per page:</Text>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => handleRowsPerPageChange(e.target.value)}
                    style={{ marginLeft: '8px' }}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                
                <Pagination
                  hasPrevious={currentPage > 1}
                  onPrevious={() => handlePaginationChange(currentPage - 1)}
                  hasNext={currentPage < pageCount}
                  onNext={() => handlePaginationChange(currentPage + 1)}
                />
              </div>
            </Card.Section>
          )}
        </Card>
        
        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size="large" color="teal" />
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <Box paddingBlockStart="4">
            <Card>
              <Card.Section>
                <Banner
                  title="Error loading transactions"
                  status="critical"
                  action={{ content: 'Try again', onAction: fetchTransactions }}
                >
                  <p>{error}</p>
                </Banner>
              </Card.Section>
            </Card>
          </Box>
        )}
        
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