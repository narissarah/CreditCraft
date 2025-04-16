import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  ResourceList,
  ResourceItem,
  TextStyle,
  Pagination,
  Avatar,
  Filters,
  FilterInterface,
  Button,
  Spinner,
  EmptyState,
  Badge,
  Stack,
  ButtonGroup,
  Text,
  TextField,
  Toast,
  Frame
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, SummaryCard } from '../common/AdminUIComponents';
import { formatDate } from '../../utils/formatters';
import { CustomerType, CustomerStats, CustomerImportResult } from '../../types/customer';
import CustomerImport from './CustomerImport';

const ITEMS_PER_PAGE = 20;

interface CustomerListProps {
  title?: string;
  showFilters?: boolean;
  showStats?: boolean;
  initialFilters?: {
    status?: string;
    search?: string;
    tag?: string;
    hasCreditBalance?: boolean;
  };
}

export default function CustomerList({
  title = 'Customers',
  showFilters = true,
  showStats = true,
  initialFilters = {}
}: CustomerListProps) {
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters state
  const [searchValue, setSearchValue] = useState(initialFilters.search || '');
  const [appliedFilters, setAppliedFilters] = useState<FilterInterface[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeToast, setActiveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Filter handler
  const handleFiltersChange = useCallback((appliedFilters: FilterInterface[]) => {
    setAppliedFilters(appliedFilters);
  }, []);

  // Build query parameters from filters
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    // Add pagination
    params.append('page', currentPage.toString());
    params.append('limit', ITEMS_PER_PAGE.toString());
    
    // Add search
    if (searchValue.trim()) {
      params.append('search', searchValue.trim());
    }
    
    // Add filters
    appliedFilters.forEach(filter => {
      switch (filter.key) {
        case 'status':
          params.append('status', filter.value as string);
          break;
        case 'tag':
          params.append('tag', filter.value as string);
          break;
        case 'hasCreditBalance':
          params.append('hasCreditBalance', filter.value === 'yes' ? 'true' : 'false');
          break;
      }
    });
    
    return params.toString();
  }, [currentPage, searchValue, appliedFilters]);

  // Fetch customers data
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const queryParams = buildQueryParams();
      const response = await fetch(`/api/customers?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      
      const data = await response.json();
      setCustomers(data.customers);
      setTotalCustomers(data.total);
      setTotalPages(data.totalPages);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('There was an error loading customers. Please try again.');
      setIsLoading(false);
    }
  }, [buildQueryParams]);

  // Fetch customer stats
  const fetchStats = useCallback(async () => {
    if (!showStats) return;
    
    setStatsLoading(true);
    
    try {
      const response = await fetch('/api/customers/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer stats');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching customer stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [showStats]);

  // Load data when component mounts or filters change
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Load stats when component mounts
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Initialize filters from props
  useEffect(() => {
    const newFilters: FilterInterface[] = [];
    
    if (initialFilters.status) {
      newFilters.push({
        key: 'status',
        label: 'Status',
        value: initialFilters.status
      });
    }
    
    if (initialFilters.tag) {
      newFilters.push({
        key: 'tag',
        label: 'Tag',
        value: initialFilters.tag
      });
    }
    
    if (initialFilters.hasCreditBalance !== undefined) {
      newFilters.push({
        key: 'hasCreditBalance',
        label: 'Has Credit Balance',
        value: initialFilters.hasCreditBalance ? 'yes' : 'no'
      });
    }
    
    if (newFilters.length > 0) {
      setAppliedFilters(newFilters);
    }
    
    if (initialFilters.search) {
      setSearchValue(initialFilters.search);
    }
  }, [initialFilters]);

  // Handle row click
  const handleCustomerClick = useCallback((customerId: string) => {
    navigate(`/customers/${customerId}`);
  }, [navigate]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  // Handle selection change
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedCustomers(selectedIds);
  }, []);
  
  // Handle search submit
  const handleSearchSubmit = useCallback(() => {
    setCurrentPage(1); // Reset to first page
    fetchCustomers();
  }, [fetchCustomers]);

  // Toggle import modal
  const toggleImportModal = useCallback(() => {
    setIsImportModalOpen(prevState => !prevState);
  }, []);
  
  // Handle toast
  const toggleToast = useCallback(() => setActiveToast(active => !active), []);
  
  // Handle import success
  const handleImportSuccess = useCallback((result: CustomerImportResult) => {
    if (result.imported > 0) {
      setToastMessage(`Successfully imported ${result.imported} customers`);
      setActiveToast(true);
      
      // Refresh customer list
      fetchCustomers();
    }
  }, [fetchCustomers]);

  // Render empty state
  const renderEmptyState = () => {
    if (appliedFilters.length > 0 || searchValue) {
      return (
        <EmptyState
          heading="No customers found"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Try changing the filters or search term</p>
        </EmptyState>
      );
    }
    
    return (
      <EmptyState
        heading="Manage your customers"
        action={{content: 'Import Customers', onAction: toggleImportModal}}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Import customers or add them through the Shopify admin.</p>
      </EmptyState>
    );
  };

  return (
    <Frame>
      <div>
        {showStats && stats && (
          <div style={{ marginBottom: '16px' }}>
            <Stack distribution="fillEvenly">
              <SummaryCard
                title="Total Customers"
                value={stats.totalCustomers}
                trend={stats.totalCustomersTrend}
                loading={statsLoading}
              />
              <SummaryCard
                title="Active Customers"
                value={stats.activeCustomers}
                trend={stats.activeCustomersTrend}
                loading={statsLoading}
              />
              <SummaryCard
                title="New Customers"
                value={stats.newCustomers}
                trend={stats.newCustomersTrend}
                loading={statsLoading}
                tooltip="New customers in the last 30 days"
              />
              <SummaryCard
                title="With Credit"
                value={stats.customerWithCredit}
                trend={stats.customerWithCreditTrend}
                loading={statsLoading}
                tooltip="Customers with active credit balance"
              />
            </Stack>
          </div>
        )}

        <Card>
          <Card.Section>
            <Stack>
              <Stack.Item fill>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ marginRight: '10px' }}>
                    <TextField
                      label="Search"
                      value={searchValue}
                      onChange={setSearchValue}
                      placeholder="Search by name, email or phone"
                      labelHidden
                      connectedRight={
                        <Button onClick={handleSearchSubmit}>Search</Button>
                      }
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchSubmit();
                        }
                      }}
                    />
                  </div>
                </div>
              </Stack.Item>
              <Stack.Item>
                <ButtonGroup>
                  <Button 
                    primary 
                    onClick={toggleImportModal}
                  >
                    Import Customers
                  </Button>
                </ButtonGroup>
              </Stack.Item>
            </Stack>
          </Card.Section>

          {showFilters && (
            <Card.Section>
              <Filters
                queryValue={searchValue}
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    filter: (
                      <div>
                        <Stack vertical>
                          <Stack.Item>
                            <Button
                              onClick={() => {
                                const newFilters = [
                                  ...appliedFilters.filter(filter => filter.key !== 'status'),
                                  { key: 'status', label: 'Status', value: 'ACTIVE' }
                                ];
                                setAppliedFilters(newFilters);
                              }}
                              size="slim"
                              fullWidth
                            >
                              Active
                            </Button>
                          </Stack.Item>
                          <Stack.Item>
                            <Button
                              onClick={() => {
                                const newFilters = [
                                  ...appliedFilters.filter(filter => filter.key !== 'status'),
                                  { key: 'status', label: 'Status', value: 'INACTIVE' }
                                ];
                                setAppliedFilters(newFilters);
                              }}
                              size="slim"
                              fullWidth
                            >
                              Inactive
                            </Button>
                          </Stack.Item>
                          <Stack.Item>
                            <Button
                              onClick={() => {
                                const newFilters = [
                                  ...appliedFilters.filter(filter => filter.key !== 'status'),
                                  { key: 'status', label: 'Status', value: 'BLOCKED' }
                                ];
                                setAppliedFilters(newFilters);
                              }}
                              size="slim"
                              fullWidth
                            >
                              Blocked
                            </Button>
                          </Stack.Item>
                        </Stack>
                      </div>
                    ),
                    shortcut: true,
                  },
                  {
                    key: 'hasCreditBalance',
                    label: 'Credit Balance',
                    filter: (
                      <div>
                        <Stack vertical>
                          <Stack.Item>
                            <Button
                              onClick={() => {
                                const newFilters = [
                                  ...appliedFilters.filter(filter => filter.key !== 'hasCreditBalance'),
                                  { key: 'hasCreditBalance', label: 'Has Credit Balance', value: 'yes' }
                                ];
                                setAppliedFilters(newFilters);
                              }}
                              size="slim"
                              fullWidth
                            >
                              Has credit
                            </Button>
                          </Stack.Item>
                          <Stack.Item>
                            <Button
                              onClick={() => {
                                const newFilters = [
                                  ...appliedFilters.filter(filter => filter.key !== 'hasCreditBalance'),
                                  { key: 'hasCreditBalance', label: 'Has Credit Balance', value: 'no' }
                                ];
                                setAppliedFilters(newFilters);
                              }}
                              size="slim"
                              fullWidth
                            >
                              No credit
                            </Button>
                          </Stack.Item>
                        </Stack>
                      </div>
                    ),
                    shortcut: true,
                  },
                ]}
                appliedFilters={appliedFilters}
                onQueryChange={setSearchValue}
                onQueryClear={() => setSearchValue('')}
                onClearAll={() => {
                  setSearchValue('');
                  setAppliedFilters([]);
                }}
                onFiltersChange={handleFiltersChange}
              />
            </Card.Section>
          )}

          <ResourceList
            resourceName={{ singular: 'customer', plural: 'customers' }}
            items={customers}
            loading={isLoading}
            renderItem={(customer: CustomerType) => {
              const { id, firstName, lastName, email, status, credits = [] } = customer;
              const name = `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown';
              const totalCredit = credits.reduce((sum, credit) => 
                sum + (credit.status === 'ACTIVE' ? Number(credit.balance) : 0), 0
              );
              
              return (
                <ResourceItem
                  id={id}
                  accessibilityLabel={`View details for ${name}`}
                  name={name}
                  onClick={() => handleCustomerClick(id)}
                >
                  <Stack alignment="center">
                    <Stack.Item>
                      <Avatar customer size="medium" name={name} />
                    </Stack.Item>
                    <Stack.Item fill>
                      <Stack vertical spacing="tight">
                        <Stack.Item>
                          <TextStyle variation="strong">{name}</TextStyle>
                        </Stack.Item>
                        <Stack.Item>
                          <TextStyle variation="subdued">{email}</TextStyle>
                        </Stack.Item>
                      </Stack>
                    </Stack.Item>
                    <Stack.Item>
                      <Stack vertical alignment="trailing" spacing="tight">
                        <Stack.Item>
                          {status && <StatusBadge status={status} />}
                        </Stack.Item>
                        <Stack.Item>
                          {totalCredit > 0 && (
                            <Badge status="success">
                              ${totalCredit.toFixed(2)} credit
                            </Badge>
                          )}
                        </Stack.Item>
                      </Stack>
                    </Stack.Item>
                  </Stack>
                </ResourceItem>
              );
            }}
            selectedItems={selectedCustomers}
            onSelectionChange={handleSelectionChange}
            bulkActions={[
              {
                content: 'Export Selected',
                onAction: () => console.log('Export selected items'),
              },
            ]}
            emptyState={renderEmptyState()}
          />

          {!isLoading && customers.length > 0 && (
            <Card.Section>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  hasPrevious={currentPage > 1}
                  onPrevious={() => handlePageChange(currentPage - 1)}
                  hasNext={currentPage < totalPages}
                  onNext={() => handlePageChange(currentPage + 1)}
                />
              </div>
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <TextStyle variation="subdued">
                  Showing {customers.length} of {totalCustomers} customers
                </TextStyle>
              </div>
            </Card.Section>
          )}
        </Card>

        {/* Customer Import Component */}
        <CustomerImport
          open={isImportModalOpen}
          onClose={toggleImportModal}
          onSuccess={handleImportSuccess}
        />
        
        {activeToast && (
          <Toast content={toastMessage} onDismiss={toggleToast} />
        )}
      </div>
    </Frame>
  );
} 