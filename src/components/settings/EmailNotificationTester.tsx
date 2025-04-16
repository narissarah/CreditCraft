import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Stack,
  TextField,
  Select,
  Button,
  Banner,
  InlineStack,
  Box,
  Collapsible,
  HorizontalStack,
  ChoiceList,
  Spinner
} from '@shopify/polaris';
import { useAPI } from '../../hooks/useAPI';
import { useToast } from '../../hooks/useToast';
import { CustomerType } from '../../types/customer';
import { CreditType } from '../../types/credit';

interface EmailNotificationTesterProps {
  customer?: CustomerType;
}

export const EmailNotificationTester: React.FC<EmailNotificationTesterProps> = ({ customer }) => {
  const [notificationType, setNotificationType] = useState('credit-issued');
  const [customerId, setCustomerId] = useState(customer?.id || '');
  const [customerEmail, setCustomerEmail] = useState(customer?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [loading, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showBatchOptions, setShowBatchOptions] = useState(false);
  const [batchType, setBatchType] = useState('expiration-reminder');
  const [daysUntilExpiration, setDaysUntilExpiration] = useState('7');
  const [credits, setCredits] = useState<CreditType[]>([]);
  const [selectedCreditId, setSelectedCreditId] = useState('');
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  const api = useAPI();
  const { showToast } = useToast();
  
  // Load customer credits when customer changes
  useEffect(() => {
    if (!customerId) return;
    
    const fetchCredits = async () => {
      try {
        setLoadingCredits(true);
        const response = await api.get(`/customers/${customerId}/credits`);
        setCredits(response.data.credits || []);
        
        // Auto-select the first credit if available
        if (response.data.credits && response.data.credits.length > 0) {
          setSelectedCreditId(response.data.credits[0].id);
        }
      } catch (err) {
        console.error('Error fetching customer credits:', err);
      } finally {
        setLoadingCredits(false);
      }
    };
    
    fetchCredits();
  }, [customerId, api]);
  
  // Load credit transactions when credit changes
  useEffect(() => {
    if (!selectedCreditId) return;
    
    const fetchTransactions = async () => {
      try {
        setLoadingTransactions(true);
        const response = await api.get(`/credits/${selectedCreditId}/transactions`);
        setTransactions(response.data.transactions || []);
        
        // Auto-select the first transaction if available
        if (response.data.transactions && response.data.transactions.length > 0) {
          setSelectedTransactionId(response.data.transactions[0].id);
        }
      } catch (err) {
        console.error('Error fetching credit transactions:', err);
      } finally {
        setLoadingTransactions(false);
      }
    };
    
    fetchTransactions();
  }, [selectedCreditId, api]);
  
  // Update custom fields visibility when notification type changes
  useEffect(() => {
    setShowCustomFields(notificationType === 'custom');
    
    if (notificationType === 'custom' && !subject) {
      setSubject('Important update about your store credit');
    }
  }, [notificationType, subject]);
  
  // Send a test notification
  const sendTestNotification = async () => {
    if (!customerId) {
      setError('A customer must be selected');
      return;
    }
    
    try {
      setSending(true);
      setError('');
      
      const payload: Record<string, any> = {
        customerId,
        notificationType
      };
      
      if (notificationType === 'credit-issued' || notificationType === 'credit-expiring') {
        if (!selectedCreditId) {
          setError(`A credit must be selected for ${notificationType} notifications`);
          setSending(false);
          return;
        }
        payload.creditId = selectedCreditId;
      }
      
      if (notificationType === 'credit-expiring') {
        payload.daysUntilExpiration = parseInt(daysUntilExpiration);
      }
      
      if (notificationType === 'credit-redeemed') {
        if (!selectedCreditId || !selectedTransactionId) {
          setError('A credit and transaction must be selected for credit redemption notifications');
          setSending(false);
          return;
        }
        payload.creditId = selectedCreditId;
        payload.transactionId = selectedTransactionId;
      }
      
      if (notificationType === 'custom') {
        if (!subject || !message) {
          setError('Subject and message are required for custom notifications');
          setSending(false);
          return;
        }
        
        payload.subject = subject;
        payload.message = message;
      }
      
      const response = await api.post('/notifications/test', payload);
      
      showToast('Test notification has been scheduled', 'success');
      console.log('Notification job ID:', response.data.jobId);
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError('Failed to send test notification');
      showToast('Failed to send test notification', 'error');
    } finally {
      setSending(false);
    }
  };
  
  // Send a batch notification
  const sendBatchNotification = async () => {
    try {
      setSending(true);
      setError('');
      
      let payload;
      
      switch (batchType) {
        case 'expiration-reminder':
          payload = {
            type: batchType,
            data: {
              days: parseInt(daysUntilExpiration, 10)
            }
          };
          break;
          
        default:
          setError('Invalid batch notification type');
          setSending(false);
          return;
      }
      
      const response = await api.post('/notifications/batch', payload);
      
      showToast('Batch notification job started successfully', 'success');
      console.log('Batch job ID:', response.data.jobId);
    } catch (err) {
      console.error('Error sending batch notification:', err);
      setError('Failed to send batch notification');
      showToast('Failed to send batch notification', 'error');
    } finally {
      setSending(false);
    }
  };
  
  // Credit options for select dropdown
  const creditOptions = credits.map(credit => ({
    label: `${credit.code} - $${credit.balance} (${credit.status})`,
    value: credit.id
  }));
  
  // Transaction options for select dropdown
  const transactionOptions = transactions.map(transaction => ({
    label: `${transaction.type} - $${transaction.amount} (${new Date(transaction.timestamp).toLocaleDateString()})`,
    value: transaction.id
  }));
  
  return (
    <Card>
      <Card.Section title="Email Notification Tester">
        <Stack vertical spacing="tight">
          <Text as="p">
            Use this tool to send test notifications to verify your email configuration.
          </Text>
          
          {error && (
            <Banner status="critical">
              <p>{error}</p>
            </Banner>
          )}
          
          <HorizontalStack align="space-between">
            <Stack vertical spacing="tight">
              <Button 
                plain 
                disclosure={showBatchOptions ? 'up' : 'down'} 
                onClick={() => setShowBatchOptions(!showBatchOptions)}
              >
                {showBatchOptions 
                  ? 'Hide batch notification options' 
                  : 'Show batch notification options'}
              </Button>
            </Stack>
          </HorizontalStack>
          
          <Collapsible
            open={showBatchOptions}
            id="batch-options"
          >
            <Card>
              <Card.Section title="Batch Notification">
                <Stack vertical spacing="tight">
                  <Select
                    label="Notification Type"
                    options={[
                      { label: 'Expiration Reminder', value: 'expiration-reminder' }
                    ]}
                    value={batchType}
                    onChange={setBatchType}
                    helpText="Select the type of batch notification to send"
                  />
                  
                  {batchType === 'expiration-reminder' && (
                    <TextField
                      label="Days Until Expiration"
                      type="number"
                      value={daysUntilExpiration}
                      onChange={setDaysUntilExpiration}
                      autoComplete="off"
                      helpText="Send reminders for credits expiring in this many days"
                    />
                  )}
                  
                  <Box paddingBlockStart="400">
                    <Button
                      primary
                      loading={loading}
                      onClick={sendBatchNotification}
                    >
                      Send Batch Notification
                    </Button>
                  </Box>
                </Stack>
              </Card.Section>
            </Card>
          </Collapsible>
          
          <Box paddingBlockStart="400">
            <Card.Subsection>
              <Stack vertical spacing="tight">
                <Text variant="headingMd" as="h3">
                  Individual Test Notification
                </Text>
                
                <TextField
                  label="Customer ID"
                  value={customerId}
                  onChange={setCustomerId}
                  autoComplete="off"
                  disabled={!!customer}
                  helpText={customerEmail ? `Email: ${customerEmail}` : 'Enter the customer ID to send a test notification'}
                />
                
                <Select
                  label="Notification Type"
                  options={[
                    { label: 'Credit Issued', value: 'credit-issued' },
                    { label: 'Credit Expiring', value: 'credit-expiring' },
                    { label: 'Credit Redeemed', value: 'credit-redeemed' },
                    { label: 'Custom Message', value: 'custom' }
                  ]}
                  value={notificationType}
                  onChange={setNotificationType}
                  helpText="Select the type of notification to test"
                />
                
                {(notificationType === 'credit-issued' || notificationType === 'credit-expiring' || notificationType === 'credit-redeemed') && (
                  <div>
                    {loadingCredits ? (
                      <Box padding="400" textAlign="center">
                        <Spinner size="small" accessibilityLabel="Loading credits" />
                      </Box>
                    ) : (
                      <Select
                        label="Credit"
                        options={creditOptions.length > 0 
                          ? creditOptions 
                          : [{ label: 'No credits available', value: '' }]}
                        value={selectedCreditId}
                        onChange={setSelectedCreditId}
                        disabled={creditOptions.length === 0}
                        helpText="Select the credit for this notification"
                      />
                    )}
                  </div>
                )}
                
                {notificationType === 'credit-expiring' && (
                  <TextField
                    label="Days Until Expiration"
                    type="number"
                    value={daysUntilExpiration}
                    onChange={setDaysUntilExpiration}
                    autoComplete="off"
                    helpText="How many days until the credit expires"
                  />
                )}
                
                {notificationType === 'credit-redeemed' && (
                  <div>
                    {loadingTransactions ? (
                      <Box padding="400" textAlign="center">
                        <Spinner size="small" accessibilityLabel="Loading transactions" />
                      </Box>
                    ) : (
                      <Select
                        label="Transaction"
                        options={transactionOptions.length > 0 
                          ? transactionOptions 
                          : [{ label: 'No transactions available', value: '' }]}
                        value={selectedTransactionId}
                        onChange={setSelectedTransactionId}
                        disabled={transactionOptions.length === 0}
                        helpText="Select the transaction for this notification"
                      />
                    )}
                  </div>
                )}
                
                <Collapsible
                  open={showCustomFields}
                  id="custom-notification-fields"
                >
                  <Stack vertical spacing="tight">
                    <TextField
                      label="Subject"
                      value={subject}
                      onChange={setSubject}
                      autoComplete="off"
                      error={showCustomFields && !subject ? 'Subject is required' : undefined}
                      helpText="Email subject line"
                    />
                    
                    <TextField
                      label="Message"
                      value={message}
                      onChange={setMessage}
                      multiline={4}
                      autoComplete="off"
                      error={showCustomFields && !message ? 'Message is required' : undefined}
                      helpText="Custom message body"
                    />
                  </Stack>
                </Collapsible>
                
                <Box paddingBlockStart="400">
                  <Button 
                    primary
                    onClick={sendTestNotification}
                    loading={loading}
                    disabled={loading || !customerId}
                  >
                    Send Test Notification
                  </Button>
                </Box>
              </Stack>
            </Card.Subsection>
          </Box>
        </Stack>
      </Card.Section>
    </Card>
  );
};

export default EmailNotificationTester; 