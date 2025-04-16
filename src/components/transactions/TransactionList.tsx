import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  ResourceList,
  ResourceItem,
  Filters,
  Badge,
  Pagination,
  Spinner,
  Stack,
  EmptyState,
  Text,
  Button,
  ButtonGroup,
  Popover,
  ActionList,
  TextField,
  Icon,
  FilterInterface,
  Tag,
  Select,
  Avatar,
  TextStyle,
  Banner,
  Tooltip,
  useBreakpoints
} from '@shopify/polaris';
import { SearchMinor, FilterMinor, ExportMinor, SortMinor, InfoMinor } from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, SummaryCard } from '../common/AdminUIComponents';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useAPI } from '../../hooks/useAPI';
import { Transaction } from '../../types/credit';

const ITEMS_PER_PAGE = 20;

interface TransactionListProps {
  title?: string;
  showFilters?: boolean;
  showStats?: boolean;
  customerId?: string;
  creditId?: string;
  initialFilters?: {
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    staffId?: string;
    locationId?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  onFilterChange?: (filters: any) => void;
}

export default function TransactionList({
  title = 'Transactions',
  showFilters = true,
  showStats = true,
  customerId,
  creditId,
  initialFilters = {},
  onFilterChange
}: TransactionListProps) {
  const navigate = useNavigate();
  const api = useAPI();
  const { smUp, mdUp } = useBreakpoints();
  
  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isExportPopoverActive, setIsExportPopoverActive] = useState(false);
  const [isSortPopoverActive, setIsSortPopoverActive] = useState(false);
  
  // Stats summary data
  const [statsData, setStatsData] = useState({
    total: { value: 0, trend: 0 },
    issued: { value: 0, trend: 0 },
    redeemed: { value: 0, trend: 0 },
    adjusted: { value: 0, trend: 0 },
  });
  
  // Filters
  const [searchValue, setSearchValue] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<FilterInterface[]>([]);
  const [sorting, setSorting] = useState({ field: 'createdAt', direction: 'desc' });
  
  // Build query params from filters
  const buildQueryParams = useCallback(() => {
    const params: Record<string, string> = {
      page: currentPage.toString(),
      limit: ITEMS_PER_PAGE.toString(),
      sortBy: sorting.field,
      sortOrder: sorting.direction,
    };
    
    if (searchValue.trim()) {
      params.search = searchValue.trim();
    }
    
    if (customerId) {
      params.customerId = customerId;
    }
    
    if (creditId) {
      params.creditId = creditId;
    }
    
    // Add filters
    appliedFilters.forEach(filter => {
      switch (filter.key) {
        case 'type':
          params.type = filter.value as string;
          break;
        case 'dateFrom':
          params.dateFrom = filter.value as string;
          break;
        case 'dateTo':
          params.dateTo = filter.value as string;
          break;
        case 'staffId':
          params.staffId = filter.value as string;
          break;
        case 'locationId':
          params.locationId = filter.value as string;
          break;
        case 'minAmount':
          params.minAmount = filter.value as string;
          break;
        case 'maxAmount':
          params.maxAmount = filter.value as string;
          break;
      }
    });
    
    return params;
  }, [currentPage, searchValue, appliedFilters, sorting, customerId, creditId]);
  
  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = buildQueryParams();
      const response = await api.get('/transactions', { params });
      
