import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocationManager } from '../utils/locationManager';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge-utils';

// Create context
const LocationCreditContext = createContext(null);

/**
 * Context provider for location-based credit management
 * Handles credit operations specific to the current location
 */
export function LocationCreditProvider({ children }) {
  const app = useAppBridge();
  const authFetch = authenticatedFetch(app);
  const { currentLocation } = useLocationManager();
  
  const [locationCredits, setLocationCredits] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch credits for the current location
  const fetchLocationCredits = useCallback(async (customerId) => {
    if (!customerId || !currentLocation) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const locationId = currentLocation.id;
      const response = await authFetch(`/api/credits/customer/${customerId}?locationId=${locationId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch location credits');
      }
      
      const data = await response.json();
      
      // Store credits by location and customer ID
      setLocationCredits(prev => ({
        ...prev,
        [locationId]: {
          ...prev[locationId],
          [customerId]: data
        }
      }));
      
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching location credits:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, currentLocation]);
  
  // Issue credit at current location
  const issueCredit = useCallback(async (customerId, amount, reason) => {
    if (!customerId || !currentLocation) {
      throw new Error('Customer ID and location are required');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const locationId = currentLocation.id;
      const response = await authFetch('/api/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId,
          amount,
          reason,
          locationId,
          source: 'pos'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to issue credit');
      }
      
      const data = await response.json();
      
      // Refresh credits for this customer at this location
      await fetchLocationCredits(customerId);
      
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error issuing credit:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, currentLocation, fetchLocationCredits]);
  
  // Apply credit at current location
  const applyCredit = useCallback(async (creditId, orderReference, amount) => {
    if (!creditId || !currentLocation) {
      throw new Error('Credit ID and location are required');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const locationId = currentLocation.id;
      const response = await authFetch(`/api/credits/${creditId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderReference,
          amount,
          locationId,
          source: 'pos'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply credit');
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      console.error('Error applying credit:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, currentLocation]);
  
  // Get cached credits for customer at current location
  const getCustomerCredits = useCallback((customerId) => {
    if (!customerId || !currentLocation) return null;
    
    const locationId = currentLocation.id;
    return locationCredits[locationId]?.[customerId] || null;
  }, [locationCredits, currentLocation]);
  
  // Clear cached credits when location changes
  useEffect(() => {
    if (currentLocation) {
      // Keep only the current location's credits in cache
      setLocationCredits(prev => {
        const { [currentLocation.id]: currentLocationCredits, ...rest } = prev;
        return currentLocationCredits ? { [currentLocation.id]: currentLocationCredits } : {};
      });
    }
  }, [currentLocation]);
  
  const contextValue = {
    isLoading,
    error,
    fetchLocationCredits,
    issueCredit,
    applyCredit,
    getCustomerCredits,
    currentLocation
  };
  
  return (
    <LocationCreditContext.Provider value={contextValue}>
      {children}
    </LocationCreditContext.Provider>
  );
}

// Custom hook to use the location credit context
export function useLocationCredit() {
  const context = useContext(LocationCreditContext);
  
  if (!context) {
    throw new Error('useLocationCredit must be used within a LocationCreditProvider');
  }
  
  return context;
}

export default LocationCreditContext; 