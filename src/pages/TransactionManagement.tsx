import React from 'react';
import { Frame } from '@shopify/polaris';
import TransactionDashboard from '../components/transactions/TransactionDashboard';

const TransactionManagement: React.FC = () => {
  return (
    <Frame>
      <TransactionDashboard />
    </Frame>
  );
};

export default TransactionManagement; 