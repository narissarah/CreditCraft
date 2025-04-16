import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Page, Layout, Card, Button, Banner, FooterHelp, Link } from '@shopify/polaris';

/**
 * Auth page component handling authentication flow
 */
export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Extract shop from query params
  const queryParams = new URLSearchParams(location.search);
  const shop = queryParams.get('shop');
  
  // Handle auth flow initiation
  const handleAuth = () => {
    setIsLoading(true);
    
    if (!shop) {
      setError('Shop parameter is missing. Please ensure you are accessing from Shopify admin.');
      setIsLoading(false);
      return;
    }
    
    // Redirect to auth backend endpoint
    window.location.href = `/auth/begin?shop=${encodeURIComponent(shop)}`;
  };
  
  useEffect(() => {
    // Auto-initiate auth if shop parameter is present
    if (shop) {
      handleAuth();
    }
  }, [shop]);
  
  return (
    <Page title="CreditCraft Authentication">
      <Layout>
        <Layout.Section>
          {error && (
            <Banner
              title="Authentication Error"
              status="critical"
              onDismiss={() => setError(null)}
            >
              <p>{error}</p>
            </Banner>
          )}
          
          <Card sectioned title="Shopify Authorization Required">
            <p>
              CreditCraft needs to connect with your Shopify store to provide credit management functionality.
              Please authorize the app to continue.
            </p>
            
            <div style={{ marginTop: '20px' }}>
              <Button
                primary
                loading={isLoading}
                onClick={handleAuth}
                disabled={!shop || isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect to Shopify'}
              </Button>
            </div>
            
            {!shop && (
              <div style={{ marginTop: '20px' }}>
                <Banner status="warning">
                  <p>
                    Shop parameter is missing. Please ensure you are accessing from your Shopify admin.
                  </p>
                </Banner>
              </div>
            )}
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <FooterHelp>
            Having trouble? <Link url="https://help.shopify.com" external>Contact Support</Link>
          </FooterHelp>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default AuthPage; 