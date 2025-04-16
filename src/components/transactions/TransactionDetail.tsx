import React, { useState } from 'react';
import {
  Card,
  Stack,
  Text,
  Badge,
  Button,
  ButtonGroup,
  Spinner,
  Banner,
  Link,
  Box,
  Icon,
  Divider,
  TextContainer,
  Modal,
  List,
  Tooltip,
  Thumbnail,
  useBreakpoints
} from '@shopify/polaris';
import {
  CircleTickMajor,
  CircleDownMajor,
  MobileAcceptMajor,
  CircleCancelMajor,
  ArrowLeftMinor,
  CustomersMajor,
  CreditCardMajor,
  LocationMajor,
  ClockMajor,
  InfoMinor,
  UserMajor,
  NoteMinor,
  OrdersMajor,
  ReportsMajor,
  PrintMinor,
  BankMajor,
  ViewMinor
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '../../types/credit';
import { StatusBadge } from '../common/AdminUIComponents';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface TransactionDetailProps {
  transaction: Transaction | null;
  isLoading: boolean;
  error: string | null;
  onBack?: () => void;
  onVoid?: (id: string, reason: string) => Promise<void>;
  showHistory?: boolean;
}

export default function TransactionDetail({
  transaction,
  isLoading,
  error,
  onBack,
  onVoid,
  showHistory = false
}: TransactionDetailProps) {
  const navigate = useNavigate();
  const { mdUp } = useBreakpoints();
  
  // State for void dialog
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  
  // State for print modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Handle void transaction
  const handleVoidTransaction = async () => {
    if (!transaction || !onVoid) return;
    
    setIsVoiding(true);
    setVoidError(null);
    
    try {
      await onVoid(transaction.id, voidReason);
      setIsVoidModalOpen(false);
    } catch (err) {
      setVoidError('Failed to void transaction. Please try again.');
    } finally {
      setIsVoiding(false);
    }
  };
  
  // Determine if transaction can be voided
  const canVoidTransaction = transaction && 
    ['ISSUE', 'ADJUST'].includes(transaction.type.toUpperCase()) && 
    onVoid && 
    new Date(transaction.createdAt).getTime() > Date.now() - (24 * 60 * 60 * 1000); // Within 24 hours

  // Render transaction type with icon
  const renderTypeWithIcon = (type: string) => {
    let icon;
    let status;
    
    switch (type.toUpperCase()) {
      case 'ISSUE':
        icon = <Icon source={CircleTickMajor} color="success" />;
        status = 'success';
        break;
      case 'REDEEM':
        icon = <Icon source={MobileAcceptMajor} color="highlight" />;
        status = 'info';
        break;
      case 'ADJUST':
        icon = <Icon source={CircleDownMajor} color="warning" />;
        status = 'attention';
        break;
      case 'CANCEL':
        icon = <Icon source={CircleCancelMajor} color="critical" />;
        status = 'critical';
        break;
      default:
        icon = <Icon source={InfoMinor} color="base" />;
        status = 'new';
    }
    
    return (
      <Stack alignment="center" spacing="extraTight">
        {icon}
        <StatusBadge status={status}>{type}</StatusBadge>
      </Stack>
    );
  };
  
  // Format transaction description
  const getTransactionDescription = () => {
    if (!transaction) return '';
    
    const { type } = transaction;
    
    switch (type.toUpperCase()) {
      case 'ISSUE':
        return 'Credit issued to customer account';
      case 'REDEEM':
        return transaction.orderId 
          ? 'Credit redeemed for purchase' 
          : 'Credit redeemed';
      case 'ADJUST':
        return Number(transaction.amount) >= 0 
          ? 'Credit balance increased via adjustment' 
          : 'Credit balance decreased via adjustment';
      case 'CANCEL':
        return 'Credit canceled';
      default:
        return '';
    }
  };
  
  // Generate printable receipt content
  const getPrintableContent = () => {
    if (!transaction) return '';
    
    return `
      <html>
        <head>
          <title>Transaction Receipt - ${transaction.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .info-row { display: flex; margin-bottom: 10px; }
            .label { font-weight: bold; width: 150px; }
            .divider { border-top: 1px solid #ccc; margin: 15px 0; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Transaction Receipt</h2>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Date: ${formatDate(transaction.createdAt, true)}</p>
          </div>
          
          <div class="info-row">
            <div class="label">Type:</div>
            <div>${transaction.type}</div>
          </div>
          
          <div class="info-row">
            <div class="label">Amount:</div>
            <div>${formatCurrency(transaction.amount)}</div>
          </div>
          
          <div class="info-row">
            <div class="label">Balance After:</div>
            <div>${formatCurrency(transaction.balanceAfter)}</div>
          </div>
          
          ${transaction.note ? `
          <div class="info-row">
            <div class="label">Note:</div>
            <div>${transaction.note}</div>
          </div>
          ` : ''}
          
          <div class="divider"></div>
          
          ${transaction.customerId ? `
          <div class="info-row">
            <div class="label">Customer ID:</div>
            <div>${transaction.customerId}</div>
          </div>
          ` : ''}
          
          ${transaction.creditId ? `
          <div class="info-row">
            <div class="label">Credit ID:</div>
            <div>${transaction.creditId}</div>
          </div>
          ` : ''}
          
          ${transaction.staffId ? `
          <div class="info-row">
            <div class="label">Staff Member:</div>
            <div>${transaction.staffId}</div>
          </div>
          ` : ''}
          
          ${transaction.locationId ? `
          <div class="info-row">
            <div class="label">Location:</div>
            <div>${transaction.locationId}</div>
          </div>
          ` : ''}
          
          ${transaction.orderId ? `
          <div class="info-row">
            <div class="label">Order ID:</div>
            <div>${transaction.orderId}</div>
          </div>
          ` : ''}
          
          <div class="footer">
            <p>This is an electronic receipt for your records.</p>
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;
  };
  
  // Print transaction receipt
  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(getPrintableContent());
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card sectioned>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="large" />
        </div>
      </Card>
    );
  }

  // Render error
  if (error) {
    return (
      <Card sectioned>
        <Banner status="critical">{error}</Banner>
      </Card>
    );
  }

  // Render empty state
  if (!transaction) {
    return (
      <Card sectioned>
        <Banner status="info">No transaction details available.</Banner>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Card.Section>
          <Stack alignment="center">
            <Button
              icon={ArrowLeftMinor}
              onClick={onBack || (() => navigate(-1))}
              plain
            >
              Back
            </Button>
            <Text variant="headingLg" as="h2">
              Transaction Details
            </Text>
          </Stack>
        </Card.Section>

        <Card.Section>
          <Box paddingBlockEnd="400">
            <Stack distribution="equalSpacing" alignment="center">
              <Stack.Item>
                <Stack vertical spacing="tight">
                  <Text variant="bodyMd" color="subdued">Transaction ID</Text>
                  <Text variant="bodyLg" fontWeight="bold">{transaction.id}</Text>
                </Stack>
              </Stack.Item>
              <Stack.Item>
                {renderTypeWithIcon(transaction.type)}
              </Stack.Item>
            </Stack>
          </Box>

          <Divider />
          
          <Box paddingBlockStart="300" paddingBlockEnd="300">
            <Text variant="bodyMd">{getTransactionDescription()}</Text>
          </Box>
          
          <Divider />

          <Box paddingBlockStart="400">
            <Stack distribution="fillEvenly">
              <Stack.Item>
                <Stack vertical spacing="tight">
                  <Text variant="bodyMd" color="subdued">Amount</Text>
                  <Text variant="headingMd" fontWeight="bold">
                    {transaction.type === 'REDEEM' ? '-' : ''}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </Stack>
              </Stack.Item>
              <Stack.Item>
                <Stack vertical spacing="tight">
                  <Text variant="bodyMd" color="subdued">Balance After</Text>
                  <Text variant="headingMd" fontWeight="bold">
                    {formatCurrency(transaction.balanceAfter)}
                  </Text>
                </Stack>
              </Stack.Item>
              <Stack.Item>
                <Stack vertical spacing="tight">
                  <Text variant="bodyMd" color="subdued">Date</Text>
                  <Stack spacing="extraTight" alignment="center">
                    <Icon source={ClockMajor} color="base" />
                    <Text variant="bodyMd">{formatDate(transaction.createdAt, true)}</Text>
                  </Stack>
                </Stack>
              </Stack.Item>
            </Stack>
          </Box>
        </Card.Section>

        {transaction.note && (
          <Card.Section>
            <Stack spacing="tight" alignment="center">
              <Icon source={NoteMinor} color="base" />
              <Text variant="bodyMd" fontWeight="semibold">Note</Text>
            </Stack>
            <Box paddingBlockStart="200">
              <Text variant="bodyMd">{transaction.note}</Text>
            </Box>
          </Card.Section>
        )}

        <Card.Section title="Related Information">
          <Stack vertical spacing="loose">
            {transaction.creditId && (
              <Stack alignment="center" spacing="loose">
                <Stack.Item>
                  <Icon source={CreditCardMajor} color="base" />
                </Stack.Item>
                <Stack.Item fill>
                  <TextContainer spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">Credit</Text>
                    <Text variant="bodyMd">
                      <Link url={`/credits/${transaction.creditId}`} monochrome removeUnderline>
                        View credit details
                      </Link>
                    </Text>
                  </TextContainer>
                </Stack.Item>
              </Stack>
            )}

            {transaction.customerId && (
              <Stack alignment="center" spacing="loose">
                <Stack.Item>
                  <Icon source={CustomersMajor} color="base" />
                </Stack.Item>
                <Stack.Item fill>
                  <TextContainer spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">Customer</Text>
                    <Text variant="bodyMd">
                      <Link url={`/customers/${transaction.customerId}`} monochrome removeUnderline>
                        View customer details
                      </Link>
                    </Text>
                  </TextContainer>
                </Stack.Item>
              </Stack>
            )}

            {transaction.staffId && (
              <Stack alignment="center" spacing="loose">
                <Stack.Item>
                  <Icon source={UserMajor} color="base" />
                </Stack.Item>
                <Stack.Item fill>
                  <TextContainer spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">Staff</Text>
                    <Text variant="bodyMd">{transaction.staffId}</Text>
                  </TextContainer>
                </Stack.Item>
              </Stack>
            )}

            {transaction.locationId && (
              <Stack alignment="center" spacing="loose">
                <Stack.Item>
                  <Icon source={LocationMajor} color="base" />
                </Stack.Item>
                <Stack.Item fill>
                  <TextContainer spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">Location</Text>
                    <Text variant="bodyMd">{transaction.locationId}</Text>
                  </TextContainer>
                </Stack.Item>
              </Stack>
            )}

            {transaction.orderId && (
              <Stack alignment="center" spacing="loose">
                <Stack.Item>
                  <Icon source={OrdersMajor} color="base" />
                </Stack.Item>
                <Stack.Item fill>
                  <TextContainer spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">Order</Text>
                    <Text variant="bodyMd">
                      <Link url={`https://${transaction.shopDomain}/admin/orders/${transaction.orderId}`} external monochrome removeUnderline>
                        View order in Shopify
                      </Link>
                    </Text>
                  </TextContainer>
                </Stack.Item>
              </Stack>
            )}
          </Stack>
        </Card.Section>

        {showHistory && transaction.history && transaction.history.length > 0 && (
          <Card.Section title="Transaction History">
            <List type="bullet">
              {transaction.history.map((event, index) => (
                <List.Item key={index}>
                  {formatDate(event.timestamp, true)} - {event.action}
                  {event.user && ` by ${event.user}`}
                </List.Item>
              ))}
            </List>
          </Card.Section>
        )}

        <Card.Section>
          <Stack distribution="trailing">
            <ButtonGroup>
              <Button 
                icon={PrintMinor} 
                onClick={() => setIsPrintModalOpen(true)}
              >
                Print Receipt
              </Button>
              
              {canVoidTransaction && (
                <Button 
                  destructive 
                  onClick={() => setIsVoidModalOpen(true)}
                >
                  Void Transaction
                </Button>
              )}
              
              <Button 
                icon={ReportsMajor} 
                onClick={() => navigate('/reports/transactions')}
                disabled={!mdUp}
              >
                Transaction Reports
              </Button>
              
              <Button primary onClick={() => navigate('/transactions')}>
                All Transactions
              </Button>
            </ButtonGroup>
          </Stack>
        </Card.Section>
      </Card>
      
      {/* Void Transaction Modal */}
      <Modal
        open={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        title="Void Transaction"
        primaryAction={{
          content: 'Void Transaction',
          onAction: handleVoidTransaction,
          loading: isVoiding,
          destructive: true
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsVoidModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <Text variant="bodyMd">
              Are you sure you want to void this transaction? This action cannot be undone.
            </Text>
            <Text variant="bodyMd">
              Voiding this transaction will create a new reversal transaction that cancels out the effects of this transaction.
            </Text>
            <Box paddingBlockStart="400">
              <TextField
                label="Reason for voiding"
                value={voidReason}
                onChange={setVoidReason}
                autoComplete="off"
                placeholder="Enter reason for voiding this transaction"
                multiline={3}
                required
              />
            </Box>
            
            {voidError && (
              <Box paddingBlockStart="400">
                <Banner status="critical">{voidError}</Banner>
              </Box>
            )}
          </TextContainer>
        </Modal.Section>
      </Modal>
      
      {/* Print Preview Modal */}
      <Modal
        open={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Print Transaction Receipt"
        primaryAction={{
          content: 'Print',
          onAction: () => {
            printReceipt();
            setIsPrintModalOpen(false);
          },
          icon: PrintMinor
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsPrintModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <Text variant="bodyMd">
              Print a receipt for this transaction. This will open a print dialog in a new window.
            </Text>
            
            <Box paddingBlockStart="400">
              <Card sectioned>
                <Stack vertical>
                  <Stack distribution="equalSpacing">
                    <Text variant="headingMd">Transaction Receipt</Text>
                    <Text variant="bodyMd">{formatDate(transaction.createdAt)}</Text>
                  </Stack>
                  
                  <Divider />
                  
                  <Stack distribution="equalSpacing">
                    <Text variant="bodyMd">Transaction ID:</Text>
                    <Text variant="bodyMd">{transaction.id}</Text>
                  </Stack>
                  
                  <Stack distribution="equalSpacing">
                    <Text variant="bodyMd">Type:</Text>
                    <Text variant="bodyMd">{transaction.type}</Text>
                  </Stack>
                  
                  <Stack distribution="equalSpacing">
                    <Text variant="bodyMd">Amount:</Text>
                    <Text variant="bodyMd">{formatCurrency(transaction.amount)}</Text>
                  </Stack>
                  
                  <Stack distribution="equalSpacing">
                    <Text variant="bodyMd">Balance After:</Text>
                    <Text variant="bodyMd">{formatCurrency(transaction.balanceAfter)}</Text>
                  </Stack>
                  
                  {transaction.note && (
                    <Stack distribution="equalSpacing">
                      <Text variant="bodyMd">Note:</Text>
                      <Text variant="bodyMd">{transaction.note}</Text>
                    </Stack>
                  )}
                </Stack>
              </Card>
            </Box>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </>
  );
} 