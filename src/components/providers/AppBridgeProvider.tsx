import React, { ReactNode, useMemo } from 'react';
import { Provider } from '@shopify/app-bridge-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { shopifyConfig } from '../../config/shopify';

// Interface for AppBridgeProvider props
interface AppBridgeProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Shopify App Bridge
 * Wraps the application to provide App Bridge context
 */
export function AppBridgeProvider({ children }: AppBridgeProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract query parameters from URL
  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);
  
  // Get shop and host from query parameters
  const shop = queryParams.get('shop');
  const host = queryParams.get('host');
  
  // Create App Bridge config
  const config = useMemo(() => {
    if (!shop) {
      console.warn('Shop parameter is missing. App Bridge may not initialize correctly.');
    }
    
    return {
      apiKey: shopifyConfig.apiKey,
      host: host || '',
      forceRedirect: true,
    };
  }, [shop, host]);
  
  // If shop is missing and we're not on the auth page, redirect to auth
  React.useEffect(() => {
    if (!shop && !location.pathname.includes('/auth')) {
      const authUrl = '/auth';
      navigate(authUrl);
    }
  }, [shop, navigate, location]);
  
  // If we don't have required parameters, don't render children yet
  if (!config.host && !shop) {
    // Optional: Render a loading state or redirect
    return null;
  }
  
  return (
    <Provider config={config}>
      {children}
    </Provider>
  );
}

export default AppBridgeProvider; 