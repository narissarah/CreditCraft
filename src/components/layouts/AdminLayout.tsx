import React, { useState, useCallback, ReactNode, useEffect } from 'react';
import {
  Frame,
  Navigation,
  TopBar,
  Layout,
  ContextualSaveBar,
  Toast,
  Loading,
} from '@shopify/polaris';
import {
  HomeMinor,
  OrdersMinor,
  ProductsMinor,
  CustomersMinor,
  AnalyticsMinor,
  SettingsMinor,
  PointOfSaleMinor,
  TransactionMinor,
  InfoMinor,
} from '@shopify/polaris-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppBridge } from '@shopify/app-bridge-react';
import { Redirect } from '@shopify/app-bridge/actions';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  showContextualSaveBar?: boolean;
  contextualSaveBarProps?: {
    saveAction?: {
      onAction: () => void;
      loading?: boolean;
      disabled?: boolean;
    };
    discardAction?: {
      onAction: () => void;
      loading?: boolean;
      disabled?: boolean;
    };
  };
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  showContextualSaveBar = false,
  contextualSaveBarProps,
}) => {
  const app = useAppBridge();
  const redirect = Redirect.create(app);
  const location = useLocation();
  const navigate = useNavigate();
  
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [mobileNavigationActive, setMobileNavigationActive] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [userMenuActive, setUserMenuActive] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState({
    content: '',
    error: false,
  });

  // Toggle states
  const toggleMobileNavigationActive = useCallback(
    () => setMobileNavigationActive((active) => !active),
    [],
  );
  
  const toggleUserMenuActive = useCallback(
    () => setUserMenuActive((active) => !active),
    [],
  );
  
  const dismissToast = useCallback(() => setToastActive(false), []);
  
  // Handle search
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    setSearchLoading(true);
    
    // Simulating search delay
    setTimeout(() => {
      setSearchLoading(false);
    }, 500);
  }, []);
  
  const handleSearchResultsDismiss = useCallback(() => {
    setSearchValue('');
    setSearchLoading(false);
  }, []);

  // Show toast notification
  const showToast = useCallback((content: string, error = false) => {
    setToastContent({ content, error });
    setToastActive(true);
  }, []);

  // Handle navigation
  const handleNavigationItemClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  // Determine active item based on current path
  const getIsNavigationItemActive = useCallback(
    (path: string) => {
      // For exact matching: return location.pathname === path;
      // For partial matching:
      return location.pathname.startsWith(path);
    },
    [location],
  );

  // Define navigation items
  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            url: '/admin',
            label: 'Dashboard',
            icon: HomeMinor,
            onClick: () => handleNavigationItemClick('/admin'),
            selected: getIsNavigationItemActive('/admin') && !location.pathname.includes('/admin/'),
          },
          {
            url: '/admin/credits',
            label: 'Credits',
            icon: TransactionMinor,
            onClick: () => handleNavigationItemClick('/admin/credits'),
            selected: getIsNavigationItemActive('/admin/credits'),
          },
          {
            url: '/admin/customers',
            label: 'Customers',
            icon: CustomersMinor,
            onClick: () => handleNavigationItemClick('/admin/customers'),
            selected: getIsNavigationItemActive('/admin/customers'),
          },
          {
            url: '/admin/transactions',
            label: 'Transactions',
            icon: OrdersMinor,
            onClick: () => handleNavigationItemClick('/admin/transactions'),
            selected: getIsNavigationItemActive('/admin/transactions'),
          },
          {
            url: '/admin/pos',
            label: 'POS',
            icon: PointOfSaleMinor,
            onClick: () => handleNavigationItemClick('/admin/pos'),
            selected: getIsNavigationItemActive('/admin/pos'),
          },
          {
            url: '/admin/analytics',
            label: 'Analytics',
            icon: AnalyticsMinor,
            onClick: () => handleNavigationItemClick('/admin/analytics'),
            selected: getIsNavigationItemActive('/admin/analytics'),
          },
        ]}
      />

      <Navigation.Section
        title="Settings"
        items={[
          {
            url: '/admin/settings',
            label: 'Settings',
            icon: SettingsMinor,
            onClick: () => handleNavigationItemClick('/admin/settings'),
            selected: getIsNavigationItemActive('/admin/settings'),
          },
          {
            url: '/admin/help',
            label: 'Help',
            icon: InfoMinor,
            onClick: () => handleNavigationItemClick('/admin/help'),
            selected: getIsNavigationItemActive('/admin/help'),
          },
        ]}
      />
    </Navigation>
  );

  // Define top bar markup
  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      userMenu={
        <TopBar.UserMenu
          actions={[
            {
              items: [
                {
                  content: 'Settings',
                  onAction: () => handleNavigationItemClick('/admin/settings'),
                },
                {
                  content: 'Help Center',
                  onAction: () => handleNavigationItemClick('/admin/help'),
                },
                {
                  content: 'Return to Shopify',
                  onAction: () => {
                    redirect.dispatch(Redirect.Action.ADMIN_PATH, '/');
                  },
                },
              ],
            },
          ]}
          name="Admin"
          detail="CreditCraft"
          initials="AC"
          open={userMenuActive}
          onToggle={toggleUserMenuActive}
        />
      }
      searchField={
        <TopBar.SearchField
          onChange={handleSearchChange}
          value={searchValue}
          placeholder="Search"
          showFocusBorder
          loading={searchLoading}
          onClear={handleSearchResultsDismiss}
        />
      }
      onNavigationToggle={toggleMobileNavigationActive}
    />
  );

  // Contextual save bar
  const contextualSaveBarMarkup = showContextualSaveBar ? (
    <ContextualSaveBar
      message={`Unsaved changes for ${title || 'this page'}`}
      saveAction={{
        onAction: contextualSaveBarProps?.saveAction?.onAction || (() => {}),
        loading: contextualSaveBarProps?.saveAction?.loading || false,
        disabled: contextualSaveBarProps?.saveAction?.disabled || false,
        content: 'Save',
      }}
      discardAction={{
        onAction: contextualSaveBarProps?.discardAction?.onAction || (() => {}),
        loading: contextualSaveBarProps?.discardAction?.loading || false,
        disabled: contextualSaveBarProps?.discardAction?.disabled || false,
        content: 'Discard',
      }}
    />
  ) : null;

  // Toast markup
  const toastMarkup = toastActive ? (
    <Toast
      content={toastContent.content}
      error={toastContent.error}
      onDismiss={dismissToast}
    />
  ) : null;

  // Loading markup
  const loadingMarkup = isLoading ? <Loading /> : null;

  // Expose context to child components
  const context = {
    showToast,
    setIsLoading,
  };

  // Wrap children to provide context
  const wrappedChildren = (
    <AdminLayoutContext.Provider value={context}>
      {children}
    </AdminLayoutContext.Provider>
  );

  return (
    <Frame
      topBar={topBarMarkup}
      navigation={navigationMarkup}
      showMobileNavigation={mobileNavigationActive}
      onNavigationDismiss={toggleMobileNavigationActive}
      skipToContentTarget={document.getElementById('main-content') || undefined}
      contextualSaveBar={contextualSaveBarMarkup}
      toast={toastMarkup}
    >
      {loadingMarkup}
      <div id="main-content">
        <Layout>
          {wrappedChildren}
        </Layout>
      </div>
    </Frame>
  );
};

// Context for accessing admin layout functions from child components
interface AdminLayoutContextType {
  showToast: (content: string, error?: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const AdminLayoutContext = React.createContext<AdminLayoutContextType>({
  showToast: () => {},
  setIsLoading: () => {},
});

// Hook for using admin layout context
export const useAdminLayout = () => {
  return React.useContext(AdminLayoutContext);
}; 