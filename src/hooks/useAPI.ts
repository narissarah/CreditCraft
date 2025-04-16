import { useMemo } from 'react';
import axios, { AxiosInstance } from 'axios';
import { useAuthenticatedFetch } from '@shopify/app-bridge-react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { getSessionToken } from '@shopify/app-bridge/utilities';

export const useAPI = (): AxiosInstance => {
  const app = useAppBridge();
  const authenticatedFetch = useAuthenticatedFetch();
  
  return useMemo(() => {
    const instance = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add interceptor to add session token
    instance.interceptors.request.use(async (config) => {
      const token = await getSessionToken(app);
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });
    
    // Add response interceptor for error handling
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Handle 401 Unauthorized - redirect to auth
          const authUrlHeader = error.response.headers['x-shopify-api-request-failure-reauthorize-url'];
          if (authUrlHeader) {
            window.location.assign(authUrlHeader);
            return;
          }
        }
        
        // Pass the error through
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [app, authenticatedFetch]);
}; 