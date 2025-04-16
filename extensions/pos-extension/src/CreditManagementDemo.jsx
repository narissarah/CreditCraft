import React, { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  VerticalStack, 
  HorizontalStack, 
  Banner, 
  Spinner,
  Tabs,
  Modal
} from '@shopify/polaris';
import { useAppBridge } from './hooks/useAppBridge';
import { useLocationManager } from './utils/locationManager';
import { useReceiptManager } from './utils/receiptManager';
import { useOfflineManager } from './utils/offlineManager';
import CreditAnalytics from './components/CreditAnalytics';

/**
 * Demo component showcasing integration of all POS extension utilities
 */
export default function CreditManagementDemo() {
  const { fetchWithAuth, showToast, getPosContext } = useAppBridge();
  const { 
    currentLocation, 
    locations, 
    isLoading: locationLoading,
    fetchLocations
  } = useLocationManager();
  
  const {
    isLoading: receiptLoading,
    addCreditIssuanceToReceipt,
    createStandaloneCreditReceipt
  } = useReceiptManager();
  
  const {
    isOnline,
    hasPendingOperations,
    pendingCount,
    pendingAmount,
    syncInProgress,
    syncWithServer,
    offlineCredits
  } = useOfflineManager();
  
  const [posContext, setPosContext] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState(null);
  
  // Get POS context
  useEffect(() => {
    async function getContext() {
      try {
        const context = await getPosContext();
        setPosContext(context);
        
        // If cart has a customer, fetch their details
        if (context?.cart?.customer?.id) {
          await fetchCustomer(context.cart.customer.id);
        }
      } catch (err) {
        console.error('Error getting POS context:', err);
        setError('Failed to get POS context');
      }
    }
    
    getContext();
  }, [getPosContext]);
  
  // Fetch customer details and credits
  const fetchCustomer = async (customerId) => {
    if (!customerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth(`/api/customers/${customerId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch customer');
      }
      
      const customerData = await response.json();
      setCustomer(customerData);
      
      // Fetch customer credits
      await fetchCustomerCredits(customerId);
      
    } catch (err) {
      console.error('Error fetching customer:', err);
      setError(err.message || 'Failed to fetch customer details');
      showToast('Failed to load customer data', 'critical');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch customer credits
  const fetchCustomerCredits = async (customerId) => {
    try {
      const response = await fetchWithAuth(`/api/customers/${customerId}/credits`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch credits');
      }
      
      const creditsData = await response.json();
      setCredits(creditsData.credits || []);
      
    } catch (err) {
      console.error('Error fetching credits:', err);
      setError(err.message || 'Failed to fetch customer credits');
    }
  };
  
  // Handle credit issuance
  const handleIssueCredit = async () => {
    if (!customer) {
      showToast('No customer selected', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      
      // Demo credit data
      const creditData = {
        customerId: customer.id,
        amount: 25.00,
        reason: 'Demo Credit',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        metadata: {
          issuedAt: currentLocation?.name || 'Main Store',
          issuedBy: 'Demo User',
          notes: 'Demo credit issued through POS extension'
        }
      };
      
      // If offline, create offline credit instead
      if (!isOnline) {
        const offlineCredit = await createOfflineCredit(creditData);
        showToast('Credit issued offline. Will sync when online.', 'success');
        setSelectedCredit(offlineCredit);
        setShowReceiptModal(true);
        setLoading(false);
        return;
      }
      
      const response = await fetchWithAuth('/api/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(creditData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to issue credit');
      }
      
      const result = await response.json();
      showToast('Credit issued successfully', 'success');
      
      // Refresh credits
      await fetchCustomerCredits(customer.id);
      
      // Set selected credit for receipt
      setSelectedCredit(result.credit);
      setShowReceiptModal(true);
      
    } catch (err) {
      console.error('Error issuing credit:', err);
      showToast(`Failed to issue credit: ${err.message}`, 'critical');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding credit to receipt
  const handleAddToReceipt = async () => {
    if (!selectedCredit) {
      showToast('No credit selected', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get current order ID from POS context
      const orderId = posContext?.cart?.order?.id;
      
      if (!orderId) {
        throw new Error('No order found in cart');
      }
      
      const result = await addCreditIssuanceToReceipt(orderId, selectedCredit);
      
      if (result.success) {
        showToast('Added to customer receipt', 'success');
      } else {
        throw new Error(result.error);
      }
      
    } catch (err) {
      console.error('Error adding to receipt:', err);
      showToast(`Failed to add to receipt: ${err.message}`, 'critical');
    } finally {
      setLoading(false);
      setShowReceiptModal(false);
    }
  };
  
  // Handle creating standalone receipt
  const handleCreateStandaloneReceipt = async () => {
    if (!selectedCredit) {
      showToast('No credit selected', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      
      const result = await createStandaloneCreditReceipt(selectedCredit);
      
      if (result.success) {
        showToast('Created printable credit receipt', 'success');
      } else {
        throw new Error(result.error);
      }
      
    } catch (err) {
      console.error('Error creating receipt:', err);
      showToast(`Failed to create receipt: ${err.message}`, 'critical');
    } finally {
      setLoading(false);
      setShowReceiptModal(false);
    }
  };
  
  // Tab content
  const tabs = [
    {
      id: 'credits',
      content: 'Customer Credits',
      accessibilityLabel: 'Customer Credits Tab',
      panelID: 'credits-panel',
    },
    {
      id: 'offline',
      content: 'Offline Operations',
      accessibilityLabel: 'Offline Operations Tab',
      panelID: 'offline-panel',
    },
    {
      id: 'analytics',
      content: 'Analytics',
      accessibilityLabel: 'Analytics Tab',
      panelID: 'analytics-panel',
    },
    {
      id: 'location',
      content: 'Location',
      accessibilityLabel: 'Location Tab',
      panelID: 'location-panel',
    }
  ];
  
  // Render location information
  const renderLocationInfo = () => {
    return (
      <Card sectioned title="Location Information">
        {locationLoading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <Spinner size="large" />
            <div style={{ marginTop: '1rem' }}>Loading location data...</div>
          </div>
        ) : (
          <VerticalStack gap="4">
            {currentLocation ? (
              <>
                <Text variant="headingMd">Current Location</Text>
                <HorizontalStack gap="4" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <Text variant="bodyMd" fontWeight="bold">ID:</Text>
                    <Text variant="bodyMd">{currentLocation.id}</Text>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text variant="bodyMd" fontWeight="bold">Name:</Text>
                    <Text variant="bodyMd">{currentLocation.name}</Text>
                  </div>
                </HorizontalStack>
              </>
            ) : (
              <Banner status="warning">No location information available</Banner>
            )}
            
            <Button onClick={fetchLocations}>Refresh Locations</Button>
            
            {locations.length > 0 && (
              <div>
                <Text variant="headingMd">Available Locations</Text>
                <div style={{ marginTop: '1rem' }}>
                  {locations.map((location) => (
                    <div key={location.id} style={{ padding: '0.5rem', borderBottom: '1px solid #e6e6e6' }}>
                      <Text variant="bodyMd">{location.name}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </VerticalStack>
        )}
      </Card>
    );
  };
  
  // Render offline operations
  const renderOfflineOperations = () => {
    return (
      <VerticalStack gap="4">
        <Card sectioned title="Network Status">
          <HorizontalStack gap="4" align="center">
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: isOnline ? '#00a47c' : '#d82c0d',
              marginRight: '8px'
            }} />
            <Text variant="bodyMd">{isOnline ? 'Online' : 'Offline'}</Text>
          </HorizontalStack>
        </Card>
        
        <Card sectioned title="Pending Operations">
          <VerticalStack gap="4">
            {hasPendingOperations ? (
              <>
                <Banner status="warning">
                  You have {pendingCount} pending operations worth ${pendingAmount.toFixed(2)} that need to be synchronized.
                </Banner>
                
                <Button 
                  primary 
                  disabled={!isOnline || syncInProgress}
                  loading={syncInProgress}
                  onClick={syncWithServer}
                >
                  Sync Now
                </Button>
                
                {offlineCredits.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Text variant="headingMd">Offline Credits</Text>
                    {offlineCredits.map((credit, index) => (
                      <div key={index} style={{ padding: '0.5rem', borderBottom: '1px solid #e6e6e6' }}>
                        <HorizontalStack gap="4" align="space-between">
                          <div>
                            <Text variant="bodyMd">${credit.amount.toFixed(2)} - {credit.reason}</Text>
                            <Text variant="bodySm" color="subdued">Customer: {credit.customerId}</Text>
                          </div>
                          <Text variant="bodyMd" color="warning">Pending</Text>
                        </HorizontalStack>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Banner status="success">
                All operations have been synchronized. You are up to date.
              </Banner>
            )}
          </VerticalStack>
        </Card>
      </VerticalStack>
    );
  };
  
  // Render customer credits
  const renderCustomerCredits = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="large" />
          <div style={{ marginTop: '1rem' }}>Loading customer data...</div>
        </div>
      );
    }
    
    if (error) {
      return (
        <Banner
          title="Error loading data"
          status="critical"
        >
          <p>{error}</p>
        </Banner>
      );
    }
    
    if (!customer) {
      return (
        <Banner
          title="No customer selected"
          status="info"
        >
          <p>Please select a customer in the POS cart to view their credits.</p>
        </Banner>
      );
    }
    
    return (
      <VerticalStack gap="4">
        <Card sectioned title="Customer Information">
          <HorizontalStack gap="4" wrap={false}>
            <div style={{ flex: 1 }}>
              <Text variant="bodyMd" fontWeight="bold">Name:</Text>
              <Text variant="bodyMd">{customer.firstName} {customer.lastName}</Text>
            </div>
            <div style={{ flex: 1 }}>
              <Text variant="bodyMd" fontWeight="bold">Email:</Text>
              <Text variant="bodyMd">{customer.email}</Text>
            </div>
            <div style={{ flex: 1 }}>
              <Text variant="bodyMd" fontWeight="bold">Phone:</Text>
              <Text variant="bodyMd">{customer.phone || 'N/A'}</Text>
            </div>
          </HorizontalStack>
        </Card>
        
        <Card sectioned title="Customer Credits">
          <VerticalStack gap="4">
            <Button onClick={handleIssueCredit} primary>Issue New Credit</Button>
            
            {credits.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                {credits.map((credit) => (
                  <div key={credit.id} style={{ padding: '0.5rem', borderBottom: '1px solid #e6e6e6' }}>
                    <HorizontalStack gap="4" align="space-between">
                      <div>
                        <Text variant="bodyMd">${credit.amount.toFixed(2)} - {credit.reason}</Text>
                        <Text variant="bodySm" color="subdued">Created: {new Date(credit.createdAt).toLocaleDateString()}</Text>
                      </div>
                      <Text 
                        variant="bodyMd" 
                        color={credit.status === 'active' ? 'success' : 'subdued'}
                      >
                        {credit.status.toUpperCase()}
                      </Text>
                    </HorizontalStack>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <Text variant="bodyMd" color="subdued">No credits found for this customer.</Text>
              </div>
            )}
          </VerticalStack>
        </Card>
      </VerticalStack>
    );
  };
  
  return (
    <Page title="Credit Management Demo">
      <Layout>
        <Layout.Section>
          <Tabs 
            tabs={tabs} 
            selected={selectedTab}
            onSelect={(index) => setSelectedTab(index)}
          >
            <Card.Section>
              {selectedTab === 0 && renderCustomerCredits()}
              {selectedTab === 1 && renderOfflineOperations()}
              {selectedTab === 2 && <CreditAnalytics />}
              {selectedTab === 3 && renderLocationInfo()}
            </Card.Section>
          </Tabs>
        </Layout.Section>
      </Layout>
      
      {/* Receipt Modal */}
      <Modal
        open={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Credit Receipt Options"
        primaryAction={{
          content: 'Add to Order Receipt',
          onAction: handleAddToReceipt,
          loading: loading || receiptLoading
        }}
        secondaryActions={[
          {
            content: 'Create Standalone Receipt',
            onAction: handleCreateStandaloneReceipt,
            loading: loading || receiptLoading
          }
        ]}
      >
        <Modal.Section>
          {selectedCredit && (
            <VerticalStack gap="4">
              <Text variant="headingMd">Credit Details</Text>
              
              <HorizontalStack gap="4" wrap={false}>
                <div style={{ flex: 1 }}>
                  <Text variant="bodyMd" fontWeight="bold">Amount:</Text>
                  <Text variant="bodyMd">${parseFloat(selectedCredit.amount).toFixed(2)}</Text>
                </div>
                <div style={{ flex: 1 }}>
                  <Text variant="bodyMd" fontWeight="bold">Reason:</Text>
                  <Text variant="bodyMd">{selectedCredit.reason || 'N/A'}</Text>
                </div>
              </HorizontalStack>
              
              <Text variant="bodyMd">
                Would you like to add this credit to the current order receipt or create a standalone receipt?
              </Text>
            </VerticalStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
} 