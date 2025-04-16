import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Stack,
  Button,
  SettingToggle,
  Spinner,
  Banner,
  InlineStack,
  Box,
  HorizontalStack,
  Divider
} from '@shopify/polaris';
import { useAPI } from '../../hooks/useAPI';
import { useToast } from '../../hooks/useToast';
import { CustomerType } from '../../types/customer';

interface NotificationPreference {
  id: string;
  customerId: string;
  emailEnabled: boolean;
  creditIssued: boolean;
  creditExpiring: boolean;
  creditRedeemed: boolean;
  balanceUpdates: boolean;
  promotions: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationPreferencesProps {
  customer: CustomerType;
  onUpdate?: () => void;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ 
  customer,
  onUpdate
}) => {
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const api = useAPI();
  const { showToast } = useToast();
  
  // Fetch customer notification preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!customer?.id) return;
      
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/notifications/customer/${customer.id}/preferences`);
        setPreferences(response.data);
      } catch (err) {
        console.error('Error fetching notification preferences:', err);
        setError('Failed to load notification preferences');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreferences();
  }, [customer?.id, api]);
  
  // Update a specific preference
  const updatePreference = async (key: keyof NotificationPreference, value: boolean) => {
    if (!customer?.id || !preferences) return;
    
    try {
      setSaving(true);
      setError('');
      
      // Optimistic update
      setPreferences({
        ...preferences,
        [key]: value
      });
      
      // Update on server
      await api.put(`/notifications/customer/${customer.id}/preferences`, {
        [key]: value
      });
      
      if (onUpdate) {
        onUpdate();
      }
      
      showToast('Notification preferences updated', 'success');
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      setError('Failed to update preferences');
      showToast('Failed to update preferences', 'error');
      
      // Revert optimistic update
      const response = await api.get(`/notifications/customer/${customer.id}/preferences`);
      setPreferences(response.data);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Card>
        <Card.Section>
          <Box padding="400" textAlign="center">
            <Spinner accessibilityLabel="Loading notification preferences" />
          </Box>
        </Card.Section>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header title="Notification Preferences" />
      
      {error && (
        <Card.Section>
          <Banner status="critical">
            {error}
          </Banner>
        </Card.Section>
      )}
      
      <Card.Section>
        <Stack vertical>
          <Text variant="bodyMd">
            Configure which types of notifications this customer will receive.
          </Text>
          
          <Box paddingBlockStart="400">
            <SettingToggle
              action={{
                content: preferences?.emailEnabled ? 'Disable' : 'Enable',
                loading: saving,
                onAction: () => updatePreference('emailEnabled', !preferences?.emailEnabled),
              }}
              enabled={preferences?.emailEnabled || false}
            >
              <Text as="span" variant="headingSm" fontWeight="semibold">
                Email Notifications
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Master toggle for all email notifications
              </Text>
            </SettingToggle>
          </Box>
        </Stack>
      </Card.Section>
      
      <Card.Section>
        <Text variant="headingSm" as="h3">
          Notification Types
        </Text>
        <Box paddingBlockStart="300">
          <Stack vertical>
            <SettingToggle
              action={{
                content: preferences?.creditIssued ? 'Disable' : 'Enable',
                loading: saving,
                disabled: !preferences?.emailEnabled,
                onAction: () => updatePreference('creditIssued', !preferences?.creditIssued),
              }}
              enabled={preferences?.creditIssued || false}
            >
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Credit Issued
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Notification when a new credit is issued to the customer
              </Text>
            </SettingToggle>
            
            <SettingToggle
              action={{
                content: preferences?.creditExpiring ? 'Disable' : 'Enable',
                loading: saving,
                disabled: !preferences?.emailEnabled,
                onAction: () => updatePreference('creditExpiring', !preferences?.creditExpiring),
              }}
              enabled={preferences?.creditExpiring || false}
            >
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Credit Expiring
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Reminders when credits are about to expire
              </Text>
            </SettingToggle>
            
            <SettingToggle
              action={{
                content: preferences?.creditRedeemed ? 'Disable' : 'Enable',
                loading: saving,
                disabled: !preferences?.emailEnabled,
                onAction: () => updatePreference('creditRedeemed', !preferences?.creditRedeemed),
              }}
              enabled={preferences?.creditRedeemed || false}
            >
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Credit Redeemed
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Confirmation when a credit is redeemed
              </Text>
            </SettingToggle>
            
            <SettingToggle
              action={{
                content: preferences?.balanceUpdates ? 'Disable' : 'Enable',
                loading: saving,
                disabled: !preferences?.emailEnabled,
                onAction: () => updatePreference('balanceUpdates', !preferences?.balanceUpdates),
              }}
              enabled={preferences?.balanceUpdates || false}
            >
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Balance Updates
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Notifications about changes to credit balance
              </Text>
            </SettingToggle>
            
            <SettingToggle
              action={{
                content: preferences?.promotions ? 'Disable' : 'Enable',
                loading: saving,
                disabled: !preferences?.emailEnabled,
                onAction: () => updatePreference('promotions', !preferences?.promotions),
              }}
              enabled={preferences?.promotions || false}
            >
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Promotions
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Marketing notifications about credit promotions
              </Text>
            </SettingToggle>
          </Stack>
        </Box>
      </Card.Section>
    </Card>
  );
};

export default NotificationPreferences; 