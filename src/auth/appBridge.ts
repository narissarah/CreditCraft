import {
  useAppBridge,
  AppBridgeProvider,
  RoutePropagator
} from '@shopify/app-bridge-react';
import { Provider as AppBridgeNextProvider } from '@shopify/app-bridge-react/next';
import { Redirect } from '@shopify/app-bridge/actions';
import { ClientApplication, AppBridgeState } from '@shopify/app-bridge';
import { useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { authConfig } from '../config/auth';

interface AppBridgeContextProps {
  children: ReactNode;
  shopOrigin?: string;
}

/**
 * Provides App Bridge context to the application
 */
export function AppBridgeContext({ children, shopOrigin }: AppBridgeContextProps) {
  const [host, setHost] = useState<string | null>(null);
  
  useEffect(() => {
    // Get the host from the URL query parameters
    const queryParams = new URLSearchParams(window.location.search);
    const hostParam = queryParams.get('host');
    
    if (hostParam) {
      setHost(hostParam);
    }
  }, []);
  
  // Only render the app when we have a host
  if (!host && !shopOrigin) {
    return null;
  }
  
  const config = {
    apiKey: authConfig.shopify.apiKey,
    host: host || shopOrigin || '',
    forceRedirect: true
  };
  
  return (
    <AppBridgeProvider config={config}>
      <AppBridgeRouting />
      {children}
    </AppBridgeProvider>
  );
}

/**
 * Next.js specific App Bridge provider
 */
export function NextAppBridgeProvider({ children }: { children: ReactNode }) {
  return (
    <AppBridgeNextProvider
      config={{
        apiKey: authConfig.shopify.apiKey,
        host: '',
        forceRedirect: true
      }}
    >
      {children}
    </AppBridgeNextProvider>
  );
}

/**
 * Handles route propagation for App Bridge
 */
function AppBridgeRouting() {
  const app = useAppBridge();
  
  return <RoutePropagator location="" app={app} />;
}

/**
 * Hook to check if App Bridge is available and ready
 */
export function useAppBridgeStatus() {
  const app = useAppBridge();
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    if (app) {
      setIsReady(true);
    }
  }, [app]);
  
  return { isReady, app };
}

/**
 * Hook to handle App Bridge history/navigation
 */
export function useAppBridgeNavigation() {
  const app = useAppBridge();
  
  const navigate = useCallback((path: string) => {
    if (!app) return;
    
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.APP, path);
  }, [app]);
  
  const redirectToAdmin = useCallback((path: string = '/') => {
    if (!app) return;
    
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.ADMIN_PATH, path);
  }, [app]);
  
  return { navigate, redirectToAdmin };
}

/**
 * Hook to handle App Bridge modal interactions
 */
export function useAppBridgeModal() {
  const app = useAppBridge();
  
  const openModal = useCallback((url: string, title: string) => {
    if (!app) return;
    
    const modalOptions = {
      url,
      title,
      width: 'large',
    };
    
    // The actual modal implementation would go here
    // This is a placeholder as it depends on specific App Bridge version and components
    console.log('Opening modal with options:', modalOptions);
  }, [app]);
  
  return { openModal };
} 