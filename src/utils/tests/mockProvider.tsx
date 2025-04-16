import React from 'react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';

interface MockProviderProps {
  children: React.ReactNode;
}

export const MockProvider = ({ children }: MockProviderProps) => {
  return (
    <AppProvider i18n={enTranslations}>
      {children}
    </AppProvider>
  );
}; 