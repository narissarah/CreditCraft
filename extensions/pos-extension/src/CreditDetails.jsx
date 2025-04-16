import {
  reactExtension,
  useApi,
  TextBlock,
  BlockStack,
  View,
  Text,
  Button,
  Heading,
  Spinner,
  Banner,
  useExtensionData
} from '@shopify/ui-extensions-react/point-of-sale';
import { useState, useEffect, useCallback } from 'react';

/**
 * Credit Details Component
 * Shows customer credit information during checkout
 * and allows applying credit to the current order
 */
function CreditDetails() {
  const { cart, toast, global, session } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creditData, setCreditData] = useState(null);
  const [applying, setApplying] = useState(false);

  // Fetch customer credit data when a customer is selected
  useEffect(() => {
    const fetchCreditData = async () => {
      if (!cart.customer) {
        setCreditData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await session.getSessionToken();
        const response = await fetch(`/api/pos/customer/${cart.customer.id}/balance`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Shopify-Shop-Domain': cart.shop?.domain || '',
            'X-POS-Device-ID': session.device?.id || '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch credit data');
        }

        const data = await response.json();
        setCreditData(data);
      } catch (err) {
        console.error('Error fetching credit data:', err);
        setError('Failed to load credit information. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCreditData();
  }, [cart.customer, cart.shop, session]);

  // Apply credit to the current order
  const handleApplyCredit = useCallback(async () => {
    if (!creditData || creditData.available <= 0 || !cart.customer) {
      return;
    }

    const orderTotal = cart.totalPrice?.amount || 0;
    if (orderTotal <= 0) {
      toast.show('Cannot apply credit to a zero-value order');
      return;
    }

    // Either apply the full credit amount or just the order total
    const amountToApply = Math.min(creditData.available, orderTotal);

    // Confirm with the user
    global.confirm({
      title: 'Apply Store Credit',
      message: `Apply $${amountToApply.toFixed(2)} store credit to this order?`,
      primaryAction: {
        content: 'Apply Credit',
        onAction: async () => {
          setApplying(true);
          try {
            const token = await session.getSessionToken();
            const response = await fetch(`/api/pos/redeem-credit`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Shopify-Shop-Domain': cart.shop?.domain || '',
                'X-POS-Device-ID': session.device?.id || '',
              },
              body: JSON.stringify({
                customerId: cart.customer.id,
                amount: amountToApply,
                orderId: cart.id
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to apply credit');
            }

            // Show success message
            toast.show(`$${amountToApply.toFixed(2)} credit applied successfully`);
            
            // Refresh credit data
            const updatedResponse = await fetch(`/api/pos/customer/${cart.customer.id}/balance`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Shopify-Shop-Domain': cart.shop?.domain || '',
                'X-POS-Device-ID': session.device?.id || '',
              }
            });
            
            if (updatedResponse.ok) {
              const newData = await updatedResponse.json();
              setCreditData(newData);
            }
            
            // Create a discount line item (this would be handled by the backend in reality)
            // This is just a visual indication in the UI
            // The actual discount processing happens on the backend
            try {
              await cart.addLineItem({
                variantId: 'credit-applied',
                quantity: 1,
                price: -amountToApply,
                title: 'Store Credit Applied'
              });
            } catch (cartErr) {
              console.error('Could not add line item to cart:', cartErr);
              // Don't fail the operation if we can't update the cart visually
              // The backend has already processed the credit
            }
          } catch (err) {
            console.error('Error applying credit:', err);
            toast.show(err.message || 'Failed to apply credit');
          } finally {
            setApplying(false);
          }
        }
      },
      secondaryAction: {
        content: 'Cancel',
        onAction: () => {}
      }
    });
  }, [creditData, cart, toast, global, session]);

  // No customer selected
  if (!cart.customer) {
    return (
      <View padding="base">
        <TextBlock>No customer selected. Please select a customer to view credit information.</TextBlock>
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View padding="base">
        <BlockStack spacing="tight" inlineAlignment="center">
          <Spinner size="large" />
          <Text>Loading credit information...</Text>
        </BlockStack>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View padding="base">
        <Banner status="critical">
          <Text>{error}</Text>
        </Banner>
      </View>
    );
  }

  // No credit data or zero available credit
  if (!creditData || creditData.available <= 0) {
    return (
      <View padding="base">
        <TextBlock>This customer has no available store credit.</TextBlock>
      </View>
    );
  }

  return (
    <View padding="base" cornerRadius="base" border="base">
      <BlockStack spacing="tight">
        <Heading>Available Store Credit</Heading>
        
        <BlockStack spacing="extraTight">
          <Text size="large" emphasis="bold">${creditData.available.toFixed(2)}</Text>
          
          {creditData.expiring > 0 && (
            <Text appearance="subdued">
              ${creditData.expiring.toFixed(2)} expiring on {creditData.expiryDate}
            </Text>
          )}
        </BlockStack>
        
        <Button
          kind="primary"
          onPress={handleApplyCredit}
          loading={applying}
          disabled={applying || creditData.available <= 0 || !(cart.totalPrice?.amount > 0)}
        >
          Apply Credit to Order
        </Button>
        
        {!(cart.totalPrice?.amount > 0) && (
          <Text appearance="subdued" size="small">
            Credit can only be applied to orders with items
          </Text>
        )}
      </BlockStack>
    </View>
  );
}

export default reactExtension(
  "pos.checkout.cart.footer.render",
  () => <CreditDetails />
); 