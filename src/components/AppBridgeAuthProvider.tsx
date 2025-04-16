import React, { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppBridgeContext } from '../auth/appBridge';
import { useShopifyToken } from '../auth/shopifyAuth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  shop: string | null;
  error: Error | null;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  token: null,
  shop: null,
  error: null,
  refreshAuth: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AppBridgeAuthProviderProps {
  children: ReactNode;
}

export function AppBridgeAuthProvider({ children }: AppBridgeAuthProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [shop, setShop] = useState<string | null>(null);
  
  // Get the shop from the URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const shopParam = queryParams.get('shop');
    
    if (shopParam) {
      setShop(shopParam);
    }
  }, [location]);
  
  // If no shop is found, redirect to the installation page
  useEffect(() => {
    if (!shop && !location.pathname.includes('/install')) {
      navigate('/install');
    }
  }, [shop, navigate, location]);
  
  return (
    <AppBridgeContext shopOrigin={shop || undefined}>
      <AuthStateProvider>
        {children}
      </AuthStateProvider>
    </AppBridgeContext>
  );
}

function AuthStateProvider({ children }: { children: ReactNode }) {
  const { token, isLoading, error, refreshToken } = useShopifyToken();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  
  // Extract shop from token if available
  useEffect(() => {
    if (token) {
      try {
        // Simple way to extract shop from JWT token
        // In production, use proper JWT decoding
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        setShopDomain(payload.dest || null);
      } catch (e) {
        console.error('Error extracting shop from token:', e);
        setShopDomain(null);
      }
    } else {
      setShopDomain(null);
    }
  }, [token]);
  
  const authContext: AuthContextType = {
    isAuthenticated: !!token,
    isLoading,
    token,
    shop: shopDomain,
    error,
    refreshAuth: refreshToken,
  };
  
  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
}

// Higher-order component to protect routes that require authentication
export function withAppBridgeAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        navigate('/install');
      }
    }, [isLoading, isAuthenticated, navigate]);
    
    if (isLoading) {
      return <div>Loading authentication...</div>;
    }
    
    return isAuthenticated ? <Component {...props} /> : null;
  };
} 