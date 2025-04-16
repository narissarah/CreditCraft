import React, { useState } from 'react';
import {
  Card,
  Button,
  ButtonGroup,
  Stack,
  TextContainer,
  TextField,
  Modal,
  Select,
  DatePicker,
  Checkbox,
  Banner,
  Text,
  Heading,
  Collapsible,
  Icon,
  Badge
} from '@shopify/polaris';
import {
  ExportMinor,
  CalendarMinor,
  EmailMajor,
  MobileBackArrowMajor,
  CaretDownMinor,
  CaretUpMinor
} from '@shopify/polaris-icons';
import { useAPI } from '../../hooks/useAPI';
import { formatDate } from '../common/AdminUIComponents';

interface BulkCreditOperationsProps {
  selectedCredits: string[];
  onSuccess: () => void;
  onCancel: () => void;
}

const BulkCreditOperations: React.FC<BulkCreditOperationsProps> = ({
  selectedCredits,
  onSuccess,
  onCancel
}) => {
  const [actionType, setActionType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Export options
  const [exportFormat, setExportFormat] = useState('csv');
  
  // Cancel options
  const [cancelReason, setCancelReason] = useState('');
  
  // Extend options
  const [extendDate, setExtendDate] = useState<Date | null>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default +30 days
  );
  const [extendReason, setExtendReason] = useState('');
  const [{ month, year }, setDate] = useState({
    month: extendDate ? extendDate.getMonth() : new Date().getMonth(),
    year: extendDate ? extendDate.getFullYear() : new Date().getFullYear(),
  });
  
  // Notify options
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [notificationTemplate, setNotificationTemplate] = useState('default');
  const [customMessage, setCustomMessage] = useState('');
  
  const api = useAPI();
  
  // Handle date change
  const handleDateChange = ({ start }: { start: Date; end: Date }) => {
    setExtendDate(start);
  };
  
  const handleMonthChange = (month: number, year: number) => {
    setDate({ month, year });
  };
  
  // Handle export
  const handleExport = async () => {
    if (selectedCredits.length === 0) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const response = await api.post('/credits/export', {
        creditIds: selectedCredits,
        format: exportFormat,
      }, { responseType: 'blob' });
      
      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `credits-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      onSuccess();
    } catch (error) {
      console.error('Error exporting credits:', error);
      setError('Failed to export credits. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle cancel
  const handleCancel = async () => {
    if (selectedCredits.length === 0 || !cancelReason) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      await Promise.all(
        selectedCredits.map(id =>
          api.post(`/credits/${id}/cancel`, {
            reason: cancelReason,
          })
        )
      );
      
      onSuccess();
    } catch (error) {
      console.error('Error cancelling credits:', error);
      setError('Failed to cancel credits. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle extend
  const handleExtend = async () => {
    if (selectedCredits.length === 0 || !extendDate || !extendReason) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      await Promise.all(
        selectedCredits.map(id =>
          api.post(`/credits/${id}/extend-expiration`, {
            newExpirationDate: extendDate.toISOString(),
            reason: extendReason,
            notifyCustomer: notifyCustomers,
            customMessage: customMessage || undefined,
          })
        )
      );
      
      onSuccess();
    } catch (error) {
      console.error('Error extending credits:', error);
      setError('Failed to extend credits. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle notification
  const handleNotify = async () => {
    if (selectedCredits.length === 0) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      await api.post('/credits/notify', {
        creditIds: selectedCredits,
        template: notificationTemplate,
        customMessage: customMessage || undefined,
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error notifying credit holders:', error);
      setError('Failed to send notifications. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle action submission
  const handleSubmit = () => {
    switch (actionType) {
      case 'export':
        handleExport();
        break;
      case 'cancel':
        handleCancel();
        break;
      case 'extend':
        handleExtend();
        break;
      case 'notify':
        handleNotify();
        break;
      default:
        break;
    }
  };
  
  // Toggle advanced options
  const toggleAdvancedOptions = () => {
    setShowAdvancedOptions(!showAdvancedOptions);
  };
  
  // Render action-specific form fields
  const renderActionFields = () => {
    switch (actionType) {
      case 'export':
        return (
          <Stack vertical spacing="tight">
            <Select
              label="Export Format"
              options={[
                { label: 'CSV', value: 'csv' },
                { label: 'Excel (XLSX)', value: 'xlsx' },
                { label: 'JSON', value: 'json' },
              ]}
              value={exportFormat}
              onChange={setExportFormat}
              helpText="Choose the format for your exported credit data"
            />
            
            <Collapsible
              open={showAdvancedOptions}
              id="advanced-export-options"
            >
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Checkbox
                    label="Include transaction history"
                    checked={true}
                    disabled
                    helpText="The complete transaction history will be included for each credit"
                  />
                  
                  <Checkbox
                    label="Include customer details"
                    checked={true}
                    disabled
                    helpText="Customer information will be included for each credit where available"
                  />
                </Stack>
              </Card>
            </Collapsible>
            
            <div style={{ marginTop: '8px' }}>
              <Button 
                plain 
                onClick={toggleAdvancedOptions}
                icon={showAdvancedOptions ? CaretUpMinor : CaretDownMinor}
              >
                {showAdvancedOptions ? 'Hide advanced options' : 'Show advanced options'}
              </Button>
            </div>
          </Stack>
        );
      
      case 'cancel':
        return (
          <Stack vertical spacing="tight">
            <Banner status="critical" title="This action cannot be undone">
              <p>
                Cancelling credits will make them unusable. This will affect {selectedCredits.length} credit(s).
              </p>
            </Banner>
            
            <TextField
              label="Reason"
              value={cancelReason}
              onChange={setCancelReason}
              multiline={3}
              autoComplete="off"
              error={!cancelReason ? 'A reason is required' : undefined}
              helpText="This reason will be recorded in the transaction history for each credit"
              required
            />
            
            <Collapsible
              open={showAdvancedOptions}
              id="advanced-cancel-options"
            >
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Checkbox
                    label="Notify customers about cancellation"
                    checked={notifyCustomers}
                    onChange={setNotifyCustomers}
                    helpText="Send an email notification to affected customers"
                  />
                  
                  {notifyCustomers && (
                    <TextField
                      label="Custom message (optional)"
                      value={customMessage}
                      onChange={setCustomMessage}
                      multiline={3}
                      autoComplete="off"
                      helpText="Add a custom message to the cancellation notification"
                    />
                  )}
                </Stack>
              </Card>
            </Collapsible>
            
            <div style={{ marginTop: '8px' }}>
              <Button 
                plain 
                onClick={toggleAdvancedOptions}
                icon={showAdvancedOptions ? CaretUpMinor : CaretDownMinor}
              >
                {showAdvancedOptions ? 'Hide advanced options' : 'Show advanced options'}
              </Button>
            </div>
          </Stack>
        );
      
      case 'extend':
        return (
          <Stack vertical spacing="tight">
            <Text variant="bodyMd" as="p">
              This will extend the expiration date for {selectedCredits.length} credit(s).
            </Text>
            
            <Stack vertical spacing="tight">
              <TextContainer>
                <Stack alignment="center" spacing="extraTight">
                  <Text variant="bodyMd" as="p">New Expiration Date</Text>
                  <Icon source={CalendarMinor} color="base" />
                </Stack>
              </TextContainer>
              
              <DatePicker
                month={month}
                year={year}
                onChange={handleDateChange}
                onMonthChange={handleMonthChange}
                selected={extendDate}
                disableDatesBefore={new Date()}
              />
            </Stack>
            
            <TextField
              label="Reason"
              value={extendReason}
              onChange={setExtendReason}
              multiline={3}
              autoComplete="off"
              error={!extendReason ? 'A reason is required' : undefined}
              helpText="This reason will be recorded in the transaction history for each credit"
              required
            />
            
            <Collapsible
              open={showAdvancedOptions}
              id="advanced-extend-options"
            >
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Checkbox
                    label="Notify customers about extended expiration"
                    checked={notifyCustomers}
                    onChange={setNotifyCustomers}
                    helpText="Send an email notification to affected customers"
                  />
                  
                  {notifyCustomers && (
                    <TextField
                      label="Custom message (optional)"
                      value={customMessage}
                      onChange={setCustomMessage}
                      multiline={3}
                      autoComplete="off"
                      helpText="Add a custom message to the notification"
                    />
                  )}
                </Stack>
              </Card>
            </Collapsible>
            
            <div style={{ marginTop: '8px' }}>
              <Button 
                plain 
                onClick={toggleAdvancedOptions}
                icon={showAdvancedOptions ? CaretUpMinor : CaretDownMinor}
              >
                {showAdvancedOptions ? 'Hide advanced options' : 'Show advanced options'}
              </Button>
            </div>
          </Stack>
        );
      
      case 'notify':
        return (
          <Stack vertical spacing="tight">
            <Text variant="bodyMd" as="p">
              This will send a notification to the customers of {selectedCredits.length} credit(s).
            </Text>
            
            <Select
              label="Notification Template"
              options={[
                { label: 'Default Reminder', value: 'default' },
                { label: 'Expiration Warning', value: 'expiration' },
                { label: 'Promotional', value: 'promotional' },
                { label: 'Custom Message', value: 'custom' },
              ]}
              value={notificationTemplate}
              onChange={setNotificationTemplate}
              helpText="Select the type of notification to send"
            />
            
            <TextField
              label="Custom Message"
              value={customMessage}
              onChange={setCustomMessage}
              multiline={3}
              autoComplete="off"
              helpText="Add a custom message to the notification"
              error={notificationTemplate === 'custom' && !customMessage ? 'A message is required for custom notifications' : undefined}
              required={notificationTemplate === 'custom'}
            />
            
            <Collapsible
              open={showAdvancedOptions}
              id="advanced-notify-options"
            >
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Checkbox
                    label="Request read receipt"
                    checked={false}
                    disabled
                    helpText="This feature is coming soon"
                  />
                  
                  <Checkbox
                    label="Schedule for later"
                    checked={false}
                    disabled
                    helpText="This feature is coming soon"
                  />
                </Stack>
              </Card>
            </Collapsible>
            
            <div style={{ marginTop: '8px' }}>
              <Button 
                plain 
                onClick={toggleAdvancedOptions}
                icon={showAdvancedOptions ? CaretUpMinor : CaretDownMinor}
              >
                {showAdvancedOptions ? 'Hide advanced options' : 'Show advanced options'}
              </Button>
            </div>
          </Stack>
        );
      
      default:
        return (
          <div style={{ minHeight: '150px' }}>
            <Stack vertical>
              <TextContainer>
                <Text as="p">Select an action to perform on {selectedCredits.length} selected credit(s).</Text>
              </TextContainer>
              
              <div style={{ marginTop: '16px' }}>
                <Stack vertical spacing="tight">
                  <Stack alignment="center">
                    <Button icon={ExportMinor} onClick={() => setActionType('export')}>
                      Export Credits
                    </Button>
                    <Text variant="bodyMd" as="p">Download credit data in various formats</Text>
                  </Stack>
                  
                  <Stack alignment="center">
                    <Button icon={CalendarMinor} onClick={() => setActionType('extend')}>
                      Extend Expiration
                    </Button>
                    <Text variant="bodyMd" as="p">Set a new expiration date for selected credits</Text>
                  </Stack>
                  
                  <Stack alignment="center">
                    <Button icon={EmailMajor} onClick={() => setActionType('notify')}>
                      Notify Customers
                    </Button>
                    <Text variant="bodyMd" as="p">Send notifications about these credits</Text>
                  </Stack>
                  
                  <Stack alignment="center">
                    <Button destructive onClick={() => setActionType('cancel')}>
                      Cancel Credits
                    </Button>
                    <Text variant="bodyMd" as="p">Mark credits as cancelled (cannot be undone)</Text>
                  </Stack>
                </Stack>
              </div>
            </Stack>
          </div>
        );
    }
  };
  
  // Determine button text based on action
  const getActionButtonText = () => {
    switch (actionType) {
      case 'export':
        return 'Export';
      case 'cancel':
        return 'Cancel Credits';
      case 'extend':
        return 'Extend Expiration';
      case 'notify':
        return 'Send Notifications';
      default:
        return 'Continue';
    }
  };
  
  // Determine if primary action should be disabled
  const isPrimaryDisabled = () => {
    if (actionType === '') return true;
    if (actionType === 'cancel' && !cancelReason) return true;
    if (actionType === 'extend' && (!extendDate || !extendReason)) return true;
    if (actionType === 'notify' && notificationTemplate === 'custom' && !customMessage) return true;
    return false;
  };
  
  return (
    <Card>
      <Card.Section>
        <Stack alignment="center" distribution="equalSpacing">
          <Stack alignment="center">
            <Button 
              plain 
              icon={MobileBackArrowMajor} 
              onClick={() => actionType ? setActionType('') : onCancel()}
            >
              {actionType ? 'Back to Actions' : 'Back to Credits'}
            </Button>
            <Badge>{selectedCredits.length} selected</Badge>
          </Stack>
          
          <Heading>Bulk Credit Operations</Heading>
        </Stack>
      </Card.Section>
      
      <Card.Section>
        {error && (
          <Banner status="critical" title="An error occurred" onDismiss={() => setError('')}>
            <p>{error}</p>
          </Banner>
        )}
        
        {renderActionFields()}
      </Card.Section>
      
      <Card.Section>
        <Stack distribution="trailing">
          <ButtonGroup>
            <Button onClick={onCancel}>Cancel</Button>
            <Button 
              primary 
              disabled={isPrimaryDisabled()}
              loading={isProcessing}
              onClick={handleSubmit}
            >
              {getActionButtonText()}
            </Button>
          </ButtonGroup>
        </Stack>
      </Card.Section>
    </Card>
  );
};

export default BulkCreditOperations; 