import { useAppBridge } from '@shopify/app-bridge-react';
import { Redirect, Modal, Toast, Button, fullPageLoad } from '@shopify/app-bridge/actions';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { useCallback, useState, useEffect } from 'react';

/**
 * Custom hook for App Bridge functionality
 * Provides common App Bridge actions and utilities
 */
export function useShopifyBridge() {
  const app = useAppBridge();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  // Initialize loading indicator
  const startLoading = useCallback(() => {
    const loading = fullPageLoad(app);
    loading.dispatch(fullPageLoad.Action.START);
    setIsLoading(true);
    return loading;
  }, [app]);
  
  // Stop loading indicator
  const stopLoading = useCallback((loading: any) => {
    loading.dispatch(fullPageLoad.Action.STOP);
    setIsLoading(false);
  }, []);
  
  // Get session token
  const getToken = useCallback(async () => {
    try {
      const sessionToken = await getSessionToken(app);
      setToken(sessionToken);
      return sessionToken;
    } catch (error) {
      console.error('Error getting session token:', error);
      return null;
    }
  }, [app]);
  
  // Refresh token when app bridge is available
  useEffect(() => {
    if (app) {
      getToken();
    }
  }, [app, getToken]);
  
  // Create navigation functions
  const navigate = useCallback((path: string) => {
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.APP, path);
  }, [app]);
  
  // Redirect to admin
  const redirectToAdmin = useCallback((path: string = '/') => {
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.ADMIN_PATH, path);
  }, [app]);
  
  // Open modal
  const openModal = useCallback((title: string, content: React.ReactNode) => {
    const modal = Modal.create(app, {
      title,
      message: content,
      primaryAction: {
        content: 'OK',
        onAction: () => modal.dispatch(Modal.Action.CLOSE),
      },
    });
    modal.dispatch(Modal.Action.OPEN);
    return modal;
  }, [app]);
  
  // Show toast notification
  const showToast = useCallback((message: string, isError: boolean = false) => {
    const toast = Toast.create(app, {
      message,
      duration: 5000,
      isError,
    });
    toast.dispatch(Toast.Action.SHOW);
  }, [app]);
  
  // Create confirmed action with a confirmation modal
  const confirmAction = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmText: string = 'Confirm', 
    cancelText: string = 'Cancel'
  ) => {
    const modal = Modal.create(app, {
      title,
      message,
      primaryAction: {
        content: confirmText,
        onAction: () => {
          onConfirm();
          modal.dispatch(Modal.Action.CLOSE);
        },
      },
      secondaryActions: [
        {
          content: cancelText,
          onAction: () => modal.dispatch(Modal.Action.CLOSE),
        },
      ],
    });
    modal.dispatch(Modal.Action.OPEN);
  }, [app]);
  
  // Create authenticated fetch function
  const authenticatedFetch = useCallback(
    async (uri: RequestInfo, options: RequestInit = {}) => {
      const sessionToken = await getToken();

      if (!sessionToken) {
        throw new Error('Could not get session token for API call');
      }
      
      const headers = options.headers || {};
      return fetch(uri, {
        ...options,
        headers: {
          ...headers,
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
    },
    [getToken]
  );
  
  return {
    app,
    isLoading,
    token,
    getToken,
    navigate,
    redirectToAdmin,
    openModal,
    showToast,
    confirmAction,
    authenticatedFetch,
    startLoading,
    stopLoading,
  };
}

export default useShopifyBridge; 