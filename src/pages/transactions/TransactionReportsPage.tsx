import React, { useState, useCallback } from 'react';
import {
  Page,
  Frame,
  Toast,
  Banner,
  Layout,
  Card,
  Button,
  ButtonGroup,
  Text
} from '@shopify/polaris';
import { 
  ExportMinor,
  ArrowLeftMinor,
  PrintMinor
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import TransactionReportVisualizer from '../../components/transactions/TransactionReportVisualizer';

const TransactionReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const api = useAPI();
  
  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Handle export
  const handleExportData = useCallback(async () => {
    try {
      // Format dates for API
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = new Date().toISOString().split('T')[0];
      
      // Call export endpoint
      const response = await api.get(
        `/api/transactions/export?format=csv&startDate=${startDateStr}&endDate=${endDateStr}`, 
        { responseType: 'blob' }
      );
      
      // Create and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const currentDate = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `transaction-report-${currentDate}.csv`);
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
      
      // Show success toast
      setToastMessage('Export started. Your download will begin shortly.');
      setToastError(false);
      setToastActive(true);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError('Failed to export data. Please try again.');
    }
  }, [api]);
  
  // Handle print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
  // Toast handlers
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);
  
  return (
    <Frame>
      <Page
        title="Transaction Reports"
        subtitle="View and analyze transaction data"
        backAction={{
          content: 'Back to Transactions',
          icon: ArrowLeftMinor,
          onAction: () => navigate('/transactions/dashboard')
        }}
        secondaryActions={[
          {
            content: 'Print',
            icon: PrintMinor,
            onAction: handlePrint
          },
          {
            content: 'Export CSV',
            icon: ExportMinor,
            onAction: handleExportData
          }
        ]}
      >
        {error && (
          <Layout.Section>
            <Banner 
              title="Error" 
              status="critical"
              onDismiss={() => setError(null)}
            >
              {error}
            </Banner>
          </Layout.Section>
        )}
        
        <Layout>
          <Layout.Section>
            <TransactionReportVisualizer 
              onExport={handleExportData}
            />
          </Layout.Section>
          
          <Layout.Section oneThird>
            <Card title="Report Actions" sectioned>
              <ButtonGroup>
                <Button 
                  icon={ExportMinor} 
                  onClick={handleExportData}
                >
                  Export CSV
                </Button>
                <Button 
                  icon={PrintMinor}
                  onClick={handlePrint}
                >
                  Print
                </Button>
              </ButtonGroup>
              
              <div style={{ marginTop: '1rem' }}>
                <Text variant="bodyMd" as="p" color="subdued">
                  Export reports for record keeping or further analysis.
                  Exported files are in CSV format and can be opened in Excel or Google Sheets.
                </Text>
              </div>
            </Card>
            
            <Card title="Need Help?" sectioned>
              <Text variant="bodyMd" as="p">
                These reports show transaction activity across your store credits system.
                You can filter by date range and view different metrics to get insights into credit usage.
              </Text>
              <div style={{ marginTop: '1rem' }}>
                <Button 
                  plain 
                  url="/help/transaction-reports" 
                  external
                >
                  Learn more about transaction reports
                </Button>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
        
        {/* Toast */}
        {toastActive && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={dismissToast}
            duration={4000}
          />
        )}
      </Page>
    </Frame>
  );
};

export default TransactionReportsPage; 