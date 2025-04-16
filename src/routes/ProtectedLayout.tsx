import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';
import { AppBridgeAuthProvider } from '../components/AppBridgeAuthProvider';

interface ProtectedLayoutProps {
  children?: ReactNode;
}

/**
 * Layout component for routes that require authentication
 * Wraps protected content with AppBridgeAuthProvider and PrivateRoute
 */
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <AppBridgeAuthProvider>
      <PrivateRoute>
        {children || <Outlet />}
      </PrivateRoute>
    </AppBridgeAuthProvider>
  );
}

export default ProtectedLayout; 