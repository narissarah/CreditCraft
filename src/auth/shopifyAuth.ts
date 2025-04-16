import { AppBridgeState, ClientApplication } from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { Redirect } from '@shopify/app-bridge/actions';
import { useAppBridge } from '@shopify/app-bridge-react';
import { useCallback, useEffect, useState } from 'react';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';

/**
 * Validates the JWT token from Shopify
 * @param token The JWT token to validate
 * @returns Boolean indicating if the token is valid
 */
export function validateShopifyToken(token: string): boolean {
  try {
    // Verify the token with our app's secret
    const decoded = jwt.verify(token, authConfig.shopify.apiSecret);
    return !!decoded;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Extracts shop information from a verified JWT token
 * @param token The validated JWT token
 * @returns Shop domain or null if invalid
 */
export function getShopFromToken(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as { dest: string } | null;
    return decoded?.dest || null;
  } catch (error) {
    console.error('Error extracting shop from token:', error);
    return null;
  }
}

/**
 * React hook to get Shopify session token
 * @returns Object with session token, loading state, and error
 */
export function useShopifyToken() {
  const app = useAppBridge();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchToken = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessionToken = await getSessionToken(app);
      setToken(sessionToken);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get session token'));
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [app]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return { token, isLoading, error, refreshToken: fetchToken };
}

/**
 * Redirects to Shopify admin if authentication fails
 * @param app AppBridge instance
 */
export function redirectToShopifyAdmin(app: ClientApplication<AppBridgeState>) {
  const redirect = Redirect.create(app);
  redirect.dispatch(Redirect.Action.ADMIN_PATH, '/');
}

/**
 * Creates an authenticated fetch function that includes the Shopify session token
 * @param app AppBridge instance
 * @returns Authenticated fetch function
 */
export function createAuthenticatedFetch(app: ClientApplication<AppBridgeState>) {
  return async (uri: RequestInfo, options?: RequestInit) => {
    try {
      const sessionToken = await getSessionToken(app);
      
      const headers = options?.headers || {};
      const authenticatedOptions: RequestInit = {
        ...options,
        headers: {
          ...headers,
          Authorization: `Bearer ${sessionToken}`,
        },
      };
      
      return fetch(uri, authenticatedOptions);
    } catch (error) {
      console.error('Authentication error:', error);
      redirectToShopifyAdmin(app);
      throw error;
    }
  };
} 