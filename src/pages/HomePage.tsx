import React, { useEffect, useState } from 'react';
import { Page, Layout, Card, TextContainer, Button, Stack, List, Heading } from '@shopify/polaris';
import useShopifyBridge from '../hooks/useAppBridge';
import { useNavigate } from 'react-router-dom';

/**
 * Home page component for the app
 */
export function HomePage() {
  const { showToast, token, getShopInfo } = useShopifyBridge();
  const [shopInfo, setShopInfo] = useState<any>(null);
  const navigate = useNavigate();
  
  // Get shop info on load
  useEffect(() => {
    const fetchShopInfo = async () => {
      try {
        // For now, just display the token
        setShopInfo({ token: token ? `${token.substring(0, 10)}...` : 'No token available' });
        
        // In a real implementation, we would call the API to get shop info
        // const info = await getShopInfo();
        // setShopInfo(info);
      } catch (error) {
        console.error('Error fetching shop info:', error);
        showToast('Error fetching shop information', true);
      }
    };
    
    fetchShopInfo();
  }, [token, showToast]);
  
  return (
    <Page title="CreditCraft Dashboard">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <TextContainer>
              <p>Welcome to CreditCraft, your comprehensive store credit management solution!</p>
              
              {shopInfo && (
                <div style={{ marginTop: '20px' }}>
                  <p><strong>Shop Authentication:</strong></p>
                  <p>Session token: {shopInfo.token}</p>
                </div>
              )}
            </TextContainer>
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned title="Credit Management">
            <TextContainer>
              <p>Manage store credits for your customers.</p>
              <div style={{ marginTop: '20px' }}>
                <Stack distribution="equalSpacing">
                  <Button onClick={() => navigate('/credits')}>View Credits</Button>
                  <Button primary onClick={() => navigate('/credits/new')}>Issue Credit</Button>
                </Stack>
              </div>
            </TextContainer>
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned title="Transaction Management">
            <TextContainer>
              <p>View and analyze credit transactions.</p>
              <div style={{ marginTop: '20px' }}>
                <Stack distribution="equalSpacing">
                  <Button onClick={() => navigate('/transactions')}>View Transactions</Button>
                  <Button primary onClick={() => navigate('/transactions/dashboard')}>Dashboard</Button>
                </Stack>
              </div>
            </TextContainer>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned title="Quick Links">
            <Stack distribution="fillEvenly">
              <Stack vertical>
                <Heading>Credits</Heading>
                <List>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/credits')}>
                      All Credits
                    </Button>
                  </List.Item>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/credits/new')}>
                      Issue New Credit
                    </Button>
                  </List.Item>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/credits/import')}>
                      Import Credits
                    </Button>
                  </List.Item>
                </List>
              </Stack>
              
              <Stack vertical>
                <Heading>Transactions</Heading>
                <List>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/transactions')}>
                      All Transactions
                    </Button>
                  </List.Item>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/transactions/dashboard')}>
                      Transaction Dashboard
                    </Button>
                  </List.Item>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/credits/redeem')}>
                      Redeem Credit
                    </Button>
                  </List.Item>
                </List>
              </Stack>
              
              <Stack vertical>
                <Heading>Customers</Heading>
                <List>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/customers')}>
                      All Customers
                    </Button>
                  </List.Item>
                  <List.Item>
                    <Button plain monochrome removeUnderline onClick={() => navigate('/customers/credits')}>
                      Customer Credits
                    </Button>
                  </List.Item>
                </List>
              </Stack>
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default HomePage; 