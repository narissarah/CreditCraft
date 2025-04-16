import React, { useState, useCallback, useEffect } from 'react';
import {
  TextField,
  Button,
  Stack,
  Spinner,
  Banner,
  List,
  Avatar,
  Text,
  EmptyState
} from '@shopify/polaris';
import { useAppBridge } from '../hooks/useAppBridge';
import { SearchMinor, CustomersMajor } from '@shopify/polaris-icons';

/**
 * Customer search component for POS extension
 * Allows staff to search for customers by name, email, or phone number
 * Displays search results with options to select a customer
 */
function CustomerSearch({ onSelectCustomer, initialQuery = '' }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noResults, setNoResults] = useState(false);
  
  const { fetchWithAuth } = useAppBridge();
  
  // Search for customers using the API
  const searchCustomers = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setNoResults(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setNoResults(false);
    
    try {
      const response = await fetchWithAuth(`/api/customers/search?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Failed to search customers');
      }
      
      const data = await response.json();
      setSearchResults(data.customers || []);
      setNoResults(data.customers.length === 0);
    } catch (err) {
      console.error('Error searching customers:', err);
      setError('Could not search for customers. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  
  // Handle search submission
  const handleSearch = useCallback(() => {
    searchCustomers(searchQuery);
  }, [searchQuery, searchCustomers]);
  
  // Handle enter key press in search field
  const handleKeyPress = useCallback((event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);
  
  // Perform search when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      searchCustomers(initialQuery);
    }
  }, [initialQuery, searchCustomers]);
  
  // Handle customer selection
  const handleSelectCustomer = useCallback((customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
  }, [onSelectCustomer]);
  
  // Format customer name and details for display
  const formatCustomerDetails = useCallback((customer) => {
    const name = customer.firstName && customer.lastName
      ? `${customer.firstName} ${customer.lastName}`
      : customer.email || 'Unknown customer';
      
    let details = [];
    if (customer.email) details.push(customer.email);
    if (customer.phone) details.push(customer.phone);
    
    return { name, details: details.join(' • ') };
  }, []);
  
  return (
    <div className="customer-search">
      <Stack vertical spacing="tight">
        {error && (
          <Banner status="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        
        <Stack alignment="center">
          <Stack.Item fill>
            <TextField
              label="Search customers"
              value={searchQuery}
              onChange={value => setSearchQuery(value)}
              placeholder="Name, email, or phone number"
              autoComplete="off"
              onKeyPress={handleKeyPress}
              prefix={<SearchMinor />}
              clearButton
              onClearButtonClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setNoResults(false);
              }}
            />
          </Stack.Item>
          <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
            Search
          </Button>
        </Stack>
        
        {isLoading ? (
          <div className="customer-search__loading">
            <Spinner accessibilityLabel="Searching customers" size="small" />
            <Text variant="bodyMd" as="p">Searching...</Text>
          </div>
        ) : noResults ? (
          <EmptyState
            heading="No customers found"
            image={CustomersMajor}
            imageContained
          >
            <p>Try a different search term</p>
          </EmptyState>
        ) : searchResults.length > 0 && (
          <div className="customer-search__results">
            <Text variant="headingMd" as="h3">Search Results</Text>
            <List type="bullet">
              {searchResults.map(customer => {
                const { name, details } = formatCustomerDetails(customer);
                return (
                  <List.Item key={customer.id}>
                    <button 
                      className="customer-search__result-item"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <Stack alignment="center" spacing="tight">
                        <Avatar customer size="medium" name={name} />
                        <Stack vertical spacing="extraTight">
                          <Text variant="bodyMd" as="p" fontWeight="semibold">{name}</Text>
                          <Text variant="bodySm" as="p" color="subdued">{details}</Text>
                        </Stack>
                      </Stack>
                    </button>
                  </List.Item>
                );
              })}
            </List>
          </div>
        )}
      </Stack>
      
      <style jsx>{`
        .customer-search {
          margin: 1rem 0;
        }
        .customer-search__loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          gap: 0.5rem;
        }
        .customer-search__results {
          margin-top: 1rem;
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid var(--p-border-subdued);
          border-radius: var(--p-border-radius-base);
          padding: 0.5rem;
        }
        .customer-search__result-item {
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: var(--p-border-radius-base);
        }
        .customer-search__result-item:hover {
          background-color: var(--p-surface-hovered);
        }
      `}</style>
    </div>
  );
}

export default CustomerSearch; 