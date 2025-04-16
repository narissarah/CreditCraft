import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';
import './App.css';

// Import providers and components
import AppBridgeProvider from './components/providers/AppBridgeProvider';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';

// Import routes/pages
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import TransactionListPage from './pages/transactions/TransactionListPage';
import TransactionDetailPage from './pages/transactions/TransactionDetailPage';
import TransactionDashboardPage from './pages/transactions/TransactionDashboardPage';
import TransactionReportsPage from './pages/transactions/TransactionReportsPage';

function App() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <BrowserRouter>
      <AppProvider i18n={enTranslations}>
        <AppBridgeProvider>
          {isLoading ? (
            <LoadingScreen message="Loading application..." />
          ) : (
            <Routes>
              {/* Auth routes */}
              <Route path="/auth/*" element={<AuthPage />} />
              
              {/* Protected routes */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                } 
              />

              {/* Transaction routes */}
              <Route 
                path="/transactions" 
                element={
                  <ProtectedRoute>
                    <TransactionListPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/transactions/dashboard" 
                element={
                  <ProtectedRoute>
                    <TransactionDashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/transactions/reports" 
                element={
                  <ProtectedRoute>
                    <TransactionReportsPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/transactions/:id" 
                element={
                  <ProtectedRoute>
                    <TransactionDetailPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Default route - redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </AppBridgeProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App; 