import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  Layout,
  Button,
  ButtonGroup,
  Stack,
  TextContainer,
  Text,
  Badge,
  Banner,
  Modal,
  TextField,
  Frame,
  Toast,
  List,
  Link,
  Heading,
  SkeletonBodyText,
  SkeletonDisplayText,
  Timeline,
  Icon,
  FooterHelp,
  Tabs,
  Loading,
  EmptyState,
  Popover,
  ActionList,
  Select,
  Box,
  FormLayout,
  LegacyCard,
  Thumbnail
} from '@shopify/polaris';
import {
  ArrowLeftMinor,
  EditMinor,
  DeleteMinor,
  CalendarMinor,
  CustomersMajor,
  AttachmentMinor,
  CircleAlertMajor,
  CircleTickMajor,
  MobileAcceptMajor,
  CirclePlusMinor,
  CircleMinusMajor,
  RefundMinor,
  MoneyMinor,
  TransactionMajor,
  CircleCancelMajor,
  RefreshMinor,
  MobileBackArrowMajor
} from '@shopify/polaris-icons';
import { useAPI } from '../hooks/useAPI';
import { 
  StatusBadge, 
  SectionHeader,
  NotificationBanner,
  formatCurrency,
  formatDate
} from '../components/common/AdminUIComponents';
import CreditForm from '../components/credits/CreditForm';
import { CreditType, Transaction } from '../types/credit';
import { CustomerType } from '../types/customer';

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading: boolean;
  onViewTransaction: (id: string) => void;
}

// Transaction history component
const TransactionHistory = ({ transactions, isLoading, onViewTransaction }: TransactionHistoryProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'ISSUE':
        return 'Issued';
      case 'REDEMPTION':
        return 'Redeemed';
      case 'VOID':
        return 'Voided';
      case 'ADJUSTMENT':
        return 'Adjusted';
      default:
        return type;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'ISSUE':
        return <Badge status="success">Issued</Badge>;
      case 'REDEMPTION':
        return <Badge status="info">Redeemed</Badge>;
      case 'VOID':
        return <Badge status="critical">Voided</Badge>;
      case 'ADJUSTMENT':
        return <Badge status="warning">Adjusted</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card sectioned>
        <SkeletonBodyText lines={5} />
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card sectioned>
        <EmptyState
          heading="No transactions yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>This credit has no transaction history.</p>
        </EmptyState>
      </Card>
    );
  }

  const rows = transactions.map((transaction) => [
    <Link onClick={() => onViewTransaction(transaction.id)}>{transaction.id.substring(0, 8)}</Link>,
    getTransactionIcon(transaction.type),
    formatCurrency(transaction.amount),
    formatCurrency(transaction.balanceAfter),
    formatDate(transaction.createdAt),
    transaction.note || '-',
    transaction.staffId || '-',
    transaction.orderId ? (
      <Link url={`/orders/${transaction.orderId}`}>{transaction.orderId}</Link>
    ) : (
      '-'
    ),
  ]);

  return (
    <LegacyCard>
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
          'Type',
          'Amount',
          'Balance After',
          'Date',
          'Note',
          'Staff',
          'Order',
        ]}
        rows={rows}
      />
    </LegacyCard>
  );
};

const CreditDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useAPI();
  
  const [credit, setCredit] = useState<CreditType | null>(null);
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  
  // Form values
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [applyAmount, setApplyAmount] = useState('');
  const [applyOrderId, setApplyOrderId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [extendDate, setExtendDate] = useState<Date | null>(null);
  const [extendReason, setExtendReason] = useState('');
  
  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  
  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // UI state
  const [toastActive, setToastActive] = useState(false);
  const [popoverActive, setPopoverActive] = useState(false);
  
  // Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [voidLoading, setVoidLoading] = useState(false);
  
  // Fetch credit details
  const fetchCredit = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/credits/${id}`);
      
      if (response.data.success) {
        setCredit(response.data.credit);
        
        // Fetch customer if credit has customer ID
        if (response.data.credit.customerId) {
          const customerResponse = await api.get(`/customers/${response.data.credit.customerId}`);
          if (customerResponse.data.success) {
            setCustomer(customerResponse.data.customer);
          }
        }
        
        // Fetch transactions
        const transactionsResponse = await api.get(`/credits/${id}/transactions`);
        setTransactions(transactionsResponse.data);
        
        setError('');
      } else {
        setError(response.data.error || 'Failed to load credit details');
      }
    } catch (error) {
      console.error('Error fetching credit details:', error);
      setError('An error occurred while loading credit details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, id]);
  
  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);
  
  // Update credit
  const handleUpdateCredit = async (updatedData: any) => {
    try {
      const response = await api.patch(`/credits/${id}`, updatedData);
      
      if (response.data.success) {
        setCredit(response.data.credit);
        setShowEditModal(false);
        setToastMessage('Credit updated successfully');
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to update credit');
      }
    } catch (error) {
      console.error('Error updating credit:', error);
      setToastError(true);
      setToastMessage('An error occurred while updating the credit. Please try again.');
    }
  };
  
  // Apply credit
  const handleApplyCredit = async () => {
    if (!id || !applyAmount || isNaN(parseFloat(applyAmount)) || parseFloat(applyAmount) <= 0) {
      setToastError(true);
      setToastMessage('Please enter a valid amount');
      return;
    }
    
    try {
      const response = await api.post(`/credits/${id}/apply`, {
        amount: parseFloat(applyAmount),
        orderId: applyOrderId || undefined
      });
      
      if (response.data.success) {
        setCredit(response.data.credit);
        setShowApplyModal(false);
        setApplyAmount('');
        setApplyOrderId('');
        setToastMessage('Credit applied successfully');
        fetchCredit();
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to apply credit');
      }
    } catch (error) {
      console.error('Error applying credit:', error);
      setToastError(true);
      setToastMessage('An error occurred while applying the credit. Please try again.');
    }
  };
  
  // Adjust credit
  const handleAdjustCredit = async () => {
    if (!id || !adjustmentAmount || isNaN(parseFloat(adjustmentAmount))) {
      setToastError(true);
      setToastMessage('Please enter a valid amount');
      return;
    }
    
    try {
      const response = await api.post(`/credits/${id}/adjust`, {
        adjustmentAmount: parseFloat(adjustmentAmount),
        reason: adjustmentReason
      });
      
      if (response.data.success) {
        setCredit(response.data.credit);
        setShowAdjustModal(false);
        setAdjustmentAmount('');
        setAdjustmentReason('');
        setToastMessage('Credit adjusted successfully');
        fetchCredit();
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to adjust credit');
      }
    } catch (error) {
      console.error('Error adjusting credit:', error);
      setToastError(true);
      setToastMessage('An error occurred while adjusting the credit. Please try again.');
    }
  };
  
  // Cancel credit
  const handleCancelCredit = async () => {
    if (!id || !cancelReason) {
      setToastError(true);
      setToastMessage('Please provide a reason for cancellation');
      return;
    }
    
    try {
      const response = await api.post(`/credits/${id}/cancel`, {
        reason: cancelReason
      });
      
      if (response.data.success) {
        setCredit(response.data.credit);
        setShowCancelModal(false);
        setCancelReason('');
        setToastMessage('Credit cancelled successfully');
        fetchCredit();
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to cancel credit');
      }
    } catch (error) {
      console.error('Error cancelling credit:', error);
      setToastError(true);
      setToastMessage('An error occurred while cancelling the credit. Please try again.');
    }
  };
  
  // Extend expiration
  const handleExtendExpiration = async () => {
    if (!id || !extendDate) {
      setToastError(true);
      setToastMessage('Please select a new expiration date');
      return;
    }
    
    try {
      const response = await api.post(`/credits/${id}/extend-expiration`, {
        newExpirationDate: extendDate.toISOString(),
        reason: extendReason
      });
      
      if (response.data.success) {
        setCredit(response.data.credit);
        setShowExtendModal(false);
        setExtendDate(null);
        setExtendReason('');
        setToastMessage('Expiration date extended successfully');
        fetchCredit();
      } else {
        setToastError(true);
        setToastMessage(response.data.error || 'Failed to extend expiration date');
      }
    } catch (error) {
      console.error('Error extending expiration date:', error);
      setToastError(true);
      setToastMessage('An error occurred while extending the expiration date. Please try again.');
    }
  };
  
  // Handle tab change
  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  };
  
  // Get transaction icon based on type
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'ISSUE':
        return CirclePlusMinor;
      case 'REDEEM':
        return MobileAcceptMajor;
      case 'ADJUST_UP':
        return CirclePlusMinor;
      case 'ADJUST_DOWN':
        return CircleMinusMajor;
      case 'CANCEL':
        return DeleteMinor;
      case 'EXPIRE':
        return CircleAlertMajor;
      default:
        return AttachmentMinor;
    }
  };
  
  // Get transaction color based on type
  const getTransactionColor = (type: string): "base" | "success" | "critical" | "warning" | "highlight" => {
    switch (type) {
      case 'ISSUE':
      case 'ADJUST_UP':
        return 'success';
      case 'REDEEM':
      case 'ADJUST_DOWN':
        return 'highlight';
      case 'CANCEL':
      case 'EXPIRE':
        return 'critical';
      default:
        return 'base';
    }
  };
  
  // Tabs
  const tabs = [
    {
      id: 'details',
      content: 'Details',
      accessibilityLabel: 'Credit Details',
      panelID: 'credit-details-panel',
    },
    {
      id: 'transactions',
      content: 'History',
      accessibilityLabel: 'Transaction History',
      panelID: 'transaction-history-panel',
    },
  ];
  
  // Format amount with 2 decimal places
  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  // Format full date with time
  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Generate transaction rows for data table
  const transactionRows = transactions.map((transaction) => [
    <Text key={`${transaction.id}-type`} variant="bodyMd">
      <Badge
        status={
          transaction.type === 'ISSUE' ? 'success' :
          transaction.type === 'REDEEM' ? 'info' :
          transaction.type === 'ADJUST' ? 'warning' :
          transaction.type === 'VOID' ? 'critical' :
          'default'
        }
      >
        {transaction.type}
      </Badge>
    </Text>,
    <Text key={`${transaction.id}-date`} variant="bodyMd">
      {formatFullDate(transaction.createdAt)}
    </Text>,
    <Text key={`${transaction.id}-amount`} variant="bodyMd">
      {transaction.amount < 0 ? '-' : '+'}{formatAmount(Math.abs(transaction.amount))}
    </Text>,
    <Text key={`${transaction.id}-balance`} variant="bodyMd">
      {formatAmount(transaction.balanceAfter || 0)}
    </Text>,
    <Text key={`${transaction.id}-note`} variant="bodyMd">
      {transaction.note || '-'}
    </Text>,
    <ButtonGroup key={`${transaction.id}-actions`}>
      <Button
        size="slim"
        onClick={() => navigate(`/transactions/${transaction.id}`)}
        icon={TransactionMajor}
      >
        View
      </Button>
    </ButtonGroup>
  ]);
  
  // Action handlers
  const handleViewTransaction = useCallback((transactionId: string) => {
    navigate(`/transactions/${transactionId}`);
  }, [navigate]);

  // Toast handler
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);

  // Function to determine credit status badge
  const getCreditStatusBadge = (status: string) => {
    const statusMap: Record<string, { status: 'success' | 'info' | 'warning' | 'critical', icon: React.ReactNode }> = {
      ACTIVE: { 
        status: 'success', 
        icon: <CircleTickMajor />
      },
      USED: { 
        status: 'info', 
        icon: <TransactionMajor />
      },
      EXPIRED: { 
        status: 'warning', 
        icon: <CalendarMinor />
      },
      VOIDED: { 
        status: 'critical', 
        icon: <CircleAlertMajor />
      }
    };
    
    const { status: badgeStatus, icon } = statusMap[status] || { status: 'default', icon: null };
    
    return (
      <Stack spacing="tight" alignment="center">
        {icon && <Icon source={icon} />}
        <Badge status={badgeStatus}>{status}</Badge>
      </Stack>
    );
  };

  // Action button popover
  const actionsPopover = (
    <Popover
      active={popoverActive}
      activator={
        <Button onClick={() => setPopoverActive(true)} disclosure>
          Actions
        </Button>
      }
      onClose={() => setPopoverActive(false)}
    >
      <ActionList
        items={[
          {
            content: 'Adjust balance',
            onAction: () => {
              setIsAdjustModalOpen(true);
              setPopoverActive(false);
            },
            disabled: credit?.status !== 'ACTIVE'
          },
          {
            content: 'Void credit',
            onAction: () => {
              setIsVoidModalOpen(true);
              setPopoverActive(false);
            },
            disabled: credit?.status !== 'ACTIVE'
          }
        ]}
      />
    </Popover>
  );

  // Render loading state
  if (loading) {
    return (
      <Page
        breadcrumbs={[{ content: 'Credits', url: '/credits' }]}
        title="Loading Credit Details"
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
  
  // Render error state
  if (error || !credit) {
    return (
      <Page
        breadcrumbs={[{ content: 'Credits', url: '/credits' }]}
        title="Credit Details"
      >
        <Layout>
          <Layout.Section>
            <NotificationBanner
              status="critical"
              title="Error"
              message={error || 'Credit not found'}
              action={{
                content: 'Go back to Credits',
                onAction: () => navigate('/credits'),
              }}
            />
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  return (
    <Frame>
      {toastMessage && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={dismissToast}
          duration={4000}
        />
      )}
      
      <Page
        breadcrumbs={[{ content: 'Credits', url: '/credits' }]}
        title={`Credit: ${credit.code}`}
        titleMetadata={getCreditStatusBadge(credit.status)}
        primaryAction={{
          content: 'Back to credits',
          icon: MobileBackArrowMajor,
          onAction: () => navigate('/credits')
        }}
        secondaryActions={[
          {
            content: actionsPopover
          }
        ]}
      >
        <Layout>
          <Layout.Section>
            <SectionHeader
              title={`Credit: ${credit.code}`}
              actions={{
                secondary: [
                  {
                    content: 'Back to Credits',
                    onAction: () => navigate('/credits'),
                    icon: ArrowLeftMinor,
                  },
                ],
              }}
            />
          </Layout.Section>
          
          <Layout.Section>
            <Card>
              <Tabs
                tabs={tabs}
                selected={selectedTab}
                onSelect={handleTabChange}
              >
                <Card.Section>
                  {selectedTab === 0 ? (
                    <Stack vertical spacing="loose">
                      <Stack distribution="equalSpacing">
                        <Stack vertical spacing="tight">
                          <Text variant="headingMd" as="h3">Amount</Text>
                          <Text variant="heading2xl" as="p">
                            {formatCurrency(credit.amount, credit.currency)}
                          </Text>
                        </Stack>
                        
                        <Stack vertical spacing="tight">
                          <Text variant="headingMd" as="h3">Current Balance</Text>
                          <Text variant="heading2xl" as="p">
                            {formatCurrency(credit.balance, credit.currency)}
                          </Text>
                        </Stack>
                      </Stack>
                      
                      <div style={{ borderTop: '1px solid var(--p-divider)' }}></div>
                      
                      <Stack distribution="fillEvenly">
                        <Stack vertical spacing="tight">
                          <Text variant="headingMd" as="h3">Status</Text>
                          <StatusBadge status={credit.status} />
                        </Stack>
                        
                        <Stack vertical spacing="tight">
                          <Text variant="headingMd" as="h3">Created On</Text>
                          <Text as="p">{formatDate(credit.createdAt)}</Text>
                        </Stack>
                        
                        <Stack vertical spacing="tight">
                          <Text variant="headingMd" as="h3">
                            <Stack alignment="center" spacing="extraTight">
                              <span>Expires</span>
                              <Icon source={CalendarMinor} color="base" />
                            </Stack>
                          </Text>
                          <Text as="p">
                            {credit.expirationDate 
                              ? formatDate(credit.expirationDate)
                              : 'Never'
                            }
                          </Text>
                        </Stack>
                      </Stack>
                      
                      <div style={{ borderTop: '1px solid var(--p-divider)' }}></div>
                      
                      <Stack vertical spacing="tight">
                        <Text variant="headingMd" as="h3">Customer</Text>
                        {customer ? (
                          <Stack alignment="center" spacing="tight">
                            <Icon source={CustomersMajor} color="base" />
                            <Link url={`/customers/${customer.id}`}>
                              {customer.firstName} {customer.lastName}
                            </Link>
                            <Text as="span">({customer.email})</Text>
                          </Stack>
                        ) : (
                          <Text as="p">No customer assigned</Text>
                        )}
                      </Stack>
                      
                      {credit.note && (
                        <>
                          <div style={{ borderTop: '1px solid var(--p-divider)' }}></div>
                          <Stack vertical spacing="tight">
                            <Text variant="headingMd" as="h3">Note</Text>
                            <Text as="p">{credit.note}</Text>
                          </Stack>
                        </>
                      )}
                      
                      <div style={{ borderTop: '1px solid var(--p-divider)' }}></div>
                      
                      <ButtonGroup>
                        {credit.status === 'ACTIVE' && (
                          <>
                            <Button onClick={() => setShowEditModal(true)} icon={EditMinor}>
                              Edit
                            </Button>
                            <Button onClick={() => setShowApplyModal(true)} icon={MobileAcceptMajor}>
                              Apply Credit
                            </Button>
                            <Button onClick={() => setShowAdjustModal(true)} icon={MoneyMinor}>
                              Adjust Balance
                            </Button>
                            {credit.expirationDate && (
                              <Button onClick={() => setShowExtendModal(true)} icon={CalendarMinor}>
                                Extend Expiration
                              </Button>
                            )}
                            <Button 
                              onClick={() => setShowCancelModal(true)} 
                              icon={DeleteMinor}
                              destructive
                            >
                              Cancel Credit
                            </Button>
                          </>
                        )}
                        
                        {(credit.status === 'CANCELLED' || credit.status === 'EXPIRED') && credit.balance > 0 && (
                          <Button onClick={() => setShowEditModal(true)} icon={EditMinor}>
                            Edit Details
                          </Button>
                        )}
                        
                        {credit.status === 'REDEEMED' && (
                          <Button onClick={() => setShowEditModal(true)} icon={EditMinor}>
                            Edit Details
                          </Button>
                        )}
                      </ButtonGroup>
                    </Stack>
                  ) : (
                    <Stack vertical spacing="loose">
                      <Heading>Transaction History</Heading>
                      
                      <TransactionHistory 
                        transactions={credit.transactions || []} 
                        isLoading={loading}
                        onViewTransaction={handleViewTransaction}
                      />
                    </Stack>
                  )}
                </Card.Section>
              </Tabs>
            </Card>
          </Layout.Section>
          
          <Layout.Section>
            <FooterHelp>
              Looking to bulk manage credits? Visit the{' '}
              <Link url="/credits">credits listing page</Link>.
            </FooterHelp>
          </Layout.Section>
        </Layout>
      </Page>
      
      {/* Edit Credit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Credit"
        primaryAction={{
          content: 'Save',
          onAction: () => document.getElementById('edit-credit-form-submit')?.click(),
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowEditModal(false),
          },
        ]}
      >
        <Modal.Section>
          <CreditForm
            credit={credit}
            onSubmit={handleUpdateCredit}
            submitButtonId="edit-credit-form-submit"
            isEditing={true}
          />
        </Modal.Section>
      </Modal>
      
      {/* Apply Credit Modal */}
      <Modal
        open={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply Credit"
        primaryAction={{
          content: 'Apply',
          onAction: handleApplyCredit,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowApplyModal(false),
          },
        ]}
      >
        <Modal.Section>
          <Stack vertical>
            <Text as="p">
              Current Balance: {formatCurrency(credit.balance, credit.currency)}
            </Text>
            
            <TextField
              label="Amount to Apply"
              type="number"
              value={applyAmount}
              onChange={setApplyAmount}
              autoComplete="off"
              helpText={`Enter the amount to apply (max: ${formatCurrency(credit.balance, credit.currency)})`}
              error={
                applyAmount &&
                (isNaN(parseFloat(applyAmount)) ||
                  parseFloat(applyAmount) <= 0 ||
                  parseFloat(applyAmount) > credit.balance)
                  ? 'Please enter a valid amount (greater than 0 and less than or equal to current balance)'
                  : undefined
              }
              prefix={credit.currency}
            />
            
            <TextField
              label="Order ID (Optional)"
              value={applyOrderId}
              onChange={setApplyOrderId}
              autoComplete="off"
              helpText="If this credit is being applied to an order, enter the order ID"
            />
          </Stack>
        </Modal.Section>
      </Modal>
      
      {/* Adjust Credit Modal */}
      <Modal
        open={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Adjust Credit Balance"
        primaryAction={{
          content: 'Adjust',
          onAction: handleAdjustCredit,
          loading: adjustLoading,
          disabled: !adjustmentAmount || !adjustmentReason
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsAdjustModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Current Balance"
                value={formatCurrency(credit.balance)}
                disabled
              />
              <TextField
                label="Adjustment Amount"
                value={adjustmentAmount}
                onChange={setAdjustmentAmount}
                type="number"
                autoComplete="off"
                helpText="Use positive value to add credit, negative to subtract"
              />
            </FormLayout.Group>
            <TextField
              label="Reason for Adjustment"
              value={adjustmentReason}
              onChange={setAdjustmentReason}
              autoComplete="off"
              multiline={3}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      {/* Void Credit Modal */}
      <Modal
        open={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        title="Void Credit"
        primaryAction={{
          content: 'Void Credit',
          onAction: handleCancelCredit,
          loading: voidLoading,
          disabled: !cancelReason,
          destructive: true
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsVoidModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <Box paddingBlockEnd="400">
            <Banner
              title="This action cannot be undone"
              status="warning"
            >
              <p>Voiding this credit will make it unusable and the customer will no longer be able to redeem it.</p>
            </Banner>
          </Box>
          <FormLayout>
            <TextField
              label="Reason for Voiding"
              value={cancelReason}
              onChange={setCancelReason}
              autoComplete="off"
              multiline={3}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      {/* Extend Expiration Modal */}
      {credit.expirationDate && (
        <Modal
          open={showExtendModal}
          onClose={() => setShowExtendModal(false)}
          title="Extend Expiration Date"
          primaryAction={{
            content: 'Extend',
            onAction: handleExtendExpiration,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setShowExtendModal(false),
            },
          ]}
        >
          <Modal.Section>
            <Stack vertical>
              <Text as="p">
                Current Expiration: {formatDate(credit.expirationDate)}
              </Text>
              
              <div style={{ margin: '16px 0' }}>
                <DatePicker
                  month={extendDate ? extendDate.getMonth() : new Date().getMonth()}
                  year={extendDate ? extendDate.getFullYear() : new Date().getFullYear()}
                  onChange={({ start }) => setExtendDate(start)}
                  selected={extendDate}
                  disableDatesBefore={new Date()}
                />
              </div>
              
              <TextField
                label="Reason"
                value={extendReason}
                onChange={setExtendReason}
                autoComplete="off"
                multiline={3}
                helpText="Provide a reason for extending the expiration date"
                error={!extendReason && extendDate ? 'Reason is required' : undefined}
              />
            </Stack>
          </Modal.Section>
        </Modal>
      )}
    </Frame>
  );
};

export default CreditDetail; 