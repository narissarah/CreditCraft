import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  extend,
  Banner,
  Button,
  ButtonGroup,
  Card,
  DataTable,
  EmptyState,
  Icon,
  InlineStack,
  Layout,
  Link,
  List,
  Page,
  Spinner,
  Text,
  TextField,
  Tooltip
} from '@shopify/retail-ui-extensions';
import {
  AlertDiamondIcon,
  CustomerIcon,
  CashDollarIcon,
  PrinterIcon,
  SyncIcon,
  ClockIcon,
  AddIcon,
  CancelIcon
} from '@shopify/retail-ui-extensions-icons';
import { useCustomer, useExtensionApi, useSessionToken } from '@shopify/retail-ui-extensions-react';

import { 
  createOfflineSyncManager, 
  formatCurrency, 
  formatDate, 
  createLogger 
} from './utils';

/**
 * CreditManagement Component - Advanced POS Features
 * 
 * Handles credit issuance, viewing, and management with offline support
 */
function CreditManagement() {
  // Extension API access for POS functionality
  const extensionApi = useExtensionApi();
  const { customer } = useCustomer();
  const getSessionToken = useSessionToken();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [credits, setCredits] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  
  // Credit issuance form state
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create offline sync manager and logger
  const syncManagerRef = useRef(null);
  const loggerRef = useRef(null);

  // Create sync manager and logger on component mount
  useEffect(() => {
    if (!syncManagerRef.current) {
      syncManagerRef.current = createOfflineSyncManager(getSessionToken);
    }
    
    if (!loggerRef.current) {
      loggerRef.current = createLogger('CreditManagement', true);
    }
  }, [getSessionToken]);

  // Monitor online status and trigger sync when coming back online
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      const newOnlineStatus = navigator.onLine;
      setIsOnline(newOnlineStatus);
      
      // If coming back online, try to sync
      if (newOnlineStatus && !isOnline) {
        syncOfflineData();
      }
      
      loggerRef.current.info(`Network status changed to ${newOnlineStatus ? 'online' : 'offline'}`);
    };
    
    // Add event listeners for online/offline events
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Set initial online status
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, [isOnline]);

  // Load credits when customer changes
  useEffect(() => {
    if (customer?.id) {
      loadCustomerCredits();
    } else {
      setCredits([]);
      setIsLoading(false);
    }
  }, [customer?.id]);

  // Update pending transactions count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      if (syncManagerRef.current) {
        const count = await syncManagerRef.current.getPendingTransactionsCount();
        setPendingOfflineCount(count);
      }
    };
    
    updatePendingCount();
    const intervalId = setInterval(updatePendingCount, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Listen for offline sync status events
  useEffect(() => {
    const handleSyncStatus = (event) => {
      const { type, error } = event.detail;
      
      if (type === 'sync_start') {
        setIsSyncing(true);
        setSuccessMessage('');
        setErrorMessage('');
      } else if (type === 'sync_complete') {
        setIsSyncing(false);
        setSuccessMessage('Synchronization completed successfully');
        
        // Reload credits after successful sync
        if (customer?.id) {
          loadCustomerCredits();
        }
      } else if (type === 'sync_error') {
        setIsSyncing(false);
        setErrorMessage(`Synchronization failed: ${error}`);
      }
    };
    
    window.addEventListener('offline_sync_status', handleSyncStatus);
    
    return () => {
      window.removeEventListener('offline_sync_status', handleSyncStatus);
    };
  }, [customer?.id]);

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} API response as JSON
   */
  const authenticatedRequest = useCallback(async (endpoint, options = {}) => {
    try {
      const token = await getSessionToken();
      
      const response = await fetch(`${process.env.API_BASE_URL || 'https://api.creditcraft.com'}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(options.headers || {})
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      loggerRef.current.error(`API request failed: ${endpoint}`, { error: error.message });
      throw error;
    }
  }, [getSessionToken]);

  /**
   * Load customer credits
   */
  const loadCustomerCredits = useCallback(async () => {
    if (!customer?.id) return;
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Try to get from server if online
      if (navigator.onLine) {
        try {
          const data = await authenticatedRequest(`/api/customers/${customer.id}/credits`);
          
          // Store credits for offline use
          if (syncManagerRef.current) {
            await syncManagerRef.current.storeOfflineData(`customer_${customer.id}_credits`, data);
          }
          
          setCredits(data);
          loggerRef.current.info(`Loaded ${data.length} credits from server for customer ${customer.id}`);
        } catch (error) {
          loggerRef.current.warn(`Failed to load credits from server: ${error.message}`);
          
          // Try to load from offline storage
          loadOfflineCredits();
        }
      } else {
        // If offline, load from storage
        loadOfflineCredits();
      }
    } catch (error) {
      loggerRef.current.error(`Failed to load credits: ${error.message}`);
      setErrorMessage(`Error loading credits: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id, authenticatedRequest]);

  /**
   * Load credits from offline storage
   */
  const loadOfflineCredits = useCallback(async () => {
    if (!customer?.id || !syncManagerRef.current) return;
    
    try {
      const offlineCredits = await syncManagerRef.current.getOfflineData(`customer_${customer.id}_credits`);
      
      if (offlineCredits) {
        setCredits(offlineCredits);
        loggerRef.current.info(`Loaded ${offlineCredits.length} credits from offline storage for customer ${customer.id}`);
      } else {
        setCredits([]);
        loggerRef.current.info(`No offline credits found for customer ${customer.id}`);
      }
    } catch (error) {
      loggerRef.current.error(`Failed to load offline credits: ${error.message}`);
      setErrorMessage(`Error loading offline credits: ${error.message}`);
      setCredits([]);
    }
  }, [customer?.id]);

  /**
   * Sync offline data with server
   */
  const syncOfflineData = useCallback(async () => {
    if (!syncManagerRef.current || !navigator.onLine) return;
    
    try {
      const result = await syncManagerRef.current.synchronizeWithServer();
      loggerRef.current.info('Sync result', result);
      
      // If sync was successful and we have a customer, reload their credits
      if (result.success && customer?.id) {
        loadCustomerCredits();
      }
      
      return result;
    } catch (error) {
      loggerRef.current.error(`Synchronization failed: ${error.message}`);
      setErrorMessage(`Synchronization failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }, [customer?.id, loadCustomerCredits]);

  /**
   * Issue credit to customer
   */
  const issueCredit = useCallback(async () => {
    if (!customer?.id) {
      setErrorMessage('No customer selected');
      return;
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }
    
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    const creditData = {
      customerId: customer.id,
      amount: parseFloat(amount),
      reason: reason || 'Store credit',
      notes: notes || '',
      location: extensionApi.storeDetails?.name || 'Unknown location',
      staffMember: extensionApi.user?.displayName || 'Unknown staff',
      orderId: null,
      metadata: {
        source: 'pos',
        issuedOffline: !navigator.onLine,
        deviceId: extensionApi.deviceId || 'unknown'
      }
    };
    
    try {
      // If online, try to issue directly
      if (navigator.onLine) {
        try {
          const response = await authenticatedRequest('/api/credits', {
            method: 'POST',
            body: JSON.stringify(creditData)
          });
          
          loggerRef.current.info('Credit issued successfully', { creditId: response.id });
          setSuccessMessage(`Credit for ${formatCurrency(parseFloat(amount))} issued successfully`);
          
          // Reload credits
          loadCustomerCredits();
          
          // Clear form
          resetForm();
        } catch (error) {
          // If online request fails, store offline
          loggerRef.current.warn(`Online credit issuance failed: ${error.message}`);
          await storeOfflineCredit(creditData);
        }
      } else {
        // If offline, store for later sync
        await storeOfflineCredit(creditData);
      }
    } catch (error) {
      loggerRef.current.error(`Failed to issue credit: ${error.message}`);
      setErrorMessage(`Failed to issue credit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [customer?.id, amount, reason, notes, authenticatedRequest, loadCustomerCredits, extensionApi]);

  /**
   * Store credit offline for later sync
   */
  const storeOfflineCredit = useCallback(async (creditData) => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not available');
    }
    
    try {
      // Generate temporary ID for UI
      const tempCredit = {
        ...creditData,
        id: `offline_${Date.now()}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        offlinePending: true
      };
      
      // Add to UI immediately
      setCredits(prevCredits => [tempCredit, ...prevCredits]);
      
      // Store in offline transactions
      await syncManagerRef.current.storeOfflineTransaction('CREDIT_ISSUE', creditData);
      
      loggerRef.current.info('Credit stored for offline sync', { creditData });
      setSuccessMessage(`Credit for ${formatCurrency(parseFloat(amount))} stored offline and will sync when online`);
      
      // Update pending count
      const count = await syncManagerRef.current.getPendingTransactionsCount();
      setPendingOfflineCount(count);
      
      // Clear form
      resetForm();
    } catch (error) {
      loggerRef.current.error(`Failed to store offline credit: ${error.message}`);
      throw error;
    }
  }, [amount]);

  /**
   * Reset the credit form
   */
  const resetForm = useCallback(() => {
    setAmount('');
    setReason('');
    setNotes('');
  }, []);

  /**
   * Print credit receipt
   */
  const printCreditReceipt = useCallback(async (credit) => {
    try {
      // Get the current location/store from the extension API
      const locationName = extensionApi.storeDetails?.name || 'Unknown Location';
      const locationAddress = extensionApi.storeDetails?.address?.formatted || 'Unknown Address';
      
      // Format customer name
      const customerName = customer?.firstName && customer?.lastName 
        ? `${customer.firstName} ${customer.lastName}`
        : customer?.displayName || 'Customer';
      
      // Format date and credit details
      const dateIssued = formatDate(credit.createdAt);
      const formattedAmount = formatCurrency(credit.amount);
      const creditId = credit.id || 'PENDING';
      
      // Create receipt content
      const receipt = {
        title: 'STORE CREDIT',
        sections: [
          {
            elements: [
              { type: 'header', value: 'STORE CREDIT ISSUED' },
              { type: 'text', value: `${locationName}` },
              { type: 'text', value: `${locationAddress}` },
              { type: 'divider' },
              { type: 'text', value: `Customer: ${customerName}` },
              { type: 'text', value: `Date: ${dateIssued}` },
              { type: 'text', value: `Credit ID: ${creditId}` },
              { type: 'divider' },
              { type: 'text', value: `Amount: ${formattedAmount}`, bold: true },
              { type: 'text', value: `Reason: ${credit.reason || 'Store Credit'}` },
              credit.notes ? { type: 'text', value: `Notes: ${credit.notes}` } : null,
              { type: 'divider' },
              { type: 'text', value: `Issued by: ${credit.staffMember || extensionApi.user?.displayName || 'Staff'}` },
              { type: 'barcode', value: creditId, format: 'code128' },
              { type: 'divider' },
              { type: 'text', value: 'Keep this receipt for your records.' },
              { type: 'text', value: 'Present this receipt or your ID to redeem.' },
            ].filter(Boolean)
          }
        ]
      };
      
      // Print the receipt
      await extensionApi.printReceipt(receipt);
      
      // Log the action
      loggerRef.current.info('Credit receipt printed', { creditId: credit.id });
      
      // Store offline if needed
      if (!navigator.onLine && syncManagerRef.current) {
        await syncManagerRef.current.storeOfflineTransaction('RECEIPT_METADATA', {
          creditId: credit.id,
          customerId: customer?.id,
          receiptType: 'credit_issuance',
          printedAt: new Date().toISOString(),
          staffMember: extensionApi.user?.displayName,
          location: locationName
        });
      }
      
      return true;
    } catch (error) {
      loggerRef.current.error(`Failed to print receipt: ${error.message}`);
      setErrorMessage(`Failed to print receipt: ${error.message}`);
      return false;
    }
  }, [customer, extensionApi]);

  // Prepare credits data for display
  const creditRows = credits.map(credit => [
    formatDate(credit.createdAt),
    formatCurrency(credit.amount),
    credit.status || 'PENDING',
    credit.reason || 'Store Credit',
    credit.offlinePending ? 'Pending Sync' : 'Ready',
    <Button
      key={`print-${credit.id}`}
      variant="plain"
      accessibilityLabel="Print receipt"
      onPress={() => printCreditReceipt(credit)}
      disabled={isSubmitting}
      icon={<Icon source={PrinterIcon} />}
    />
  ]);

  // Get customer name for display
  const customerName = customer?.firstName && customer?.lastName 
    ? `${customer.firstName} ${customer.lastName}`
    : customer?.displayName || '';

  return (
    <Page title="Customer Credit Management">
      {/* Status messages */}
      {errorMessage && (
        <Banner tone="critical" icon={<Icon source={AlertDiamondIcon} />} onDismiss={() => setErrorMessage('')}>
          <Text>{errorMessage}</Text>
        </Banner>
      )}
      
      {successMessage && (
        <Banner tone="success" onDismiss={() => setSuccessMessage('')}>
          <Text>{successMessage}</Text>
        </Banner>
      )}
      
      {!isOnline && (
        <Banner tone="warning">
          <Text>You are currently offline. Credit operations will be synchronized when you're back online.</Text>
        </Banner>
      )}
      
      {isOnline && pendingOfflineCount > 0 && (
        <Banner tone="info">
          <InlineStack align="space-between">
            <Text>You have {pendingOfflineCount} pending transaction(s) to sync.</Text>
            <Button
              variant="plain"
              onPress={syncOfflineData}
              disabled={isSyncing}
              icon={<Icon source={SyncIcon} animate={isSyncing} />}
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </InlineStack>
        </Banner>
      )}
      
      <Layout>
        {/* Customer Information */}
        <Card title="Customer Information">
          {customer ? (
            <InlineStack align="start" gap="400">
              <Icon source={CustomerIcon} />
              <Text>{customerName}</Text>
              {customer.email && <Text variant="subdued">{customer.email}</Text>}
              {customer.phone && <Text variant="subdued">{customer.phone}</Text>}
            </InlineStack>
          ) : (
            <Text>No customer selected. Please select a customer to manage credits.</Text>
          )}
        </Card>
        
        {/* Issue Credit Form */}
        {customer && (
          <Card title="Issue Credit">
            <Layout>
              <TextField
                label="Amount"
                value={amount}
                onChange={setAmount}
                type="currency"
                prefix="$"
                disabled={isSubmitting}
                maxWidth="200px"
              />
              
              <TextField
                label="Reason"
                value={reason}
                onChange={setReason}
                placeholder="e.g., Return, Promotion, Store Policy"
                disabled={isSubmitting}
              />
              
              <TextField
                label="Notes (Optional)"
                value={notes}
                onChange={setNotes}
                placeholder="Any additional information"
                multiline={3}
                disabled={isSubmitting}
              />
              
              <ButtonGroup>
                <Button 
                  variant="primary" 
                  onPress={issueCredit} 
                  disabled={isSubmitting || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
                  loading={isSubmitting}
                  icon={<Icon source={CashDollarIcon} />}
                >
                  Issue Credit
                </Button>
                
                <Button 
                  variant="plain" 
                  onPress={resetForm} 
                  disabled={isSubmitting || (!amount && !reason && !notes)}
                  icon={<Icon source={CancelIcon} />}
                >
                  Clear
                </Button>
              </ButtonGroup>
            </Layout>
          </Card>
        )}
        
        {/* Credits List */}
        <Card title="Credit History">
          {isLoading ? (
            <InlineStack align="center">
              <Spinner size="large" />
              <Text>Loading credits...</Text>
            </InlineStack>
          ) : creditRows.length > 0 ? (
            <DataTable 
              headings={['Date', 'Amount', 'Status', 'Reason', 'Sync Status', 'Actions']}
              rows={creditRows}
            />
          ) : (
            <EmptyState
              image="https://cdn.shopify.com/s/files/1/0/shopify-pos/assets/empty-states/credit.svg"
              heading="No credits found"
              action={{
                content: 'Issue Credit',
                onAction: () => {
                  // Focus the amount field
                  document.querySelector('input[type="currency"]')?.focus();
                },
                disabled: !customer
              }}
            >
              <Text>This customer doesn't have any credits yet.</Text>
            </EmptyState>
          )}
        </Card>
        
        {/* Help Information */}
        <Card title="About Customer Credits">
          <Text>Customer credits can be used during checkout or managed here. Credits issued offline will sync when you reconnect.</Text>
          
          <Text variant="headingMd" as="h3">How to use:</Text>
          <List>
            <List.Item>Enter the credit amount and reason</List.Item>
            <List.Item>Click "Issue Credit" to create the credit</List.Item>
            <List.Item>Print a receipt for the customer's records</List.Item>
            <List.Item>Credits will automatically be available during checkout</List.Item>
          </List>
          
          <InlineStack align="center" gap="400">
            <Icon source={ClockIcon} />
            <Text variant="subdued">Credits synced offline will appear with a "Pending" status until connection is restored.</Text>
          </InlineStack>
        </Card>
      </Layout>
    </Page>
  );
}

export default CreditManagement; 