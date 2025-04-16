import { useAppBridge } from '@shopify/app-bridge-react';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { useCallback, useEffect, useState } from 'react';
import { createAuthenticatedFetch } from './shopifyAuth';

/**
 * Hook for handling POS-specific App Bridge authentication
 * Provides session token and authenticated fetch for POS UI extensions
 */
export function usePOSAppBridgeAuth() {
  const app = useAppBridge();
  const [posContext, setPOSContext] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Create authenticated fetch function
  const authenticatedFetch = useCallback(
    createAuthenticatedFetch(app),
    [app]
  );
  
  // Get POS context including location, device, and permissions
  const getPOSContext = useCallback(async () => {
    setIsLoading(true);
    try {
      // This is a mock/placeholder. In a real implementation,
      // you would get this from the POS extension context
      const response = await authenticatedFetch('/api/pos/context');
      const context = await response.json();
      setPOSContext(context);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get POS context'));
      setPOSContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedFetch]);
  
  useEffect(() => {
    if (app) {
      getPOSContext();
    }
  }, [app, getPOSContext]);
  
  // Verify if we're running in a POS context
  const isPOSEnvironment = useCallback(() => {
    // Check if the app is running in a POS environment
    // This could be determined by URL, user agent, or context
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('shopify pos') || 
           window.location.href.includes('pos.shopify.com');
  }, []);
  
  // Get session token
  const getToken = useCallback(async () => {
    try {
      const token = await getSessionToken(app);
      return token;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get POS session token'));
      return null;
    }
  }, [app]);
  
  // Verify permissions for specific POS operations
  const hasPermission = useCallback((permission: string) => {
    if (!posContext || !posContext.permissions) {
      return false;
    }
    return posContext.permissions.includes(permission);
  }, [posContext]);
  
  return {
    isPOSEnvironment: isPOSEnvironment(),
    posContext,
    isLoading,
    error,
    getToken,
    authenticatedFetch,
    refreshContext: getPOSContext,
    hasPermission,
  };
}

/**
 * Hook for handling offline authentication in POS
 * Verifies if the device is online and manages offline tokens
 */
export function usePOSOfflineAuth() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineToken, setOfflineToken] = useState<string | null>(null);
  
  // Listen for online/offline status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check if we have a stored offline token
    const storedToken = localStorage.getItem('pos_offline_token');
    if (storedToken) {
      setOfflineToken(storedToken);
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Store an offline token for use when device is offline
  const storeOfflineToken = useCallback((token: string) => {
    localStorage.setItem('pos_offline_token', token);
    setOfflineToken(token);
  }, []);
  
  // Clear the offline token
  const clearOfflineToken = useCallback(() => {
    localStorage.removeItem('pos_offline_token');
    setOfflineToken(null);
  }, []);
  
  return {
    isOnline,
    offlineToken,
    storeOfflineToken,
    clearOfflineToken,
    hasOfflineAccess: !!offlineToken,
  };
} 