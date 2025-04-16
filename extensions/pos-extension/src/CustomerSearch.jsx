import {
  reactExtension,
  useApi,
  TextField,
  BlockStack,
  Button,
  Text,
  Divider,
  List,
  ListItem,
  InlineLayout,
  useExtensionData
} from '@shopify/ui-extensions-react/point-of-sale';
import { useState, useCallback } from 'react';

/**
 * Customer Search Component
 * Allows staff to search for customers by name, email, or phone
 * and select them for credit operations
 */
function CustomerSearch() {
  const { cart, toast, global, session } = useApi();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);

  // Search for customers
  const handleSearch = useCallback(async () => {
    if (!searchTerm || searchTerm.length < 3) {
      toast.show('Please enter at least 3 characters to search');
      return;
    }

    setLoading(true);
    
    try {
      // Get session token for authenticated requests
      const token = await session.getSessionToken();
      
      const response = await fetch(`/api/pos/customers/search?query=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Shopify-Shop-Domain': cart.shop?.domain || '',
          'X-POS-Device-ID': session.device?.id || '',
        }
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setCustomers(data.customers || []);
      
      if (data.customers.length === 0) {
        toast.show('No customers found');
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.show('Failed to search for customers');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, cart.shop, session, toast]);

  // Select a customer
  const selectCustomer = useCallback(async (customer) => {
    try {
      await cart.setCustomer({ id: customer.id });
      toast.show(`Customer selected: ${customer.firstName} ${customer.lastName}`);
      
      // Fetch customer credit information
      const token = await session.getSessionToken();
      const response = await fetch(`/api/pos/customer/${customer.id}/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Shopify-Shop-Domain': cart.shop?.domain || '',
          'X-POS-Device-ID': session.device?.id || '',
        }
      });
      
      if (response.ok) {
        const creditData = await response.json();
        global.alert({
          title: 'Customer Credit Balance',
          message: `Available: $${creditData.available.toFixed(2)}\n${creditData.expiring > 0 ? `$${creditData.expiring.toFixed(2)} expiring on ${creditData.expiryDate}` : ''}`,
        });
      }
    } catch (err) {
      console.error('Customer selection error:', err);
      toast.show('Failed to select customer');
    }
  }, [cart, toast, global, session]);

  return (
    <BlockStack spacing="tight">
      <InlineLayout blockAlignment="center" spacing="base">
        <TextField
          label="Search by name, email, or phone"
          value={searchTerm}
          onChange={setSearchTerm}
          onEnter={handleSearch}
        />
        <Button
          kind="primary"
          loading={loading}
          onPress={handleSearch}
        >
          Search
        </Button>
      </InlineLayout>
      
      {customers.length > 0 && (
        <>
          <Divider />
          <Text>Results ({customers.length})</Text>
          <List>
            {customers.map(customer => (
              <ListItem
                key={customer.id}
                onPress={() => selectCustomer(customer)}
              >
                <BlockStack spacing="none">
                  <Text emphasis="bold">{customer.firstName} {customer.lastName}</Text>
                  <Text>{customer.email}</Text>
                  {customer.phone && <Text>{customer.phone}</Text>}
                </BlockStack>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </BlockStack>
  );
}

export default reactExtension(
  "pos.checkout.customer.picker.render",
  () => <CustomerSearch />
); 