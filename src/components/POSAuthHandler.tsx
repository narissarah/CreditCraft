import React, { ReactNode, useEffect, useState } from 'react';
import { usePOSAppBridgeAuth, usePOSOfflineAuth } from '../auth/posAppBridge';

interface POSAuthHandlerProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireOfflineAccess?: boolean;
}

/**
 * Component to handle POS-specific authentication
 * This wraps content that requires authenticated POS context
 */
export function POSAuthHandler({ 
  children, 
  fallback = <div>Loading POS context...</div>,
  requireOfflineAccess = false
}: POSAuthHandlerProps) {
  const { 
    isPOSEnvironment,
    posContext,
    isLoading,
    error,
    authenticatedFetch
  } = usePOSAppBridgeAuth();
  
  const {
    isOnline,
    hasOfflineAccess,
    storeOfflineToken
  } = usePOSOfflineAuth();
  
  const [hasRequiredPermissions, setHasRequiredPermissions] = useState(false);
  
  // Check if we have the required permissions for this component
  useEffect(() => {
    if (posContext && posContext.permissions) {
      // This is an example - adjust based on your specific permission needs
      const requiredPermissions = ['read_customers', 'write_customers'];
      const hasAll = requiredPermissions.every(
        perm => posContext.permissions.includes(perm)
      );
      setHasRequiredPermissions(hasAll);
    }
  }, [posContext]);
  
  // Store offline token when online
  useEffect(() => {
    if (isOnline && requireOfflineAccess && posContext && posContext.offlineAccessToken) {
      storeOfflineToken(posContext.offlineAccessToken);
    }
  }, [isOnline, requireOfflineAccess, posContext, storeOfflineToken]);
  
  // Show loading state
  if (isLoading) {
    return <>{fallback}</>;
  }
  
  // Handle errors
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  
  // If we're not in a POS environment, show an error
  if (!isPOSEnvironment) {
    return <div>This feature is only available in Shopify POS.</div>;
  }
  
  // If offline access is required but not available
  if (requireOfflineAccess && !isOnline && !hasOfflineAccess) {
    return (
      <div>
        <h3>Offline access required</h3>
        <p>This feature requires offline access permissions. Please connect to the internet and try again.</p>
      </div>
    );
  }
  
  // If we don't have the required permissions
  if (!hasRequiredPermissions) {
    return (
      <div>
        <h3>Insufficient permissions</h3>
        <p>This app requires additional permissions. Please contact your store administrator.</p>
      </div>
    );
  }
  
  // All checks passed, render the child components
  return <>{children}</>;
}

/**
 * Example usage in a component:
 * 
 * function POSCustomerView() {
 *   return (
 *     <POSAuthHandler requireOfflineAccess={true}>
 *       <CustomerLookupForm />
 *       <CreditManagement />
 *     </POSAuthHandler>
 *   );
 * }
 */

export function POSCreditIssueFlow() {
  const { authenticatedFetch } = usePOSAppBridgeAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const handleCreditIssue = async (customerId: string, amount: number) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch('/api/pos/issue-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          amount,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to issue credit');
      }
      
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setSuccess(false);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <POSAuthHandler>
      <div className="pos-credit-issue-flow">
        <h2>Issue Store Credit</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {success && (
          <div className="success-message">
            Credit issued successfully!
          </div>
        )}
        
        {/* Credit issuing form would go here */}
        <p>Form implementation would go here with handleCreditIssue callback</p>
        
        <button 
          disabled={isProcessing}
          onClick={() => handleCreditIssue('sample-customer-id', 100)}
        >
          {isProcessing ? 'Processing...' : 'Issue Credit (Sample)'}
        </button>
      </div>
    </POSAuthHandler>
  );
} 