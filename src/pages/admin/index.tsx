import React, { useState, useCallback } from 'react';
import { 
  Layout, 
  Card, 
  EmptyState,
  Button,
  DatePicker,
  ButtonGroup,
  Tabs
} from '@shopify/polaris';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { DashboardMetrics } from '../../components/admin/DashboardMetrics';
import { RecentTransactions } from '../../components/admin/RecentTransactions';
import { useShopifyBridge } from '../../hooks/useAppBridge';

const AdminDashboard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  });
  const [monthlySelected, setMonthlySelected] = useState(true);
  const { redirect } = useShopifyBridge();

  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const handleDateChange = useCallback(
    (range: { start: Date; end: Date }) => {
      setDateRange(range);
    },
    [],
  );

  const handleTimeframeChange = useCallback((isMonthly: boolean) => {
    setMonthlySelected(isMonthly);
    
    // Set appropriate date range based on selection
    const end = new Date();
    const start = new Date();
    
    if (isMonthly) {
      start.setDate(start.getDate() - 30);
    } else {
      start.setDate(start.getDate() - 7);
    }
    
    setDateRange({ start, end });
  }, []);

  const tabs = [
    {
      id: 'dashboard',
      content: 'Dashboard',
      accessibilityLabel: 'Dashboard tab',
      panelID: 'dashboard-content',
    },
    {
      id: 'activity',
      content: 'Recent Activity',
      accessibilityLabel: 'Recent Activity tab',
      panelID: 'activity-content',
    },
  ];

  return (
    <AdminLayout title="Dashboard">
      <Layout>
        <Layout.Section>
          <Tabs 
            tabs={tabs} 
            selected={selectedTab} 
            onSelect={handleTabChange}
          />
        </Layout.Section>
        
        {selectedTab === 0 ? (
          <>
            <Layout.Section>
              <Card sectioned>
                <ButtonGroup segmented>
                  <Button
                    pressed={monthlySelected}
                    onClick={() => handleTimeframeChange(true)}
                  >
                    Last 30 Days
                  </Button>
                  <Button
                    pressed={!monthlySelected}
                    onClick={() => handleTimeframeChange(false)}
                  >
                    Last 7 Days
                  </Button>
                </ButtonGroup>
              </Card>
            </Layout.Section>

            <DashboardMetrics />
            
            <Layout.Section>
              <Card title="Quick Actions" sectioned>
                <Layout>
                  <Layout.Section oneThird>
                    <Button 
                      primary 
                      fullWidth 
                      onClick={() => redirect('/admin/credits/new')}
                    >
                      Issue New Credit
                    </Button>
                  </Layout.Section>
                  
                  <Layout.Section oneThird>
                    <Button 
                      fullWidth 
                      onClick={() => redirect('/admin/customers')}
                    >
                      Manage Customers
                    </Button>
                  </Layout.Section>
                  
                  <Layout.Section oneThird>
                    <Button 
                      fullWidth 
                      onClick={() => redirect('/admin/reports')}
                    >
                      View Reports
                    </Button>
                  </Layout.Section>
                </Layout>
              </Card>
            </Layout.Section>
          </>
        ) : (
          <Layout.Section>
            <RecentTransactions />

            <Card title="Export Transactions" sectioned>
              <Card.Section>
                <p>Select a date range to export transaction data:</p>
                <div style={{ maxWidth: '400px', marginTop: '20px' }}>
                  <DatePicker
                    month={dateRange.start.getMonth()}
                    year={dateRange.start.getFullYear()}
                    onChange={handleDateChange}
                    selected={{
                      start: dateRange.start,
                      end: dateRange.end,
                    }}
                    allowRange
                  />
                </div>
              </Card.Section>
              <Card.Section>
                <Button primary>Export to CSV</Button>
              </Card.Section>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </AdminLayout>
  );
};

export default AdminDashboard; 