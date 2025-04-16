/**
 * Utility functions for POS extension
 */

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format a date string
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
}

/**
 * Format a date with time
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(date));
}

/**
 * Class to handle offline synchronization for POS extension
 */
export class OfflineSyncManager {
  constructor(sessionTokenProvider) {
    this.sessionTokenProvider = sessionTokenProvider;
    this.isOnline = navigator.onLine;
    this.pendingSync = false;
    
    // Set up event listeners for online/offline status
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  /**
   * Handle device coming online
   */
  handleOnline() {
    this.isOnline = true;
    this.syncOfflineData();
  }

  /**
   * Handle device going offline
   */
  handleOffline() {
    this.isOnline = false;
  }

  /**
   * Store a transaction for offline processing
   * @param {string} type - The transaction type
   * @param {Object} data - The transaction data
   */
  storeOfflineTransaction(type, data) {
    const offlineData = this.getOfflineData();
    
    offlineData.transactions.push({
      type,
      data,
      timestamp: new Date().toISOString(),
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    });
    
    localStorage.setItem('creditcraft_offline_data', JSON.stringify(offlineData));
    return offlineData.transactions.length;
  }

  /**
   * Get all stored offline data
   * @returns {Object} Offline data
   */
  getOfflineData() {
    const defaultData = { transactions: [], lastSyncTimestamp: null };
    try {
      const storedData = localStorage.getItem('creditcraft_offline_data');
      return storedData ? JSON.parse(storedData) : defaultData;
    } catch (error) {
      console.error('Error parsing offline data:', error);
      return defaultData;
    }
  }

  /**
   * Check if there are any offline transactions to sync
   * @returns {boolean} True if there are transactions to sync
   */
  hasPendingTransactions() {
    const { transactions } = this.getOfflineData();
    return transactions.length > 0;
  }

  /**
   * Get the count of pending offline transactions
   * @returns {number} Number of pending transactions
   */
  getPendingTransactionsCount() {
    const { transactions } = this.getOfflineData();
    return transactions.length;
  }

  /**
   * Synchronize all offline data with the server
   * @returns {Promise<Object>} Result of the sync operation
   */
  async syncOfflineData() {
    if (!this.isOnline || this.pendingSync) {
      return { success: false, message: 'Sync already in progress or device offline' };
    }
    
    const offlineData = this.getOfflineData();
    if (offlineData.transactions.length === 0) {
      return { success: true, message: 'No offline transactions to sync' };
    }
    
    this.pendingSync = true;
    
    try {
      // Get authentication token
      const token = await this.sessionTokenProvider();
      
      // Send all offline transactions to server
      const response = await fetch('/api/pos/sync-offline-transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: offlineData.transactions,
          deviceId: localStorage.getItem('pos_device_id') || null,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync offline transactions');
      }
      
      const result = await response.json();
      
      // Clear synced transactions
      localStorage.setItem('creditcraft_offline_data', JSON.stringify({
        transactions: [],
        lastSyncTimestamp: new Date().toISOString()
      }));
      
      return {
        success: true,
        message: `Successfully synced ${result.processed} transactions`,
        result
      };
    } catch (error) {
      console.error('Error syncing offline data:', error);
      return {
        success: false,
        message: error.message || 'Failed to sync offline transactions',
        error
      };
    } finally {
      this.pendingSync = false;
    }
  }
  
  /**
   * Clear all offline data
   */
  clearOfflineData() {
    localStorage.removeItem('creditcraft_offline_data');
  }
  
  /**
   * Destroy the sync manager and clean up event listeners
   */
  destroy() {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
  }
}

/**
 * Create an offline sync manager instance
 * @param {Function} sessionTokenProvider - Function that returns a promise resolving to a session token
 * @returns {OfflineSyncManager} Offline sync manager instance
 */
export function createOfflineSyncManager(sessionTokenProvider) {
  return new OfflineSyncManager(sessionTokenProvider);
}

/**
 * Truncate text to a specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 30) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Format a credit status with appropriate styling
 * @param {string} status - Credit status 
 * @returns {Object} Status with styling information
 */
export function formatCreditStatus(status) {
  const statusMap = {
    'ACTIVE': { label: 'Active', color: 'success' },
    'USED': { label: 'Used', color: 'info' },
    'EXPIRED': { label: 'Expired', color: 'critical' },
    'CANCELLED': { label: 'Cancelled', color: 'critical' },
    'PENDING': { label: 'Pending', color: 'warning' }
  };
  
  return statusMap[status] || { label: status, color: 'base' };
}

/**
 * Creates an offline sync manager to handle operations while offline
 * @param {Function} getSessionToken - Function to get the authentication token
 * @returns {Object} Offline sync manager with methods
 */
export function createOfflineSyncManager(getSessionToken) {
  const STORAGE_PREFIX = 'creditcraft_pos_';
  const OFFLINE_TRANSACTIONS_KEY = `${STORAGE_PREFIX}offline_transactions`;
  const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api.example.com';

  // Initialize storage
  const initializeStorage = () => {
    if (!localStorage.getItem(OFFLINE_TRANSACTIONS_KEY)) {
      localStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify([]));
    }
  };

