import React, { useState, useCallback, useRef } from 'react';
import {
  Card,
  Form,
  FormLayout,
  TextField,
  Button,
  Select,
  Stack,
  Toast,
  TextContainer,
  Text,
  Banner,
  SkeletonBodyText,
  Modal
} from '@shopify/polaris';
import { CashDollarMajor, PrintMajor } from '@shopify/polaris-icons';
import { useAppBridge } from '../hooks/useAppBridge';
import { useLocationManager } from '../utils/locationManager';
import CustomerSearch from './CustomerSearch';

const CREDIT_TYPES = [
  { label: 'Store Credit', value: 'store_credit' },
  { label: 'Refund', value: 'refund' },
  { label: 'Promotion', value: 'promotion' },
  { label: 'Gift Card', value: 'gift_card' }
];

/**
 * Credit Issuance component for POS extension
 * Allows staff to issue store credit to customers
 * Includes customer search, amount entry, and receipt printing
 */
function CreditIssuance() {
  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [creditType, setCreditType] = useState('store_credit');
  const [note, setNote] = useState('');
  const [expiryDays, setExpiryDays] = useState('365');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastStatus, setToastStatus] = useState('success');
  const [error, setError] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [issuedCreditId, setIssuedCreditId] = useState(null);
  
  // Refs
  const receiptContentRef = useRef(null);
  
  // Hooks
  const { fetchWithAuth, showToast: showAppBridgeToast } = useAppBridge();
  const { activeLocation } = useLocationManager();
  
  // Handle customer selection
  const handleSelectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
  }, []);
  
  // Validate form
  const validateForm = useCallback(() => {
    if (!selectedCustomer) {
      setError('Please select a customer');
      return false;
    }
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    
    return true;
  }, [selectedCustomer, amount]);
  
  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth('/api/credits/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: parseFloat(amount),
          type: creditType,
          note: note || undefined,
          expiryDays: parseInt(expiryDays, 10) || 365,
          locationId: activeLocation?.id,
          issuedInPOS: true
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to issue credit');
      }
      
      const data = await response.json();
      setIssuedCreditId(data.creditId);
      
      // Show success toast
      setToastMessage('Credit issued successfully');
      setToastStatus('success');
      setShowToast(true);
      
      // Show print modal
      setShowPrintModal(true);
      
      // Reset form
      setAmount('');
      setNote('');
      
    } catch (err) {
      console.error('Error issuing credit:', err);
      setError(err.message || 'Failed to issue credit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm, 
    fetchWithAuth, 
    selectedCustomer, 
    amount, 
    creditType, 
    note, 
    expiryDays, 
    activeLocation
  ]);
  
  // Handle print receipt
  const handlePrintReceipt = useCallback(() => {
    if (!receiptContentRef.current) return;
    
    try {
      // Create a print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }
      
      // Set print window content
      printWindow.document.write(`
        <html>
          <head>
            <title>Credit Receipt</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
              .receipt { max-width: 300px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 20px; }
              .line { border-top: 1px dashed #ccc; margin: 10px 0; }
              .footer { text-align: center; font-size: 12px; margin-top: 20px; }
              .amount { font-size: 18px; font-weight: bold; }
              .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
            </style>
          </head>
          <body>
            ${receiptContentRef.current.innerHTML}
          </body>
        </html>
      `);
      
      // Trigger print
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      
      // Show toast
      showAppBridgeToast('Receipt sent to printer', 'success');
      setShowPrintModal(false);
      
    } catch (err) {
      console.error('Error printing receipt:', err);
      showAppBridgeToast('Failed to print receipt', 'error');
    }
  }, [showAppBridgeToast]);
  
  // Format currency
  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }, []);
  
  return (
    <div className="credit-issuance">
      {/* Customer Search Modal */}
      <Modal
        open={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        title="Search Customers"
        primaryAction={{
          content: 'Cancel',
          onAction: () => setShowCustomerSearch(false),
        }}
      >
        <Modal.Section>
          <CustomerSearch onSelectCustomer={handleSelectCustomer} />
        </Modal.Section>
      </Modal>
      
      {/* Print Receipt Modal */}
      <Modal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print Credit Receipt"
        primaryAction={{
          content: 'Print Receipt',
          icon: PrintMajor,
          onAction: handlePrintReceipt,
        }}
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setShowPrintModal(false),
          },
        ]}
      >
        <Modal.Section>
          <div ref={receiptContentRef} className="receipt-preview">
            <div className="receipt">
              <div className="header">
                <h2>Credit Receipt</h2>
                <p>{new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="line"></div>
              
              <div className="customer-info">
                <h3>Customer</h3>
                <p>{selectedCustomer?.firstName} {selectedCustomer?.lastName}</p>
                <p>{selectedCustomer?.email}</p>
              </div>
              
              <div className="line"></div>
              
              <div className="credit-info">
                <h3>Credit Details</h3>
                <div className="info-row">
                  <span>Type:</span>
                  <span>{CREDIT_TYPES.find(t => t.value === creditType)?.label}</span>
                </div>
                <div className="info-row">
                  <span>Amount:</span>
                  <span className="amount">{formatCurrency(parseFloat(amount))}</span>
                </div>
                {note && (
                  <div className="info-row">
                    <span>Note:</span>
                    <span>{note}</span>
                  </div>
                )}
                <div className="info-row">
                  <span>Expires:</span>
                  <span>{new Date(Date.now() + parseInt(expiryDays, 10) * 86400000).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="line"></div>
              
              <div className="footer">
                <p>Credit ID: {issuedCreditId}</p>
                <p>Location: {activeLocation?.name || 'Unknown'}</p>
                <p>Thank you for your business!</p>
              </div>
            </div>
          </div>
        </Modal.Section>
      </Modal>
      
      {/* Toast notification */}
      {showToast && (
        <Toast 
          content={toastMessage} 
          error={toastStatus === 'error'}
          onDismiss={() => setShowToast(false)} 
        />
      )}
      
      <Card title="Issue Store Credit">
        <Card.Section>
          {error && (
            <Banner status="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}
          
          <Form onSubmit={handleSubmit}>
            <FormLayout>
              {/* Customer Selection */}
              <div className="customer-selection">
                <TextContainer>
                  <Text variant="headingMd" as="h3">Customer</Text>
                  {selectedCustomer ? (
                    <Stack alignment="center" distribution="equalSpacing">
                      <TextContainer>
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                        </Text>
                        <Text variant="bodySm" as="p" color="subdued">
                          {selectedCustomer.email}
                        </Text>
                      </TextContainer>
                      <Button onClick={() => setShowCustomerSearch(true)}>
                        Change
                      </Button>
                    </Stack>
                  ) : (
                    <Button onClick={() => setShowCustomerSearch(true)}>
                      Select Customer
                    </Button>
                  )}
                </TextContainer>
              </div>
              
              {/* Credit Details */}
              <TextField
                label="Amount"
                type="number"
                value={amount}
                onChange={setAmount}
                prefix="$"
                autoComplete="off"
                disabled={isSubmitting}
                min="0.01"
                step="0.01"
                required
              />
              
              <Select
                label="Credit Type"
                options={CREDIT_TYPES}
                value={creditType}
                onChange={setCreditType}
                disabled={isSubmitting}
              />
              
              <TextField
                label="Expiry (days)"
                type="number"
                value={expiryDays}
                onChange={setExpiryDays}
                disabled={isSubmitting}
                min="1"
              />
              
              <TextField
                label="Note (optional)"
                value={note}
                onChange={setNote}
                multiline={3}
                disabled={isSubmitting}
                placeholder="Reason for issuing credit"
              />
              
              <Button
                primary
                submit
                disabled={isSubmitting || !selectedCustomer || !amount}
                loading={isSubmitting}
                icon={CashDollarMajor}
              >
                Issue Credit
              </Button>
            </FormLayout>
          </Form>
        </Card.Section>
      </Card>
      
      <style jsx>{`
        .credit-issuance {
          margin: 1rem 0;
        }
        .customer-selection {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--p-border-subdued);
        }
        .receipt-preview {
          max-width: 300px;
          margin: 0 auto;
          border: 1px solid var(--p-border-subdued);
          padding: 1rem;
          border-radius: var(--p-border-radius-base);
        }
        .receipt .header {
          text-align: center;
          margin-bottom: 1rem;
        }
        .receipt .line {
          border-top: 1px dashed var(--p-border-subdued);
          margin: 1rem 0;
        }
        .receipt .footer {
          text-align: center;
          font-size: 0.8rem;
          margin-top: 1rem;
        }
        .receipt .amount {
          font-size: 1.2rem;
          font-weight: bold;
        }
        .receipt .info-row {
          display: flex;
          justify-content: space-between;
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
}

export default CreditIssuance; 