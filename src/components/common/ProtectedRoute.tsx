import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useShopifyBridge from '../../hooks/useAppBridge';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protected route component that requires App Bridge authentication
 * Redirects to auth flow if not authenticated
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { token, getToken, isLoading } = useShopifyBridge();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();
  
  // Check authentication when component mounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First, check if we already have a token
        if (token) {
          setIsAuthenticated(true);
          return;
        }
        
        // If not, try to get a new token
        const newToken = await getToken();
        setIsAuthenticated(!!newToken);
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, [token, getToken]);
  
  // Show loading screen while checking authentication
  if (isLoading || isAuthenticated === null) {
    return <LoadingScreen message="Checking authentication..." />;
  }
  
  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    // Get shop from query params if available
    const searchParams = new URLSearchParams(location.search);
    const shop = searchParams.get('shop');
    const redirectUrl = shop ? `/auth?shop=${shop}` : '/auth';
    
    return <Navigate to={redirectUrl} replace />;
  }
  
  // If authenticated, render children
  return <>{children}</>;
}

/**
 * Higher-order component to protect routes that require authentication
 */
export function withAppBridgeAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function WithAuth(props: P) {
    return (
      <ProtectedRoute>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

export default ProtectedRoute; 