import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Page,
  Card,
  Tabs,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  Avatar,
  Filters,
  Button,
  ButtonGroup,
  Pagination,
  EmptyState,
  Loading,
  Stack,
  Frame,
  Toast,
  Banner,
  LegacyCard
} from '@shopify/polaris';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks/useAPI';
import { CreditType, CreditFilterParams } from '../types/credit';

export default function Credits() {
  const api = useAPI();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CreditType[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Toast
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  // Pagination
  const currentPage = parseInt(searchParams.get('page') || '1');
  const itemsPerPage = parseInt(searchParams.get('limit') || '10');

  // Filters
  const statusFilter = searchParams.get('status') || '';
  const customerId = searchParams.get('customerId') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  
  // Tabs
  const selectedTabIndex = (() => {
    const tab = searchParams.get('tab') || 'all';
    switch (tab) {
      case 'active': return 1;
      case 'used': return 2;
      case 'expired': return 3;
      case 'voided': return 4;
      default: return 0;
    }
  })();

  // Tab options
  const tabs = [
    {
      id: 'all',
      content: 'All Credits',
      accessibilityLabel: 'All credits',
      panelID: 'all-credits-content',
    },
    {
      id: 'active',
      content: 'Active',
      accessibilityLabel: 'Active credits',
      panelID: 'active-credits-content',
    },
    {
      id: 'used',
      content: 'Used',
      accessibilityLabel: 'Used credits',
      panelID: 'used-credits-content',
    },
    {
      id: 'expired',
      content: 'Expired',
      accessibilityLabel: 'Expired credits',
      panelID: 'expired-credits-content',
    },
    {
      id: 'voided',
      content: 'Voided',
      accessibilityLabel: 'Voided credits',
      panelID: 'voided-credits-content',
    },
  ];

  // Fetch credits based on filters and pagination
  const fetchCredits = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const tabStatusMap: Record<number, string> = {
        1: 'ACTIVE',
        2: 'USED',
        3: 'EXPIRED',
        4: 'VOIDED'
      };
      
      // Build query params
      const params: CreditFilterParams = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder
      };
      
      // Add status filter based on tab or explicit filter
      if (selectedTabIndex > 0) {
        params.status = tabStatusMap[selectedTabIndex];
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      
      // Add customer filter if present
      if (customerId) {
        params.customerId = customerId;
      }
      
      // Add search term if present
      if (search) {
        params.search = search;
      }
      
      // Fetch credits with params
      const response = await api.get('/api/credits', { params });
      const { data, meta } = response.data;
      
      setCredits(data);
      setTotalItems(meta.total);
    } catch (err) {
      console.error('Error fetching credits:', err);
      setError('Failed to load credits. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    api, 
    currentPage, 
    itemsPerPage, 
    selectedTabIndex, 
    statusFilter, 
    customerId, 
    search, 
    sortBy, 
    sortOrder
  ]);

  // Load data when dependencies change
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle tab change
  const handleTabChange = useCallback((selectedTabIndex: number) => {
    const newParams = new URLSearchParams(searchParams);
    const tabId = tabs[selectedTabIndex].id;
    newParams.set('tab', tabId);
    newParams.delete('status'); // Remove explicit status filter when changing tabs
    newParams.set('page', '1'); // Reset to first page
    setSearchParams(newParams);
  }, [searchParams, setSearchParams, tabs]);

  // Handle search query
  const handleSearchChange = useCallback((value: string) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (value) {
      newParams.set('search', value);
    } else {
      newParams.delete('search');
    }
    
    newParams.set('page', '1'); // Reset to first page
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Handle clear all filters
  const handleClearFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    newParams.set('page', '1');
    newParams.set('limit', itemsPerPage.toString());
    setSearchParams(newParams);
  }, [itemsPerPage, setSearchParams]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (value) {
      newParams.set(filter, value);
    } else {
      newParams.delete(filter);
    }
    
    newParams.set('page', '1'); // Reset to first page
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Format functions for display
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, 'success' | 'info' | 'warning' | 'critical'> = {
      ACTIVE: 'success',
      USED: 'info',
      EXPIRED: 'warning',
      VOIDED: 'critical'
    };
    
    return <Badge status={statusMap[status] || 'default'}>{status}</Badge>;
  };

  // Resource list item renderer
  const renderItem = (item: CreditType) => {
    const balance = item.balance || 0;
    const amount = item.amount || 0;
    const status = item.status || 'UNKNOWN';
    const expirationDate = item.expirationDate ? formatDate(item.expirationDate) : 'No expiration';
    
    return (
      <ResourceItem
        id={item.id}
        onClick={() => navigate(`/credits/${item.id}`)}
        shortcutActions={[
          {
            content: 'View',
            url: `/credits/${item.id}`
          }
        ]}
        persistActions
        media={
          <Avatar size="medium" initials={item.code.substring(0, 2)} />
        }
      >
        <Stack alignment="center">
          <Stack.Item fill>
            <Stack vertical spacing="extraTight">
              <Text variant="bodyMd" fontWeight="bold">
                {item.code}
              </Text>
              <Stack>
                <Text variant="bodyMd">Balance: {formatCurrency(balance)}</Text>
                <Text variant="bodyMd" color="subdued">Amount: {formatCurrency(amount)}</Text>
              </Stack>
            </Stack>
          </Stack.Item>

          <Stack vertical spacing="tight" alignment="trailing">
            <Stack spacing="tight">
              {getStatusBadge(status)}
              <Text variant="bodyMd" color="subdued">Expires: {expirationDate}</Text>
            </Stack>
          </Stack>
        </Stack>
      </ResourceItem>
    );
  };

  // Filter configuration
  const filters = [
    {
      key: 'statusFilter',
      label: 'Status',
      filter: (
        <Filters.Select
          label="Status"
          options={[
            { label: 'Any status', value: '' },
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Used', value: 'USED' },
            { label: 'Expired', value: 'EXPIRED' },
            { label: 'Voided', value: 'VOIDED' }
          ]}
          onChange={(value) => handleFilterChange('status', value)}
          value={statusFilter}
        />
      ),
      shortcut: true,
    },
    {
      key: 'sortByFilter',
      label: 'Sort by',
      filter: (
        <Filters.Select
          label="Sort by"
          options={[
            { label: 'Created (newest)', value: 'createdAt-desc' },
            { label: 'Created (oldest)', value: 'createdAt-asc' },
            { label: 'Amount (highest)', value: 'amount-desc' },
            { label: 'Amount (lowest)', value: 'amount-asc' },
            { label: 'Balance (highest)', value: 'balance-desc' },
            { label: 'Balance (lowest)', value: 'balance-asc' },
            { label: 'Expiration (soonest)', value: 'expirationDate-asc' },
            { label: 'Expiration (latest)', value: 'expirationDate-desc' },
          ]}
          onChange={(value) => {
            const [sortBy, sortOrder] = value.split('-');
            handleFilterChange('sortBy', sortBy);
            handleFilterChange('sortOrder', sortOrder);
          }}
          value={`${sortBy}-${sortOrder}`}
        />
      ),
    },
  ];

  // Toast handlers
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);

  // Resource list empty state
  const emptyStateMarkup = (
    <EmptyState
      heading="No credits found"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      action={{
        content: 'Create credit',
        onAction: () => navigate('/credits/new')
      }}
    >
      <p>No credits match the current filters. Try changing the filters or create a new credit.</p>
    </EmptyState>
  );

  // Resource list loading state
  const loadingStateMarkup = (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
      <Loading />
    </div>
  );

  // Create ResourceList with appropriate markup based on state
  const resourceListMarkup = useMemo(() => {
    if (loading) {
      return loadingStateMarkup;
    }
    
    return (
      <ResourceList
        resourceName={{ singular: 'credit', plural: 'credits' }}
        items={credits}
        renderItem={renderItem}
        emptyState={emptyStateMarkup}
        alternateTool={
          <ButtonGroup>
            <Button primary onClick={() => navigate('/credits/new')}>
              Create credit
            </Button>
          </ButtonGroup>
        }
        filterControl={
          <Filters
            queryValue={search}
            filters={filters}
            onQueryChange={handleSearchChange}
            onQueryClear={() => handleSearchChange('')}
            onClearAll={handleClearFilters}
            appliedFilters={
              statusFilter || customerId || (sortBy !== 'createdAt' || sortOrder !== 'desc')
                ? [
                    ...(statusFilter
                      ? [
                          {
                            key: 'status',
                            label: `Status: ${statusFilter}`,
                            onRemove: () => handleFilterChange('status', ''),
                          },
                        ]
                      : []),
                    ...(customerId
                      ? [
                          {
                            key: 'customer',
                            label: `Customer: ${customerId}`,
                            onRemove: () => handleFilterChange('customerId', ''),
                          },
                        ]
                      : []),
                    ...(sortBy !== 'createdAt' || sortOrder !== 'desc'
                      ? [
                          {
                            key: 'sort',
                            label: `Sorted by: ${sortBy}`,
                            onRemove: () => {
                              handleFilterChange('sortBy', 'createdAt');
                              handleFilterChange('sortOrder', 'desc');
                            },
                          },
                        ]
                      : []),
                  ]
                : []
            }
          />
        }
      />
    );
  }, [
    loading, 
    credits, 
    search, 
    filters, 
    statusFilter, 
    customerId, 
    sortBy, 
    sortOrder, 
    navigate, 
    handleSearchChange, 
    handleFilterChange, 
    handleClearFilters
  ]);

  return (
    <Frame>
      <Page 
        title="Store Credits" 
        subtitle={`${totalItems} total credits`}
        primaryAction={{
          content: 'Create credit',
          onAction: () => navigate('/credits/new')
        }}
      >
        {error && (
          <Banner
            title="Error loading credits"
            status="critical"
            action={{ content: 'Try again', onAction: fetchCredits }}
          >
            <p>{error}</p>
          </Banner>
        )}
        
        <Card>
          <Tabs
            tabs={tabs}
            selected={selectedTabIndex}
            onSelect={handleTabChange}
          />
          
          <LegacyCard.Section>
            {resourceListMarkup}
          </LegacyCard.Section>
          
          <Card.Section>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Pagination
                hasPrevious={currentPage > 1}
                onPrevious={() => handlePageChange(currentPage - 1)}
                hasNext={currentPage * itemsPerPage < totalItems}
                onNext={() => handlePageChange(currentPage + 1)}
              />
            </div>
          </Card.Section>
        </Card>

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