  // Get offline transactions
  const getOfflineTransactions = () => {
    try {
      const transactions = localStorage.getItem(OFFLINE_TRANSACTIONS_KEY);
      return transactions ? JSON.parse(transactions) : [];
    } catch (err) {
      console.error('Failed to parse offline transactions', err);
      return [];
    }
  };

  // Store offline transaction
  const storeOfflineTransaction = async (type, data) => {
    try {
      // Initialize if needed
      initializeStorage();

      // Get current transactions
      const transactions = getOfflineTransactions();

      // Add new transaction
      const newTransaction = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        timestamp: new Date().toISOString(),
        attempts: 0,
      };

      // Save to storage
      localStorage.setItem(
        OFFLINE_TRANSACTIONS_KEY,
        JSON.stringify([...transactions, newTransaction])
      );

      // Dispatch event for listeners
      window.dispatchEvent(
        new CustomEvent('offline_transaction_stored', {
          detail: { transaction: newTransaction }
        })
      );

      return newTransaction;
    } catch (err) {
      console.error('Failed to store offline transaction', err);
      throw new Error('Failed to store offline transaction');
    }
  };

  // Get count of pending transactions
  const getPendingTransactionsCount = async () => {
    try {
      return getOfflineTransactions().length;
    } catch (err) {
      console.error('Failed to get pending transaction count', err);
      return 0;
    }
  };

  // Store data for offline use
  const storeOfflineData = async (key, data) => {
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${key}`,
        JSON.stringify(data)
      );
      return true;
    } catch (err) {
      console.error(`Failed to store offline data for ${key}`, err);
      return false;
    }
  };

  // Get offline data
  const getOfflineData = async (key) => {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`Failed to get offline data for ${key}`, err);
      return null;
    }
  };

  // Synchronize with server
  const synchronizeWithServer = async () => {
    if (!navigator.onLine) {
      throw new Error('Cannot synchronize while offline');
    }

    // Get pending transactions
    const transactions = getOfflineTransactions();
    if (!transactions.length) {
      return { success: true, processed: 0 };
    }

    // Dispatch event for sync start
    window.dispatchEvent(
      new CustomEvent('offline_sync_status', {
        detail: { type: 'sync_start', pending: transactions.length }
      })
    );

    let processed = 0;
    let failed = 0;
    const remainingTransactions = [...transactions];
    const successfulTransactions = [];

    try {
      // Get authentication token
      const token = await getSessionToken();
      
      // Process each transaction
      for (const transaction of transactions) {
        try {
          // Send to server
          const response = await fetch(`${API_BASE_URL}/api/sync/transaction`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(transaction),
          });

          if (!response.ok) {
            // Increment attempt count
            transaction.attempts += 1;
            
            // If too many attempts, mark for removal
            if (transaction.attempts >= 5) {
              const index = remainingTransactions.findIndex(t => t.id === transaction.id);
              if (index !== -1) {
                remainingTransactions.splice(index, 1);
              }
              failed++;
            }
            
            continue;
          }

          // Transaction succeeded, remove from remaining list
          const index = remainingTransactions.findIndex(t => t.id === transaction.id);
          if (index !== -1) {
            remainingTransactions.splice(index, 1);
            successfulTransactions.push(transaction);
          }
          
          processed++;
        } catch (err) {
          console.error(`Failed to sync transaction: ${transaction.id}`, err);
          transaction.attempts += 1;
          
          // If too many attempts, mark for removal
          if (transaction.attempts >= 5) {
            const index = remainingTransactions.findIndex(t => t.id === transaction.id);
            if (index !== -1) {
              remainingTransactions.splice(index, 1);
            }
            failed++;
          }
        }
      }

      // Update storage with remaining transactions
      localStorage.setItem(
        OFFLINE_TRANSACTIONS_KEY,
        JSON.stringify(remainingTransactions)
      );

      // Dispatch event for sync completion
      window.dispatchEvent(
        new CustomEvent('offline_sync_status', {
          detail: { 
            type: 'sync_complete', 
            processed, 
            failed,
            remaining: remainingTransactions.length
          }
        })
      );

      return { 
        success: true, 
        processed, 
        failed,
        remaining: remainingTransactions.length,
        transactions: successfulTransactions
      };
    } catch (err) {
      // Dispatch event for sync error
      window.dispatchEvent(
        new CustomEvent('offline_sync_status', {
          detail: { 
            type: 'sync_error', 
            error: err.message
          }
        })
      );

      throw err;
    }
  };

  // Clear all offline data
  const clearAllOfflineData = async () => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(STORAGE_PREFIX)) {
          keys.push(key);
        }
      }

      keys.forEach(key => localStorage.removeItem(key));
      return { success: true, cleared: keys.length };
    } catch (err) {
      console.error('Failed to clear offline data', err);
      return { success: false, error: err.message };
    }
  };

  // Initialize on creation
  initializeStorage();

  // Return public API
  return {
    storeOfflineTransaction,
    getPendingTransactionsCount,
    storeOfflineData,
    getOfflineData,
    synchronizeWithServer,
    clearAllOfflineData
  };
}

/**
 * Format a currency amount
 * @param {number} amount - The amount to format
 * @param {string} [locale='en-US'] - The locale to use for formatting
 * @param {string} [currency='USD'] - The currency code
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, locale = 'en-US', currency = 'USD') {
  if (amount === undefined || amount === null) return '';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format a date string
 * @param {string} isoString - ISO date string
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(isoString, options = {}) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return date.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format credit status
 * @param {string} status - Credit status code
 * @returns {Object} Badge props for rendering
 */
export function formatCreditStatus(status) {
  // Dynamically import Badge component
  const Badge = import('@shopify/polaris').then(module => module.Badge);
  
  const statusMap = {
    'ACTIVE': { label: 'Active', tone: 'success' },
    'USED': { label: 'Used', tone: 'info' },
    'EXPIRED': { label: 'Expired', tone: 'warning' },
    'CANCELLED': { label: 'Cancelled', tone: 'critical' },
    'PENDING': { label: 'Pending', tone: 'attention' }
  };
  
  const statusInfo = statusMap[status] || { label: status || 'Unknown', tone: 'info' };
  
  return <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>;
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create a logger with optional server logging
 * @param {string} namespace - Logger namespace
 * @param {boolean} enableServerLogging - Whether to send logs to server
 * @returns {Object} Logger methods
 */
export function createLogger(namespace, enableServerLogging = false) {
  const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api.example.com';
  const LOG_ENDPOINT = `${API_BASE_URL}/api/logs`;
  
  // Only send logs if we're in production
  const shouldSendToServer = enableServerLogging && process.env.NODE_ENV === 'production';
  
  // Send log to server if online
  const sendToServer = async (level, message, data = {}) => {
    if (!shouldSendToServer || !navigator.onLine) return;
    
    try {
      const logData = {
        level,
        namespace,
        message,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        data
      };
      
      // Use non-blocking fetch to avoid slowing down UI
      fetch(LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
        // Don't wait for response
        keepalive: true
      }).catch(err => console.error('Failed to send log to server', err));
    } catch (err) {
      // Don't let logging errors impact user experience
      console.error('Error sending log to server', err);
    }
  };
  
  return {
    debug: (message, data = {}) => {
      console.debug(`[${namespace}] ${message}`, data);
      sendToServer('debug', message, data);
    },
    info: (message, data = {}) => {
      console.info(`[${namespace}] ${message}`, data);
      sendToServer('info', message, data);
    },
    warn: (message, data = {}) => {
      console.warn(`[${namespace}] ${message}`, data);
      sendToServer('warn', message, data);
    },
    error: (message, data = {}) => {
      console.error(`[${namespace}] ${message}`, data);
      sendToServer('error', message, data);
    }
  };
} 