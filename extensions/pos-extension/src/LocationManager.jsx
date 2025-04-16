import React, { useState, useEffect, useCallback } from 'react';
import {
  Banner,
  Button,
  Card,
  Layout,
  List,
  Page,
  Select,
  Spinner,
  Text,
  TextField
} from '@shopify/retail-ui-extensions';
import { useExtensionApi, useSessionToken } from '@shopify/retail-ui-extensions-react';
import { createLogger } from './utils';

/**
 * LocationManager Component
 * 
 * Handles multi-location configuration for POS credit operations
 */
function LocationManager() {
  // Extension API access
  const extensionApi = useExtensionApi();
  const getSessionToken = useSessionToken();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [locationSettings, setLocationSettings] = useState({});
  const [selectedLocation, setSelectedLocation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings form state
  const [creditLimit, setCreditLimit] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalThreshold, setApprovalThreshold] = useState('');
  const [allowsRefunds, setAllowsRefunds] = useState(true);
  
  // Initialize logger
  const logger = createLogger('LocationManager', true);

  /**
   * Fetch all locations available to the merchant
   */
  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const token = await getSessionToken();
      
      const response = await fetch(`${process.env.API_BASE_URL || 'https://api.creditcraft.com'}/api/locations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch locations: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the locations for the Select component
      const locationOptions = data.locations.map(location => ({
        label: location.name,
        value: location.id
      }));
      
      setLocations(locationOptions);
      
      // Set current location as selected if available
      if (extensionApi.storeDetails?.id && locationOptions.some(loc => loc.value === extensionApi.storeDetails.id)) {
        setSelectedLocation(extensionApi.storeDetails.id);
        fetchLocationSettings(extensionApi.storeDetails.id);
      } else if (locationOptions.length > 0) {
        setSelectedLocation(locationOptions[0].value);
        fetchLocationSettings(locationOptions[0].value);
      }
      
      logger.info(`Fetched ${locationOptions.length} locations`);
    } catch (error) {
      logger.error('Failed to fetch locations', { error: error.message });
      setErrorMessage(`Error fetching locations: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [getSessionToken, extensionApi.storeDetails]);

  /**
   * Fetch settings for a specific location
   */
  const fetchLocationSettings = useCallback(async (locationId) => {
    if (!locationId) return;
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const token = await getSessionToken();
      
      const response = await fetch(`${process.env.API_BASE_URL || 'https://api.creditcraft.com'}/api/locations/${locationId}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch location settings: ${response.status}`);
      }
      
      const data = await response.json();
      setLocationSettings(data.settings || {});
      
      // Update form values
      setCreditLimit(data.settings?.creditLimit?.toString() || '');
      setRequiresApproval(data.settings?.requiresApproval || false);
      setApprovalThreshold(data.settings?.approvalThreshold?.toString() || '');
      setAllowsRefunds(data.settings?.allowsRefunds !== false); // Default to true if not specified
      
      logger.info(`Fetched settings for location ${locationId}`);
    } catch (error) {
      logger.error('Failed to fetch location settings', { locationId, error: error.message });
      setErrorMessage(`Error fetching location settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [getSessionToken]);

  /**
   * Save settings for the selected location
   */
  const saveLocationSettings = useCallback(async () => {
    if (!selectedLocation) {
      setErrorMessage('No location selected');
      return;
    }
    
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const token = await getSessionToken();
      
      const settings = {
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        requiresApproval,
        approvalThreshold: approvalThreshold ? parseFloat(approvalThreshold) : null,
        allowsRefunds
      };
      
      const response = await fetch(`${process.env.API_BASE_URL || 'https://api.creditcraft.com'}/api/locations/${selectedLocation}/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save location settings: ${response.status}`);
      }
      
      setSuccessMessage('Location settings saved successfully');
      logger.info(`Saved settings for location ${selectedLocation}`, { settings });
      
      // Refetch settings to ensure we have the latest data
      await fetchLocationSettings(selectedLocation);
    } catch (error) {
      logger.error('Failed to save location settings', { locationId: selectedLocation, error: error.message });
      setErrorMessage(`Error saving location settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedLocation, creditLimit, requiresApproval, approvalThreshold, allowsRefunds, getSessionToken, fetchLocationSettings]);

  // Initial load of locations
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Handle location change
  const handleLocationChange = (value) => {
    setSelectedLocation(value);
    fetchLocationSettings(value);
  };

  return (
    <Page title="Multi-Location Settings">
      {/* Status messages */}
      {errorMessage && (
        <Banner tone="critical" onDismiss={() => setErrorMessage('')}>
          <Text>{errorMessage}</Text>
        </Banner>
      )}
      
      {successMessage && (
        <Banner tone="success" onDismiss={() => setSuccessMessage('')}>
          <Text>{successMessage}</Text>
        </Banner>
      )}
      
      <Layout>
        {/* Location selector */}
        <Card title="Select Location">
          {isLoading && locations.length === 0 ? (
            <Spinner />
          ) : (
            <Select
              label="Location"
              options={locations}
              value={selectedLocation}
              onChange={handleLocationChange}
              disabled={isLoading}
            />
          )}
        </Card>
        
        {/* Location settings */}
        {selectedLocation && (
          <Card title="Location Settings">
            {isLoading ? (
              <Spinner />
            ) : (
              <Layout>
                <TextField
                  label="Credit Limit per Transaction"
                  helpText="Maximum amount allowed for a single credit issuance (leave empty for no limit)"
                  type="currency"
                  prefix="$"
                  value={creditLimit}
                  onChange={setCreditLimit}
                  disabled={isSaving}
                />
                
                <Select
                  label="Require Manager Approval"
                  options={[
                    { label: 'Yes', value: 'true' },
                    { label: 'No', value: 'false' }
                  ]}
                  value={requiresApproval ? 'true' : 'false'}
                  onChange={(value) => setRequiresApproval(value === 'true')}
                  disabled={isSaving}
                />
                
                {requiresApproval && (
                  <TextField
                    label="Approval Threshold"
                    helpText="Amount above which manager approval is required"
                    type="currency"
                    prefix="$"
                    value={approvalThreshold}
                    onChange={setApprovalThreshold}
                    disabled={isSaving}
                  />
                )}
                
                <Select
                  label="Allow Refunds to Credit"
                  options={[
                    { label: 'Yes', value: 'true' },
                    { label: 'No', value: 'false' }
                  ]}
                  value={allowsRefunds ? 'true' : 'false'}
                  onChange={(value) => setAllowsRefunds(value === 'true')}
                  disabled={isSaving}
                />
                
                <Button
                  variant="primary"
                  onPress={saveLocationSettings}
                  loading={isSaving}
                >
                  Save Settings
                </Button>
              </Layout>
            )}
          </Card>
        )}
        
        {/* Information */}
        <Card title="About Multi-Location Support">
          <Text>Configure credit settings for each of your retail locations. These settings control how credits can be issued at this location.</Text>
          
          <Text variant="headingMd" as="h3">Settings explained:</Text>
          <List>
            <List.Item>
              <Text as="span" emphasis="bold">Credit Limit:</Text> Maximum amount that can be issued in a single transaction
            </List.Item>
            <List.Item>
              <Text as="span" emphasis="bold">Manager Approval:</Text> Whether manager approval is required for issuing credits
            </List.Item>
            <List.Item>
              <Text as="span" emphasis="bold">Approval Threshold:</Text> Amount above which manager approval is needed
            </List.Item>
            <List.Item>
              <Text as="span" emphasis="bold">Allow Refunds:</Text> Whether order refunds can be issued as store credit
            </List.Item>
          </List>
        </Card>
      </Layout>
    </Page>
  );
}

export default LocationManager; 