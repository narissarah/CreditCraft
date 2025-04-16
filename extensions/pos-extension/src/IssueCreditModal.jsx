import {
  reactExtension,
  useApi,
  Modal,
  TextField,
  BlockStack,
  InlineStack,
  Button,
  Text,
  View,
  Divider,
  Spinner,
  Banner,
  Select,
  useContainer
} from '@shopify/ui-extensions-react/point-of-sale';
import { useState, useCallback, useEffect } from 'react';
import { formatCurrency } from './utils';

/**
 * Issue Credit Modal Component
 * 
 * Allows staff to issue store credit to customers from POS
 * Includes customer selection, amount input, reason selection and location tracking
 */
function IssueCreditModal() {
  const { modal, session, toast, global } = useApi();
  const container = useContainer();
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('store_policy');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState(null);

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch available locations on component mount
  useEffect(() => {
    const fetchLocations = async () => {
      if (!isOnline) return;
      
      try {
        const token = await session.getSessionToken();
        const response = await fetch('/api/pos/locations', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-POS-Device-ID': session.device?.id || '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch locations');
        }

        const data = await response.json();
        setLocations(data.locations || []);
        
        // Set current location as default if available
        if (data.currentLocation) {
          setSelectedLocation(data.currentLocation.id);
        } else if (data.locations?.length > 0) {
          setSelectedLocation(data.locations[0].id);
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
        toast.show('Failed to load locations');
      }
    };

    fetchLocations();
  }, [session, toast, isOnline]);

  // Search for customers
  const handleSearch = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 3) {
      toast.show('Please enter at least 3 characters to search');
      return;
    }

    setSearchLoading(true);
    setError(null);
    
    try {
      const token = await session.getSessionToken();
      const response = await fetch(`/api/pos/customers/search?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-POS-Device-ID': session.device?.id || '',
        }
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.customers || []);
      
      if (data.customers?.length === 0) {
        toast.show('No customers found');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search for customers. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, session, toast]);

  // Select a customer
  const selectCustomer = useCallback((customer) => {
    setCustomerId(customer.id);
    setCustomerName(`${customer.firstName} ${customer.lastName}`);
    setSearchResults([]);
    setSearchQuery('');
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Validate input
    if (!customerId) {
      setError('Please select a customer');
      return;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!selectedLocation && isOnline) {
      setError('Please select a location');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const creditData = {
        customerId,
        amount: parseFloat(amount),
        reason,
        note: note || undefined,
        locationId: selectedLocation || undefined,
        offlineMode: !isOnline
      };

      // If offline, store transaction for later sync
      if (!isOnline) {
        const offlineTransactions = JSON.parse(localStorage.getItem('offlineCredits') || '[]');
        
        offlineTransactions.push({
          ...creditData,
          customerName,
          timestamp: new Date().toISOString(),
          id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        });
        
        localStorage.setItem('offlineCredits', JSON.stringify(offlineTransactions));
        
        // Show success message
        toast.show('Credit saved for processing when back online');
        global.alert({
          title: 'Offline Credit Issued',
          message: `A credit of ${formatCurrency(parseFloat(amount))} has been issued to ${customerName} and will be processed when your device is back online.`
        });
        
        modal.close();
        return;
      }

      // Online transaction
      const token = await session.getSessionToken();
      const response = await fetch('/api/pos/issue-credit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-POS-Device-ID': session.device?.id || '',
        },
        body: JSON.stringify(creditData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to issue credit');
      }

      const data = await response.json();
      
      // Show success message
      toast.show('Credit issued successfully');
      global.alert({
        title: 'Credit Issued',
        message: `A credit of ${formatCurrency(parseFloat(amount))} has been issued to ${customerName}.`
      });
      
      modal.close();
    } catch (err) {
      console.error('Error issuing credit:', err);
      setError(err instanceof Error ? err.message : 'Failed to issue credit');
    } finally {
      setLoading(false);
    }
  }, [customerId, customerName, amount, reason, note, selectedLocation, isOnline, session, toast, global, modal]);

  // Reason options
  const reasonOptions = [
    { label: 'Store Policy', value: 'store_policy' },
    { label: 'Customer Satisfaction', value: 'customer_satisfaction' },
    { label: 'Product Return', value: 'product_return' },
    { label: 'Promotion', value: 'promotion' },
    { label: 'Other', value: 'other' }
  ];

  return (
    <Modal
      title="Issue Store Credit"
      primaryAction={{
        content: 'Issue Credit',
        onAction: handleSubmit,
        loading: loading
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: () => modal.close()
        }
      ]}
    >
      <BlockStack spacing="tight">
        {!isOnline && (
          <Banner status="warning">
            <Text>You are currently offline. Credits issued will be processed when your device reconnects.</Text>
          </Banner>
        )}
        
        {error && (
          <Banner status="critical">
            <Text>{error}</Text>
          </Banner>
        )}
        
        <BlockStack spacing="tight">
          <Text emphasis="bold">Customer</Text>
          {customerId ? (
            <InlineStack spacing="tight" blockAlignment="center">
              <View>
                <Text emphasis="bold">{customerName}</Text>
              </View>
              <Button size="slim" plain onPress={() => {
                setCustomerId('');
                setCustomerName('');
              }}>
                Change
              </Button>
            </InlineStack>
          ) : (
            <BlockStack spacing="tight">
              <InlineStack spacing="none" blockAlignment="center">
                <TextField
                  label="Search for customer"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onEnter={handleSearch}
                />
                <Button
                  kind="primary"
                  loading={searchLoading}
                  onPress={handleSearch}
                >
                  Search
                </Button>
              </InlineStack>
              
              {searchResults.length > 0 && (
                <View border="base" padding="base">
                  <BlockStack spacing="tight">
                    <Text emphasis="bold">Select a customer</Text>
                    {searchResults.map(customer => (
                      <Button
                        key={customer.id}
                        kind="plain"
                        onPress={() => selectCustomer(customer)}
                      >
                        <Text emphasis="bold">{customer.firstName} {customer.lastName}</Text>
                        <Text size="small">{customer.email}</Text>
                      </Button>
                    ))}
                  </BlockStack>
                </View>
              )}
            </BlockStack>
          )}
        </BlockStack>
        
        <Divider />
        
        <BlockStack spacing="tight">
          <TextField
            label="Credit Amount"
            type="currency"
            value={amount}
            onChange={setAmount}
            prefix="$"
            required
            disabled={loading}
          />
          
          <Select
            label="Reason"
            options={reasonOptions}
            value={reason}
            onChange={setReason}
            disabled={loading}
          />
          
          <TextField
            label="Note (Optional)"
            value={note}
            onChange={setNote}
            multiline={2}
            disabled={loading}
          />
          
          {isOnline && locations.length > 0 && (
            <Select
              label="Location"
              options={locations.map(loc => ({ label: loc.name, value: loc.id }))}
              value={selectedLocation}
              onChange={setSelectedLocation}
              disabled={loading}
            />
          )}
        </BlockStack>
      </BlockStack>
    </Modal>
  );
}

export default reactExtension(
  "pos.home.modal.render",
  () => <IssueCreditModal />
); 