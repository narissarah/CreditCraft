import React, { useState, useCallback } from 'react';
import { 
  Frame, 
  Navigation, 
  TopBar,
  Layout,
  Page,
  SkeletonPage,
  Loading,
  Toast,
  ContextualSaveBar
} from '@shopify/polaris';
import {
  HomeMinor,
  CustomersMajor,
  InventoryMajor,
  SettingsMajor,
  OrdersMajor,
  GiftCardMajor,
  ReportsMajor,
  LogOutMinor
} from '@shopify/polaris-icons';
import { useRouter } from 'next/router';
import { useAppBridge } from '@shopify/app-bridge-react';
import { useShopifyBridge } from '../../hooks/useAppBridge';
import { AppBridgeAuthProvider } from '../../components/AppBridgeAuthProvider';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: { content: string; url: string }[];
  isLoading?: boolean;
  secondaryActions?: React.ReactNode;
  actionGroups?: { title: string; actions: { content: string; onAction: () => void; }[] }[];
  primaryAction?: { content: string; onAction: () => void; disabled?: boolean; destructive?: boolean; };
  hasUnsavedChanges?: boolean;
  onDiscard?: () => void;
  onSave?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title = 'Dashboard',
  breadcrumbs,
  isLoading = false,
  secondaryActions,
  actionGroups,
  primaryAction,
  hasUnsavedChanges = false,
  onDiscard,
  onSave,
}) => {
  const router = useRouter();
  const { redirect, stopLoading } = useShopifyBridge();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const toggleNavigation = useCallback(() => {
    setIsNavOpen((isNavOpen) => !isNavOpen);
  }, []);

  const handleNavigation = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
    setToastError(false);
  }, []);

  const showToast = useCallback((message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
  }, []);

  const navigationMarkup = (
    <Navigation location={router.pathname}>
      <Navigation.Section
        items={[
          {
            url: '/admin',
            label: 'Dashboard',
            icon: HomeMinor,
            selected: router.pathname === '/admin'
          },
          {
            url: '/admin/customers',
            label: 'Customers',
            icon: CustomersMajor,
            selected: router.pathname.startsWith('/admin/customers')
          },
          {
            url: '/admin/credits',
            label: 'Credits',
            icon: GiftCardMajor,
            selected: router.pathname.startsWith('/admin/credits')
          },
          {
            url: '/admin/transactions',
            label: 'Transactions',
            icon: OrdersMajor,
            selected: router.pathname.startsWith('/admin/transactions')
          },
          {
            url: '/admin/reports',
            label: 'Reports',
            icon: ReportsMajor,
            selected: router.pathname.startsWith('/admin/reports')
          },
          {
            url: '/admin/settings',
            label: 'Settings',
            icon: SettingsMajor,
            selected: router.pathname.startsWith('/admin/settings')
          }
        ]}
      />
      <Navigation.Section
        items={[
          {
            label: 'Logout',
            icon: LogOutMinor,
            onClick: () => {
              // Handle logout logic here
              redirect('/auth/logout');
            }
          }
        ]}
      />
    </Navigation>
  );

  const userMenuMarkup = (
    <TopBar.UserMenu
      name="Admin"
      detail="Shop Owner"
      initials="AO"
      actions={[
        {
          items: [
            { content: 'Profile Settings', onAction: () => handleNavigation('/admin/profile') },
            { content: 'Log out', onAction: () => redirect('/auth/logout') }
          ]
        }
      ]}
    />
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      userMenu={userMenuMarkup}
      onNavigationToggle={toggleNavigation}
    />
  );

  // Display loading state
  if (isLoading) {
    return (
      <Frame navigation={navigationMarkup} topBar={topBarMarkup}>
        <Loading />
        <SkeletonPage title={title} />
      </Frame>
    );
  }

  return (
    <AppBridgeAuthProvider>
      <Frame
        navigation={navigationMarkup}
        topBar={topBarMarkup}
        showMobileNavigation={isNavOpen}
        onNavigationDismiss={toggleNavigation}
      >
        {hasUnsavedChanges && onSave && onDiscard && (
          <ContextualSaveBar
            message="Unsaved changes"
            saveAction={{
              onAction: onSave,
              loading: false,
              disabled: false,
            }}
            discardAction={{
              onAction: onDiscard,
              loading: false,
              disabled: false,
            }}
          />
        )}

        <Page
          title={title}
          breadcrumbs={breadcrumbs}
          primaryAction={primaryAction ? {
            content: primaryAction.content,
            onAction: primaryAction.onAction,
            disabled: primaryAction.disabled,
            destructive: primaryAction.destructive
          } : undefined}
          secondaryActions={secondaryActions}
          actionGroups={actionGroups}
        >
          <Layout>
            {children}
          </Layout>
        </Page>

        {toastMessage && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={dismissToast}
          />
        )}
      </Frame>
    </AppBridgeAuthProvider>
  );
}; 