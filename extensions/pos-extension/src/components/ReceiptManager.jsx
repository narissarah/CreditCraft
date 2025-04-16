import React, { useState, useEffect } from 'react';
import {
  Banner,
  Button,
  Card,
  ChoiceList,
  FormLayout,
  Layout,
  Page,
  Select,
  SkeletonBodyText,
  SkeletonDisplayText,
  Text,
  TextField,
  Toast
} from '@shopify/polaris';
import { useAppBridge } from '@shopify/app-bridge-react';
import { Printer, useExtensionApi } from '@shopify/ui-extensions-react/checkout';

/**
 * ReceiptManager component
 * 
 * Handles configuration and testing of receipt printing integration
 * for customer credit documentation
 */
export function ReceiptManager() {
  const app = useAppBridge();
  const extensionApi = useExtensionApi();
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState({
    enabled: true,
    position: 'after_payment',
    template: 'standard',
    showLogo: true,
    customText: ''
  });
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [testMode, setTestMode] = useState(false);
  const [testData, setTestData] = useState({
    customerId: '',
    creditAmount: '10.00',
    expiryDate: '',
    transactionId: 'TEST-12345'
  });
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Load receipt settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would fetch from your backend API
        // Simulating API call with timeout
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data for demonstration
        setAvailableTemplates([
          { label: 'Standard', value: 'standard' },
          { label: 'Minimal', value: 'minimal' },
          { label: 'Detailed', value: 'detailed' }
        ]);
        
        // Mock settings
        setReceiptSettings({
          enabled: true,
          position: 'after_payment',
          template: 'standard',
          showLogo: true,
          customText: 'Thank you for your purchase!'
        });
        
        setLoading(false);
      } catch (error) {
        setErrorMessage('Failed to load receipt settings. Please try again.');
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  /**
   * Save receipt settings
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // In a real implementation, this would save to your backend API
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setToastMessage('Receipt settings saved successfully');
      setToastError(false);
    } catch (error) {
      setToastMessage('Failed to save receipt settings');
      setToastError(true);
    } finally {
      setSaving(false);
    }
  };
  
  /**
   * Test receipt printing
   */
  const handleTestPrint = async () => {
    try {
      // Format test data
      const today = new Date();
      const expiryDate = testData.expiryDate || 
        new Date(today.setMonth(today.getMonth() + 12)).toISOString().split('T')[0];
      
      // Generate demo receipt content
      const receiptContent = generateReceiptContent({
        ...testData,
        expiryDate,
        template: receiptSettings.template,
        showLogo: receiptSettings.showLogo,
        customText: receiptSettings.customText
      });
      
      // In a real implementation, this would use the POS Printer API
      // For now, we'll just show a success message
      setToastMessage('Test receipt generated successfully');
      setToastError(false);
      
      // Log the content that would be printed
      console.log('Receipt content:', receiptContent);
    } catch (error) {
      setToastMessage('Failed to generate test receipt');
      setToastError(true);
    }
  };
  
  /**
   * Generate receipt content based on template and data
   */
  const generateReceiptContent = (data) => {
    // In a real implementation, this would use proper templates
    // This is a simplified version for demonstration
    
    const receiptHeader = data.showLogo ? 
      '-- CREDITCRAFT --\n\n' : 
      'Store Credit Receipt\n\n';
    
    let content = '';
    
    switch (data.template) {
      case 'minimal':
        content = `${receiptHeader}Customer Credit\nAmount: $${data.creditAmount}\nExp: ${data.expiryDate}\nRef: ${data.transactionId}\n`;
        break;
      
      case 'detailed':
        content = `${receiptHeader}STORE CREDIT RECEIPT\n\nTransaction ID: ${data.transactionId}\nCustomer ID: ${data.customerId || 'N/A'}\nCredit Amount: $${data.creditAmount}\nIssue Date: ${new Date().toLocaleDateString()}\nExpiry Date: ${data.expiryDate}\n\nThis credit can be used for future purchases.\nBalance can be checked online or in-store.\n\n${data.customText}\n`;
        break;
        
      case 'standard':
      default:
        content = `${receiptHeader}STORE CREDIT\n\nAmount: $${data.creditAmount}\nIssued: ${new Date().toLocaleDateString()}\nExpires: ${data.expiryDate}\nRef: ${data.transactionId}\n\n${data.customText}\n`;
        break;
    }
    
    return content;
  };
  
  // Position options
  const positionOptions = [
    { label: 'After Payment Section', value: 'after_payment' },
    { label: 'Before Payment Section', value: 'before_payment' },
    { label: 'End of Receipt', value: 'end_receipt' },
    { label: 'Custom Section', value: 'custom_section' }
  ];
  
  // Render loading state
  if (loading) {
    return (
      <Page title="Receipt Integration">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={6} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  return (
    <Page 
      title="Receipt Integration"
      subtitle="Configure how customer credit information appears on receipts"
    >
      {errorMessage && (
        <Banner
          title="There was an issue loading settings"
          status="critical"
          onDismiss={() => setErrorMessage('')}
        >
          <p>{errorMessage}</p>
        </Banner>
      )}
      
      <Layout>
        <Layout.Section>
          <Card title="Receipt Settings" sectioned>
            <FormLayout>
              <ChoiceList
                title="Enable Credit Information on Receipts"
                choices={[
                  {
                    label: 'Enable credit information on receipts',
                    value: 'enabled',
                    helpText: 'When enabled, credit information will be printed on receipts when credits are issued or used'
                  }
                ]}
                selected={receiptSettings.enabled ? ['enabled'] : []}
                onChange={(selected) => setReceiptSettings({
                  ...receiptSettings, 
                  enabled: selected.includes('enabled')
                })}
              />
              
              <Select
                label="Receipt Position"
                options={positionOptions}
                value={receiptSettings.position}
                onChange={(value) => setReceiptSettings({
                  ...receiptSettings,
                  position: value
                })}
                helpText="Select where credit information should appear on the receipt"
                disabled={!receiptSettings.enabled}
              />
              
              <Select
                label="Template Style"
                options={availableTemplates}
                value={receiptSettings.template}
                onChange={(value) => setReceiptSettings({
                  ...receiptSettings,
                  template: value
                })}
                helpText="Select the layout and amount of detail to include"
                disabled={!receiptSettings.enabled}
              />
              
              <ChoiceList
                title="Branding"
                choices={[
                  {
                    label: 'Show store logo',
                    value: 'logo',
                    helpText: 'Include your store logo on credit receipts'
                  }
                ]}
                selected={receiptSettings.showLogo ? ['logo'] : []}
                onChange={(selected) => setReceiptSettings({
                  ...receiptSettings, 
                  showLogo: selected.includes('logo')
                })}
                disabled={!receiptSettings.enabled}
              />
              
              <TextField
                label="Custom Message"
                value={receiptSettings.customText}
                onChange={(value) => setReceiptSettings({
                  ...receiptSettings,
                  customText: value
                })}
                placeholder="Thank you for your purchase!"
                helpText="Custom text to include on credit receipts"
                multiline={3}
                disabled={!receiptSettings.enabled}
              />
              
              <Button
                primary
                onClick={handleSave}
                loading={saving}
                disabled={!receiptSettings.enabled}
              >
                Save Settings
              </Button>
            </FormLayout>
          </Card>
        </Layout.Section>
        
        <Layout.Section secondary>
          <Card title="Test Receipt" sectioned>
            <FormLayout>
              <Text variation="subdued">
                Use this section to test how credits will appear on printed receipts
              </Text>
              
              <TextField
                label="Test Customer ID (optional)"
                value={testData.customerId}
                onChange={(value) => setTestData({
                  ...testData,
                  customerId: value
                })}
                placeholder="customer_123"
              />
              
              <TextField
                label="Test Credit Amount"
                value={testData.creditAmount}
                onChange={(value) => setTestData({
                  ...testData,
                  creditAmount: value
                })}
                type="number"
                min="0"
                step="0.01"
              />
              
              <TextField
                label="Test Expiry Date (optional)"
                value={testData.expiryDate}
                onChange={(value) => setTestData({
                  ...testData,
                  expiryDate: value
                })}
                type="date"
                helpText="If blank, will default to 1 year from today"
              />
              
              <Button onClick={handleTestPrint}>
                Test Receipt
              </Button>
            </FormLayout>
          </Card>
          
          <div style={{ marginTop: '20px' }}>
            <Card title="Receipt Integration Help" sectioned>
              <Text>
                Need to customize receipt templates further? Contact our support team
                or check the developer documentation for advanced integration options.
              </Text>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
      
      {toastMessage && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={() => setToastMessage('')}
        />
      )}
    </Page>
  );
}

export default ReceiptManager; 