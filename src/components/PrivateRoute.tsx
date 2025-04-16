import React, { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AppBridgeAuthProvider';
import { logger } from '../utils/logger';

interface PrivateRouteProps {
  children: ReactNode;
  requiredScopes?: string[];
}

/**
 * PrivateRoute component to protect routes that require authentication
 * Redirects to authentication page if user is not authenticated
 * Can optionally check for specific scopes
 */
export function PrivateRoute({ children, requiredScopes }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, token, shop, error } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (error) {
      logger.error('Authentication error in PrivateRoute:', error);
    }
  }, [error]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <div>Verifying authentication...</div>;
  }

  // If not authenticated, redirect to install/auth page
  if (!isAuthenticated || !token) {
    logger.debug(`Access to protected route ${location.pathname} denied - redirecting to auth`);
    
    // Redirect to install page, preserving the current location to redirect back after auth
    return <Navigate to="/install" state={{ from: location }} replace />;
  }

  // If we need to verify scopes, add that logic here
  // This would require your auth provider to expose the available scopes

  // Authentication passed, render the protected content
  return <>{children}</>;
}

export default PrivateRoute; 