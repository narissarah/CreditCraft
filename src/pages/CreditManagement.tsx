import React, { useState, useCallback, useEffect } from 'react';
import {
  Page,
  Card,
  Filters,
  DataTable,
  Button,
  Modal,
  Toast,
  Frame,
  Stack,
  TextContainer,
  Tabs,
  Layout,
  Icon,
  EmptyState,
  Pagination,
  Select,
  Tag,
  SkeletonBodyText,
  Popover,
  ActionList,
} from '@shopify/polaris';
import { 
  SearchMinor, 
  FilterMinor, 
  ExportMinor, 
  DeleteMinor, 
  PlusMinor,
  MobileVerticalDotsMajor,
  CalendarMinor
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks/useAPI';
import { 
  StatusBadge, 
  SummaryCard, 
  SectionHeader, 
  EmptyStateComponent, 
  NotificationBanner,
  formatCurrency,
  formatDate
} from '../components/common/AdminUIComponents';
import CreditForm from '../components/credits/CreditForm';
import { CreditType } from '../types/credit';

const CreditManagement: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState<CreditType[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sorting, setSorting] = useState({ field: 'createdAt', direction: 'desc' });
  const [selectedCredit, setSelectedCredit] = useState<CreditType | null>(null);
  const [bulkActions, setBulkActions] = useState<string[]>([]);
  const [popoverActive, setPopoverActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const api = useAPI();

  // Stats summary data
  const [statsData, setStatsData] = useState({
    total: { value: 0, trend: 0 },
    active: { value: 0, trend: 0 },
    redeemed: { value: 0, trend: 0 },
    expired: { value: 0, trend: 0 },
  });

  // Fetch credits
  const fetchCredits = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy: sorting.field,
        sortOrder: sorting.direction,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (selectedStatus) {
        params.status = selectedStatus;
      }

      // Add tab-specific filters
      if (selectedTab === 1) {
        params.status = 'ACTIVE';
      } else if (selectedTab === 2) {
        params.status = 'REDEEMED';
      } else if (selectedTab === 3) {
        params.status = 'EXPIRED,CANCELLED';
      }

      const response = await api.get(`/credits`, { params });
      
      if (response.data.success) {
        setCredits(response.data.credits);
        setTotalPages(response.data.totalPages);
        setTotalItems(response.data.total);
        setErrorMessage('');
      } else {
        setErrorMessage(response.data.error || 'Failed to fetch credits');
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      setErrorMessage('Failed to fetch credits. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [api, currentPage, itemsPerPage, searchQuery, selectedStatus, sorting, selectedTab]);

  // Fetch credit stats
  const fetchCreditStats = useCallback(async () => {
    try {
      const response = await api.get('/credits/stats');
      
      if (response.data.success) {
        setStatsData({
          total: { 
            value: response.data.stats.totalCredits,
            trend: response.data.stats.totalCreditsTrend
          },
          active: { 
            value: response.data.stats.activeCredits,
            trend: response.data.stats.activeCreditsTrend
          },
          redeemed: { 
            value: response.data.stats.redeemedCredits,
            trend: response.data.stats.redeemedCreditsTrend
          },
          expired: { 
            value: response.data.stats.expiredCredits,
            trend: response.data.stats.expiredCreditsTrend
          },
        });
      }
    } catch (error) {
      console.error('Error fetching credit stats:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchCredits();
    fetchCreditStats();
  }, [fetchCredits, fetchCreditStats]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Handle status filter
  const handleStatusChange = (value: string) => {
    setSelectedStatus(value === 'all' ? null : value);
    setCurrentPage(1);
  };

  // Handle sorting
  const handleSortChange = (field: string) => {
    setSorting(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };

  // Handle tab change
  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setCurrentPage(1);
  };

  // Handle credit creation
  const handleCreateCredit = async (creditData: any) => {
    try {
      const response = await api.post('/credits', creditData);
      
      if (response.data.success) {
        setShowCreditForm(false);
        setToastMessage('Credit created successfully');
        fetchCredits();
        fetchCreditStats();
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to create credit');
      }
    } catch (error) {
      console.error('Error creating credit:', error);
      setToastError(true);
      setToastMessage('Error creating credit. Please try again.');
    }
  };

  // Handle credit delete
  const handleDeleteConfirm = async () => {
    if (!selectedCredit) return;
    
    try {
      const response = await api.post(`/credits/${selectedCredit.id}/cancel`, {
        reason: 'Cancelled by admin'
      });
      
      if (response.data.success) {
        setShowDeleteModal(false);
        setToastMessage('Credit cancelled successfully');
        fetchCredits();
        fetchCreditStats();
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to cancel credit');
      }
    } catch (error) {
      console.error('Error cancelling credit:', error);
      setToastError(true);
      setToastMessage('Error cancelling credit. Please try again.');
    } finally {
      setSelectedCredit(null);
    }
  };

  // Handle row click
  const handleRowClick = (id: string) => {
    navigate(`/credits/${id}`);
  };

  // Handle credit edit
  const handleEditClick = (credit: CreditType) => {
    setSelectedCredit(credit);
    navigate(`/credits/${credit.id}/edit`);
  };

  // Handle credit delete
  const handleDeleteClick = (credit: CreditType) => {
    setSelectedCredit(credit);
    setShowDeleteModal(true);
    setPopoverActive(false);
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    if (bulkActions.length === 0) return;
    
    if (action === 'cancel') {
      try {
        const promises = bulkActions.map(id => 
          api.post(`/credits/${id}/cancel`, { reason: 'Bulk cancellation by admin' })
        );
        
        await Promise.all(promises);
        setToastMessage(`${bulkActions.length} credits cancelled successfully`);
        fetchCredits();
        fetchCreditStats();
      } catch (error) {
        console.error('Error cancelling credits:', error);
        setToastError(true);
        setToastMessage('Error cancelling credits. Please try again.');
      } finally {
        setBulkActions([]);
      }
    }
  };

  // Toggle popover for row actions
  const togglePopover = () => setPopoverActive((popoverActive) => !popoverActive);

  // Handle row selection for bulk actions
  const handleSelectionChange = (selectedRows: string[]) => {
    setBulkActions(selectedRows);
  };

  // Format table rows from credits data
  const rows = credits.map((credit) => [
    <div onClick={() => handleRowClick(credit.id)}>
      <TextContainer>
        <p><strong>{credit.code}</strong></p>
        <p style={{ color: 'var(--p-text-subdued)' }}>Created {formatDate(credit.createdAt)}</p>
      </TextContainer>
    </div>,
    formatCurrency(credit.amount, credit.currency),
    formatCurrency(credit.balance, credit.currency),
    <StatusBadge status={credit.status} />,
    credit.expirationDate ? formatDate(credit.expirationDate) : 'Never',
    credit.customerId ? (
      <Button plain url={`/customers/${credit.customerId}`}>
        View Customer
      </Button>
    ) : (
      'Not assigned'
    ),
    <Popover
      active={popoverActive && selectedCredit?.id === credit.id}
      activator={
        <Button 
          icon={MobileVerticalDotsMajor} 
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCredit(credit);
            togglePopover();
          }}
        />
      }
      onClose={togglePopover}
    >
      <ActionList
        items={[
          {
            content: 'Edit',
            onAction: () => handleEditClick(credit),
          },
          {
            content: 'Cancel',
            destructive: true,
            onAction: () => handleDeleteClick(credit),
          },
        ]}
      />
    </Popover>
  ]);

  // Tabs for different credit statuses
  const tabs = [
    {
      id: 'all',
      content: 'All Credits',
      accessibilityLabel: 'All Credits',
      panelID: 'all-credits-panel',
    },
    {
      id: 'active',
      content: 'Active',
      accessibilityLabel: 'Active Credits',
      panelID: 'active-credits-panel',
    },
    {
      id: 'redeemed',
      content: 'Redeemed',
      accessibilityLabel: 'Redeemed Credits',
      panelID: 'redeemed-credits-panel',
    },
    {
      id: 'expired',
      content: 'Expired/Cancelled',
      accessibilityLabel: 'Expired or Cancelled Credits',
      panelID: 'expired-cancelled-credits-panel',
    },
  ];

  return (
    <Frame>
      {toastMessage && (
        <Toast 
          content={toastMessage} 
          error={toastError}
          onDismiss={() => setToastMessage('')} 
        />
      )}
      
      <Page fullWidth title="Credit Management">
        <Layout>
          <Layout.Section>
            <SectionHeader 
              title="Credit Management"
              actions={{
                primary: {
                  content: 'Create New Credit',
                  onAction: () => setShowCreditForm(true),
                  icon: PlusMinor,
                },
                secondary: [
                  {
                    content: 'Export',
                    onAction: () => console.log('Export credits'),
                    icon: ExportMinor,
                  },
                ],
              }}
            />
          </Layout.Section>
          
          {errorMessage && (
            <Layout.Section>
              <NotificationBanner
                status="critical"
                title="Error"
                message={errorMessage}
                onDismiss={() => setErrorMessage('')}
              />
            </Layout.Section>
          )}
          
          <Layout.Section oneHalf>
            <SummaryCard 
              title="Total Credits" 
              value={formatCurrency(statsData.total.value)}
              loading={isLoading}
              trend={statsData.total.trend !== 0 ? {
                value: statsData.total.trend,
                isUpward: statsData.total.trend > 0
              } : undefined}
              tooltipText="Total value of all credits issued"
            />
          </Layout.Section>
          
          <Layout.Section oneHalf>
            <SummaryCard 
              title="Active Credits" 
              value={formatCurrency(statsData.active.value)}
              loading={isLoading}
              trend={statsData.active.trend !== 0 ? {
                value: statsData.active.trend,
                isUpward: statsData.active.trend > 0
              } : undefined}
              tooltipText="Total value of currently active credits"
            />
          </Layout.Section>
          
          <Layout.Section>
            <Card>
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
                <div style={{ padding: '16px' }}>
                  <Stack vertical>
                    <Stack alignment="center" distribution="equalSpacing">
                      <Stack>
                        <Filters
                          queryValue={searchQuery}
                          filters={[
                            {
                              key: 'status',
                              label: 'Status',
                              filter: (
                                <Select
                                  label="Status"
                                  labelHidden
                                  options={[
                                    { label: 'All', value: 'all' },
                                    { label: 'Active', value: 'ACTIVE' },
                                    { label: 'Redeemed', value: 'REDEEMED' },
                                    { label: 'Expired', value: 'EXPIRED' },
                                    { label: 'Cancelled', value: 'CANCELLED' },
                                  ]}
                                  onChange={handleStatusChange}
                                  value={selectedStatus || 'all'}
                                />
                              ),
                              shortcut: true,
                            },
                          ]}
                          onQueryChange={handleSearchChange}
                          onQueryClear={handleSearchClear}
                          onClearAll={handleSearchClear}
                          queryPlaceholder="Search credits..."
                        />
                      </Stack>
                      
                      {bulkActions.length > 0 && (
                        <Stack>
                          <Button 
                            destructive
                            icon={DeleteMinor}
                            onClick={() => handleBulkAction('cancel')}
                          >
                            Cancel Selected ({bulkActions.length})
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                    
                    {isLoading ? (
                      <Card sectioned>
                        <SkeletonBodyText lines={10} />
                      </Card>
                    ) : credits.length > 0 ? (
                      <>
                        <DataTable
                          columnContentTypes={[
                            'text',
                            'numeric',
                            'numeric',
                            'text',
                            'text',
                            'text',
                            'text',
                          ]}
                          headings={[
                            <Stack alignment="center" spacing="tight">
                              <Button plain onClick={() => handleSortChange('code')}>
                                Credit Code
                                {sorting.field === 'code' && (
                                  <Icon source={sorting.direction === 'asc' ? 'sortAscending' : 'sortDescending'} />
                                )}
                              </Button>
                            </Stack>,
                            <Button plain onClick={() => handleSortChange('amount')}>
                              Amount
                              {sorting.field === 'amount' && (
                                <Icon source={sorting.direction === 'asc' ? 'sortAscending' : 'sortDescending'} />
                              )}
                            </Button>,
                            <Button plain onClick={() => handleSortChange('balance')}>
                              Balance
                              {sorting.field === 'balance' && (
                                <Icon source={sorting.direction === 'asc' ? 'sortAscending' : 'sortDescending'} />
                              )}
                            </Button>,
                            <Button plain onClick={() => handleSortChange('status')}>
                              Status
                              {sorting.field === 'status' && (
                                <Icon source={sorting.direction === 'asc' ? 'sortAscending' : 'sortDescending'} />
                              )}
                            </Button>,
                            <Stack alignment="center" spacing="tight">
                              <Button plain onClick={() => handleSortChange('expirationDate')}>
                                Expires
                                {sorting.field === 'expirationDate' && (
                                  <Icon source={sorting.direction === 'asc' ? 'sortAscending' : 'sortDescending'} />
                                )}
                              </Button>
                              <Icon source={CalendarMinor} color="base" />
                            </Stack>,
                            'Customer',
                            'Actions',
                          ]}
                          rows={rows}
                          selectable
                          selectedItems={bulkActions}
                          onSelectionChange={handleSelectionChange}
                        />
                        <div style={{ padding: '16px 0' }}>
                          <Pagination
                            hasPrevious={currentPage > 1}
                            onPrevious={() => handlePageChange(currentPage - 1)}
                            hasNext={currentPage < totalPages}
                            onNext={() => handlePageChange(currentPage + 1)}
                          />
                        </div>
                      </>
                    ) : (
                      <EmptyStateComponent
                        title="No credits found"
                        description="Try changing your search or filter criteria, or create a new credit."
                        action={{
                          content: 'Create Credit',
                          onAction: () => setShowCreditForm(true),
                        }}
                      />
                    )}
                  </Stack>
                </div>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      
      {/* Credit creation modal */}
      <Modal
        open={showCreditForm}
        onClose={() => setShowCreditForm(false)}
        title="Create New Credit"
        primaryAction={{
          content: 'Create',
          onAction: () => document.getElementById('credit-form-submit')?.click(),
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowCreditForm(false),
          },
        ]}
      >
        <Modal.Section>
          <CreditForm 
            onSubmit={handleCreateCredit} 
            submitButtonId="credit-form-submit" 
          />
        </Modal.Section>
      </Modal>
      
      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Cancel Credit"
        primaryAction={{
          content: 'Yes, Cancel Credit',
          onAction: handleDeleteConfirm,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'No, Keep Credit',
            onAction: () => setShowDeleteModal(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>
              Are you sure you want to cancel this credit? This action cannot be undone.
            </p>
            {selectedCredit && (
              <Stack vertical spacing="tight">
                <p><strong>Credit Code:</strong> {selectedCredit.code}</p>
                <p><strong>Amount:</strong> {formatCurrency(selectedCredit.amount, selectedCredit.currency)}</p>
                <p><strong>Balance:</strong> {formatCurrency(selectedCredit.balance, selectedCredit.currency)}</p>
                <p><strong>Status:</strong> <StatusBadge status={selectedCredit.status} /></p>
              </Stack>
            )}
          </TextContainer>
        </Modal.Section>
      </Modal>
    </Frame>
  );
};

export default CreditManagement; 