      if (response.data.success) {
        setTransactions(response.data.transactions);
        setTotalPages(response.data.totalPages);
        setTotalTransactions(response.data.total);
      } else {
        setError(response.data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('There was an error loading transactions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [api, buildQueryParams]);
  
  // Fetch transaction stats
  const fetchStats = useCallback(async () => {
    if (!showStats) return;
    
    setStatsLoading(true);
    try {
      const params = buildQueryParams();
      // Remove pagination params for stats
      delete params.page;
      delete params.limit;
      
      const response = await api.get('/transactions/stats', { params });
      
      if (response.data.success) {
        setStatsData({
          total: { 
            value: response.data.stats.totalTransactions,
            trend: response.data.stats.totalTransactionsTrend
          },
          issued: { 
            value: response.data.stats.issuedAmount,
            trend: response.data.stats.issuedAmountTrend
          },
          redeemed: { 
            value: response.data.stats.redeemedAmount,
            trend: response.data.stats.redeemedAmountTrend
          },
          adjusted: { 
            value: response.data.stats.adjustedAmount,
            trend: response.data.stats.adjustedAmountTrend
          },
        });
      }
    } catch (err) {
      console.error('Error fetching transaction stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [api, showStats, buildQueryParams]);
  
  // Load data on component mount or when dependencies change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);
  
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  
  // Call onFilterChange prop when filters change
  useEffect(() => {
    if (onFilterChange) {
      const filterParams = buildQueryParams();
      onFilterChange(filterParams);
    }
  }, [appliedFilters, sorting, searchValue, onFilterChange, buildQueryParams]);
  
  // Initialize filters from props
  useEffect(() => {
    const newFilters: FilterInterface[] = [];
    
    if (initialFilters.type) {
      newFilters.push({
        key: 'type',
        label: 'Type',
        value: initialFilters.type
      });
    }
    
    if (initialFilters.dateFrom) {
      newFilters.push({
        key: 'dateFrom',
        label: 'From Date',
        value: initialFilters.dateFrom
      });
    }
    
    if (initialFilters.dateTo) {
      newFilters.push({
        key: 'dateTo',
        label: 'To Date',
        value: initialFilters.dateTo
      });
    }
    
    if (initialFilters.staffId) {
      newFilters.push({
        key: 'staffId',
        label: 'Staff',
        value: initialFilters.staffId
      });
    }
    
    if (initialFilters.locationId) {
      newFilters.push({
        key: 'locationId',
        label: 'Location',
        value: initialFilters.locationId
      });
    }
    
    if (initialFilters.minAmount) {
      newFilters.push({
        key: 'minAmount',
        label: 'Min Amount',
        value: initialFilters.minAmount.toString()
      });
    }
    
    if (initialFilters.maxAmount) {
      newFilters.push({
        key: 'maxAmount',
        label: 'Max Amount',
        value: initialFilters.maxAmount.toString()
      });
    }
    
    if (newFilters.length > 0) {
      setAppliedFilters(newFilters);
    }
  }, [initialFilters]);
  
  // Calculate transaction summary
  const transactionSummary = useMemo(() => {
    if (transactions.length === 0) return null;
    
    let issuedAmount = 0;
    let redeemedAmount = 0;
    let adjustedAmount = 0;
    
    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      switch(transaction.type.toUpperCase()) {
        case 'ISSUE':
          issuedAmount += amount;
          break;
        case 'REDEEM':
          redeemedAmount += amount;
          break;
        case 'ADJUST':
          adjustedAmount += amount;
          break;
      }
    });
    
    return {
      issuedAmount,
      redeemedAmount,
      adjustedAmount,
      netAmount: issuedAmount - redeemedAmount + adjustedAmount
    };
  }, [transactions]);
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
  };
  
  // Handle filter changes
  const handleFiltersChange = (filters: FilterInterface[]) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };
  
  // Handle row click
  const handleTransactionClick = (id: string) => {
    navigate(`/transactions/${id}`);
  };
  
  // Handle export click
  const toggleExportPopover = useCallback(() => {
    setIsExportPopoverActive(prev => !prev);
  }, []);
  
  // Toggle sort popover
  const toggleSortPopover = useCallback(() => {
    setIsSortPopoverActive(prev => !prev);
  }, []);
  
  // Export transactions
  const handleExport = useCallback(async (format: 'csv' | 'pdf') => {
    try {
      const params = buildQueryParams();
      params.format = format;
      
      const response = await api.get('/transactions/export', {
        params,
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions-export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setIsExportPopoverActive(false);
    } catch (err) {
      console.error(`Error exporting transactions as ${format}:`, err);
      setError(`Failed to export transactions as ${format}. Please try again.`);
    }
  }, [api, buildQueryParams]);
  
  // Sorting handler
  const handleSortChange = (field: string) => {
    setSorting(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
    setIsSortPopoverActive(false);
  };
  
  // Render type badge
  const renderTransactionTypeBadge = (type: string) => {
    let status = 'new';
    
    switch (type.toUpperCase()) {
      case 'ISSUE':
        status = 'success';
        break;
      case 'REDEEM':
        status = 'info';
        break;
      case 'ADJUST':
        status = 'attention';
        break;
      case 'CANCEL':
        status = 'critical';
        break;
      default:
        status = 'new';
    }
    
    return <StatusBadge status={status}>{type}</StatusBadge>;
  };
  
  // Render empty state
  const renderEmptyState = () => {
    return (
      <EmptyState
        heading="No transactions found"
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Try changing the filters or search term</p>
      </EmptyState>
    );
  };
  
  // Filter control
  const filters = [
    {
      key: 'type',
      label: 'Type',
      filter: (
        <Select
          label="Type"
          options={[
            { label: 'All types', value: '' },
            { label: 'Issue', value: 'ISSUE' },
            { label: 'Redeem', value: 'REDEEM' },
            { label: 'Adjust', value: 'ADJUST' },
            { label: 'Cancel', value: 'CANCEL' }
          ]}
          onChange={(value) => {
            const newFilters = appliedFilters.filter(filter => filter.key !== 'type');
            if (value) {
              newFilters.push({
                key: 'type',
                label: 'Type',
                value
              });
            }
            handleFiltersChange(newFilters);
          }}
          value={appliedFilters.find(filter => filter.key === 'type')?.value as string || ''}
        />
      ),
      shortcut: true,
    },
    {
      key: 'dateRange',
      label: 'Date range',
      filter: (
        <Stack vertical>
          <TextField
            label="From"
            type="date"
            value={appliedFilters.find(filter => filter.key === 'dateFrom')?.value as string || ''}
            onChange={(value) => {
              const newFilters = appliedFilters.filter(filter => filter.key !== 'dateFrom');
              if (value) {
                newFilters.push({
                  key: 'dateFrom',
                  label: 'From Date',
                  value
                });
              }
              handleFiltersChange(newFilters);
            }}
            autoComplete="off"
          />
          <TextField
            label="To"
            type="date"
            value={appliedFilters.find(filter => filter.key === 'dateTo')?.value as string || ''}
            onChange={(value) => {
              const newFilters = appliedFilters.filter(filter => filter.key !== 'dateTo');
              if (value) {
                newFilters.push({
                  key: 'dateTo',
                  label: 'To Date',
                  value
                });
              }
              handleFiltersChange(newFilters);
            }}
            autoComplete="off"
          />
        </Stack>
      ),
    },
    {
      key: 'amountRange',
      label: 'Amount range',
      filter: (
        <Stack vertical>
          <TextField
            label="Minimum amount"
            type="number"
            step="0.01"
            value={appliedFilters.find(filter => filter.key === 'minAmount')?.value as string || ''}
            onChange={(value) => {
              const newFilters = appliedFilters.filter(filter => filter.key !== 'minAmount');
              if (value) {
                newFilters.push({
                  key: 'minAmount',
                  label: 'Min Amount',
                  value
                });
              }
              handleFiltersChange(newFilters);
            }}
            autoComplete="off"
          />
          <TextField
            label="Maximum amount"
            type="number"
            step="0.01"
            value={appliedFilters.find(filter => filter.key === 'maxAmount')?.value as string || ''}
            onChange={(value) => {
              const newFilters = appliedFilters.filter(filter => filter.key !== 'maxAmount');
              if (value) {
                newFilters.push({
                  key: 'maxAmount',
                  label: 'Max Amount',
                  value
                });
              }
              handleFiltersChange(newFilters);
            }}
            autoComplete="off"
          />
        </Stack>
      ),
    },
  ];
  
  // Stats cards
  const renderStats = () => {
    if (!showStats) return null;
    
    return (
      <Stack distribution="fillEvenly">
        <SummaryCard
          title="Total Transactions"
          value={totalTransactions.toString()}
          loading={statsLoading}
          trend={statsData.total.trend}
          tooltip="Total number of transactions matching the current filters"
        />
        <SummaryCard
          title="Total Issued"
          value={formatCurrency(statsData.issued.value)}
          loading={statsLoading}
          trend={statsData.issued.trend}
          tooltip="Total amount of credits issued"
        />
        <SummaryCard
          title="Total Redeemed"
          value={formatCurrency(statsData.redeemed.value)}
          loading={statsLoading}
          trend={statsData.redeemed.trend}
          tooltip="Total amount of credits redeemed"
        />
        <SummaryCard
          title="Net Adjustments"
          value={formatCurrency(statsData.adjusted.value)}
          loading={statsLoading}
          trend={statsData.adjusted.trend}
          tooltip="Net sum of all credit adjustments"
        />
      </Stack>
    );
  };
  
  // Render transaction summary for current page
  const renderPageSummary = () => {
    if (!transactionSummary || transactions.length === 0) return null;
    
    return (
      <Card.Section>
        <Stack alignment="center">
          <Stack.Item>
            <Text variant="bodyMd" fontWeight="semibold">Page Summary:</Text>
          </Stack.Item>
          <Stack.Item>
            <TextStyle variation="positive">
              Issued: {formatCurrency(transactionSummary.issuedAmount)}
            </TextStyle>
          </Stack.Item>
          <Stack.Item>
            <TextStyle variation="subdued">
              Redeemed: {formatCurrency(transactionSummary.redeemedAmount)}
            </TextStyle>
          </Stack.Item>
          <Stack.Item>
            <TextStyle variation={transactionSummary.adjustedAmount >= 0 ? "positive" : "negative"}>
              Adjusted: {formatCurrency(transactionSummary.adjustedAmount)}
            </TextStyle>
          </Stack.Item>
          <Stack.Item fill>
            <TextStyle variation={transactionSummary.netAmount >= 0 ? "positive" : "negative"}>
              Net: {formatCurrency(transactionSummary.netAmount)}
            </TextStyle>
          </Stack.Item>
          
          <Stack.Item>
            <Tooltip content="Summary of transactions on this page only">
              <span>
                <Icon source={InfoMinor} color="base" />
              </span>
            </Tooltip>
          </Stack.Item>
        </Stack>
      </Card.Section>
    );
  };
  
  // Actions menu
  const renderActions = () => {
    const exportButton = (
      <Popover
        active={isExportPopoverActive}
        activator={
          <Button 
            icon={ExportMinor} 
            onClick={toggleExportPopover}
            disabled={transactions.length === 0}
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
    
    const sortButton = (
      <Popover
        active={isSortPopoverActive}
        activator={
          <Button
            icon={SortMinor}
            onClick={toggleSortPopover}
          >
            Sort
          </Button>
        }
        onClose={toggleSortPopover}
      >
        <ActionList
          items={[
            {
              content: 'Date (Newest first)',
              onAction: () => handleSortChange('createdAt'),
              active: sorting.field === 'createdAt' && sorting.direction === 'desc'
            },
            {
              content: 'Date (Oldest first)',
              onAction: () => handleSortChange('createdAt'),
              active: sorting.field === 'createdAt' && sorting.direction === 'asc'
            },
            {
              content: 'Amount (Highest first)',
              onAction: () => handleSortChange('amount'),
              active: sorting.field === 'amount' && sorting.direction === 'desc'
            },
            {
              content: 'Amount (Lowest first)',
              onAction: () => handleSortChange('amount'),
              active: sorting.field === 'amount' && sorting.direction === 'asc'
            },
          ]}
        />
      </Popover>
    );
    
    return (
      <ButtonGroup>
        {sortButton}
        {exportButton}
        <Button
          primary
          url="/reports/transactions"
        >
          Detailed Reports
        </Button>
      </ButtonGroup>
    );
  };
  
  return (
    <Card>
      <Card.Section>
        <Stack alignment="center" distribution="equalSpacing">
          <Stack.Item>
            <Text variant="headingLg" as="h3">{title}</Text>
          </Stack.Item>
          {showFilters && mdUp && (
            <Stack.Item>
              {renderActions()}
            </Stack.Item>
          )}
        </Stack>
      </Card.Section>
      
      {showStats && (
        <Card.Section>
          {renderStats()}
        </Card.Section>
      )}
      
      {showFilters && (
        <Card.Section>
          <Filters
            queryValue={searchValue}
            filters={filters}
            appliedFilters={appliedFilters}
            onQueryChange={handleSearchChange}
            onQueryClear={() => setSearchValue('')}
            onClearAll={() => {
              setSearchValue('');
              setAppliedFilters([]);
            }}
            onFiltersChange={handleFiltersChange}
          />
        </Card.Section>
      )}
      
      {showFilters && !mdUp && (
        <Card.Section>
          <Stack alignment="center" distribution="center">
            {renderActions()}
          </Stack>
        </Card.Section>
      )}
      
      {renderPageSummary()}
      
      <Card.Section>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size="large" />
          </div>
        ) : error ? (
          <Banner status="critical">{error}</Banner>
        ) : transactions.length === 0 ? (
          renderEmptyState()
        ) : (
          <ResourceList
            resourceName={{ singular: 'transaction', plural: 'transactions' }}
            items={transactions}
            renderItem={(transaction) => (
              <ResourceItem
                id={transaction.id}
                onClick={() => handleTransactionClick(transaction.id)}
                shortcutActions={[
                  {
                    content: 'View details',
                    accessibilityLabel: `View details for transaction ${transaction.id}`,
                    url: `/transactions/${transaction.id}`,
                  },
                ]}
              >
                <Stack alignment="center">
                  <Stack.Item fill>
                    <Stack vertical spacing="tight">
                      <Stack>
                        <Text variant="bodyMd" fontWeight="bold">
                          Transaction {transaction.id.substring(0, 8)}
                        </Text>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {renderTransactionTypeBadge(transaction.type)}
                        </span>
                      </Stack>
                      <Text variant="bodyMd" color="subdued">
                        {formatDate(transaction.createdAt)}
                        {transaction.note && ` • ${transaction.note}`}
                      </Text>
                    </Stack>
                  </Stack.Item>
                  
                  <Stack.Item>
                    <Text variant="bodyMd" fontWeight="bold">
                      {transaction.type === 'REDEEM' ? '-' : ''}
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </Stack.Item>
                </Stack>
              </ResourceItem>
            )}
          />
        )}
      </Card.Section>
      
      {totalPages > 1 && (
        <Card.Section>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Pagination
              hasPrevious={currentPage > 1}
              onPrevious={() => handlePageChange(currentPage - 1)}
              hasNext={currentPage < totalPages}
              onNext={() => handlePageChange(currentPage + 1)}
            />
          </div>
        </Card.Section>
      )}
    </Card>
  );
} 