/**
 * OfflineSyncManager
 * 
 * Handles caching and synchronization of data for offline operations.
 * Provides reliable queue system for operations performed offline that
 * need to be synchronized when connection is restored.
 */

import { createLogger } from './logger';

// Define storage keys
const QUEUE_STORAGE_KEY = 'creditcraft_sync_queue';
const CUSTOMER_CREDITS_KEY = 'creditcraft_customer_credits';
const LAST_SYNC_KEY = 'creditcraft_last_sync';

// Create logger instance
const logger = createLogger('OfflineSyncManager', true);

/**
 * Creates a new OfflineSyncManager instance
 * @param {Function} getSessionToken - Function that returns a session token
 * @param {string} apiBaseUrl - Base URL for the API
 * @param {Object} options - Configuration options
 * @returns {Object} - OfflineSyncManager instance
 */
export function createOfflineSyncManager(getSessionToken, apiBaseUrl, options = {}) {
  const defaultOptions = {
    syncInterval: 30000, // 30 seconds
    maxRetries: 5,
    retryDelay: 5000, // 5 seconds
    storagePrefix: 'shop_', // Will be prefixed with shop ID
    maxQueueSize: 1000,
    debug: false
  };

  const config = { ...defaultOptions, ...options };
  
  // Track sync state
  let isSyncing = false;
  let syncIntervalId = null;
  let shopId = null;
  
  // Internal methods
  /**
   * Get prefixed storage key for the current shop
   * @param {string} key - Base key
   * @returns {string} - Prefixed key
   */
  const getStorageKey = (key) => {
    return `${config.storagePrefix}${shopId}_${key}`;
  };
  
  /**
   * Save data to local storage
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   */
  const saveToStorage = (key, data) => {
    try {
      localStorage.setItem(
        getStorageKey(key),
        JSON.stringify(data)
      );
    } catch (error) {
      logger.error('Failed to save data to storage', { key, error: error.message });
    }
  };
  
  /**
   * Retrieve data from local storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if not found
   * @returns {any} - Retrieved data or default value
   */
  const getFromStorage = (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(getStorageKey(key));
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      logger.error('Failed to retrieve data from storage', { key, error: error.message });
      return defaultValue;
    }
  };
  
  /**
   * Get the current operation queue
   * @returns {Array} - Queue of pending operations
   */
  const getQueue = () => {
    return getFromStorage(QUEUE_STORAGE_KEY, []);
  };
  
  /**
   * Save the operation queue
   * @param {Array} queue - Queue to save
   */
  const saveQueue = (queue) => {
    saveToStorage(QUEUE_STORAGE_KEY, queue);
  };
  
  /**
   * Add an operation to the sync queue
   * @param {string} operationType - Type of operation
   * @param {Object} data - Operation data
   * @param {number} timestamp - Operation timestamp
   */
  const addToQueue = (operationType, data, timestamp = Date.now()) => {
    const queue = getQueue();
    
    // Ensure queue doesn't exceed maximum size
    if (queue.length >= config.maxQueueSize) {
      logger.warn('Queue exceeds maximum size, removing oldest entry');
      queue.shift();
    }
    
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operationType,
      data,
      timestamp,
      retries: 0,
      status: 'pending'
    });
    
    saveQueue(queue);
    logger.info(`Added ${operationType} operation to sync queue`, { queueSize: queue.length });
    
    // Trigger sync if we're online
    if (navigator.onLine) {
      syncQueue();
    }
  };
  
  /**
   * Process the sync queue
   */
  const syncQueue = async () => {
    // Prevent multiple sync processes
    if (isSyncing) {
      return;
    }
    
    // Check if we're online
    if (!navigator.onLine) {
      logger.info('Cannot sync queue: device is offline');
      return;
    }
    
    isSyncing = true;
    const queue = getQueue();
    
    if (queue.length === 0) {
      isSyncing = false;
      return;
    }
    
    logger.info(`Syncing queue with ${queue.length} operations`);
    
    try {
      const token = await getSessionToken();
      let updatedQueue = [...queue];
      let syncedCount = 0;
      
      // Process each operation in order
      for (let i = 0; i < updatedQueue.length; i++) {
        const operation = updatedQueue[i];
        
        // Skip already processed operations
        if (operation.status === 'completed') {
          continue;
        }
        
        // Skip failed operations that exceeded retry limit
        if (operation.status === 'failed' && operation.retries >= config.maxRetries) {
          continue;
        }
        
        try {
          let endpoint;
          let method;
          let body;
          
          // Configure request based on operation type
          switch (operation.operationType) {
            case 'issueCredit':
              endpoint = '/api/credits';
              method = 'POST';
              body = operation.data;
              break;
              
            case 'updateCustomer':
              endpoint = `/api/customers/${operation.data.customerId}`;
              method = 'PATCH';
              body = operation.data.updates;
              break;
              
            case 'logTransaction':
              endpoint = '/api/transactions';
              method = 'POST';
              body = operation.data;
              break;
              
            default:
              logger.warn(`Unknown operation type: ${operation.operationType}`);
              updatedQueue[i].status = 'failed';
              updatedQueue[i].error = 'Unknown operation type';
              continue;
          }
          
          // Make API request
          const response = await fetch(`${apiBaseUrl}${endpoint}`, {
            method,
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Offline-Operation': 'true',
              'X-Operation-ID': operation.id
            },
            body: JSON.stringify(body)
          });
          
          if (response.ok) {
            updatedQueue[i].status = 'completed';
            updatedQueue[i].syncedAt = Date.now();
            syncedCount++;
            
            // If it's a credit operation, update local storage
            if (operation.operationType === 'issueCredit' && operation.data.customerId) {
              await refreshCustomerCredits(operation.data.customerId);
            }
          } else {
            // Handle retry logic
            updatedQueue[i].retries += 1;
            updatedQueue[i].status = updatedQueue[i].retries >= config.maxRetries ? 'failed' : 'pending';
            updatedQueue[i].error = `API error: ${response.status}`;
            
            logger.error('Failed to sync operation', {
              operationType: operation.operationType,
              id: operation.id,
              status: response.status,
              retries: updatedQueue[i].retries
            });
          }
        } catch (error) {
          // Handle request errors
          updatedQueue[i].retries += 1;
          updatedQueue[i].status = updatedQueue[i].retries >= config.maxRetries ? 'failed' : 'pending';
          updatedQueue[i].error = error.message;
          
          logger.error('Exception during sync', {
            operationType: operation.operationType,
            id: operation.id,
            error: error.message,
            retries: updatedQueue[i].retries
          });
        }
      }
      
      // Update queue in storage
      saveQueue(updatedQueue);
      
      // Update last sync time
      saveToStorage(LAST_SYNC_KEY, Date.now());
      
      logger.info(`Sync completed. Synced ${syncedCount} operations, ${updatedQueue.length - syncedCount} pending/failed`);
    } catch (error) {
      logger.error('Failed to sync queue', { error: error.message });
    } finally {
      isSyncing = false;
    }
  };
  
  /**
   * Fetch and cache customer credits
   * @param {string} customerId - Customer ID
   * @returns {Promise<Array>} - Customer credits
   */
  const refreshCustomerCredits = async (customerId) => {
    if (!customerId) {
      return [];
    }
    
    try {
      const token = await getSessionToken();
      
      const response = await fetch(`${apiBaseUrl}/api/customers/${customerId}/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch customer credits: ${response.status}`);
      }
      
      const data = await response.json();
      const credits = data.credits || [];
      
      // Cache customer credits
      const customerCredits = getFromStorage(CUSTOMER_CREDITS_KEY, {});
      customerCredits[customerId] = {
        credits,
        updatedAt: Date.now()
      };
      saveToStorage(CUSTOMER_CREDITS_KEY, customerCredits);
      
      return credits;
    } catch (error) {
      logger.error('Failed to refresh customer credits', { customerId, error: error.message });
      throw error;
    }
  };
  
  // Public API
  return {
    /**
     * Initialize the sync manager
     * @param {string} currentShopId - Shop ID
     */
    initialize: (currentShopId) => {
      shopId = currentShopId;
      
      // Set up online/offline event listeners
      window.addEventListener('online', () => {
        logger.info('Device is online, triggering sync');
        syncQueue();
      });
      
      // Start periodic sync
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
      }
      
      syncIntervalId = setInterval(() => {
        if (navigator.onLine && !isSyncing) {
          syncQueue();
        }
      }, config.syncInterval);
      
      logger.info('OfflineSyncManager initialized', { shopId: currentShopId });
      
      // Initial sync
      if (navigator.onLine) {
        syncQueue();
      }
    },
    
    /**
     * Cleanup resources
     */
    destroy: () => {
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
      
      logger.info('OfflineSyncManager destroyed');
    },
    
    /**
     * Queue a credit issuance operation
     * @param {Object} creditData - Credit data
     */
    queueCreditIssuance: (creditData) => {
      addToQueue('issueCredit', creditData);
    },
    
    /**
     * Queue a customer update operation
     * @param {string} customerId - Customer ID
     * @param {Object} updates - Customer updates
     */
    queueCustomerUpdate: (customerId, updates) => {
      addToQueue('updateCustomer', { customerId, updates });
    },
    
    /**
     * Queue a transaction logging operation
     * @param {Object} transactionData - Transaction data
     */
    queueTransactionLog: (transactionData) => {
      addToQueue('logTransaction', transactionData);
    },
    
    /**
     * Get customer credits (from cache or API)
     * @param {string} customerId - Customer ID
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<Array>} - Customer credits
     */
    getCustomerCredits: async (customerId, forceRefresh = false) => {
      if (!customerId) {
        return [];
      }
      
      const customerCredits = getFromStorage(CUSTOMER_CREDITS_KEY, {});
      const cachedData = customerCredits[customerId];
      
      // Check if we have cached data and it's not too old (1 hour)
      const MAX_CACHE_AGE = 60 * 60 * 1000; // 1 hour
      
      if (!forceRefresh && 
          cachedData && 
          cachedData.credits && 
          Date.now() - cachedData.updatedAt < MAX_CACHE_AGE) {
        logger.info('Using cached customer credits', { customerId });
        return cachedData.credits;
      }
      
      // If online, refresh from API
      if (navigator.onLine) {
        try {
          return await refreshCustomerCredits(customerId);
        } catch (error) {
          // If we have cached data, return it even if it's old
          if (cachedData && cachedData.credits) {
            logger.warn('Failed to refresh credits, using cached data', { customerId });
            return cachedData.credits;
          }
          throw error;
        }
      } else if (cachedData && cachedData.credits) {
        // If offline, use cached data regardless of age
        logger.info('Device offline, using cached customer credits', { customerId });
        return cachedData.credits;
      }
      
      // No cached data and offline
      logger.warn('No cached credits available and device is offline', { customerId });
      return [];
    },
    
    /**
     * Manually trigger a sync
     * @returns {Promise<void>}
     */
    sync: async () => {
      if (navigator.onLine) {
        await syncQueue();
      } else {
        logger.warn('Cannot sync: device is offline');
      }
    },
    
    /**
     * Get the number of pending operations
     * @returns {number} - Number of pending operations
     */
    getPendingCount: () => {
      const queue = getQueue();
      return queue.filter(op => op.status === 'pending').length;
    },
    
    /**
     * Get the last sync time
     * @returns {number|null} - Timestamp of last sync or null
     */
    getLastSyncTime: () => {
      return getFromStorage(LAST_SYNC_KEY, null);
    },
    
    /**
     * Check if device is online
     * @returns {boolean} - Online status
     */
    isOnline: () => {
      return navigator.onLine;
    },
    
    /**
     * Clear all cached data (use with caution)
     */
    clearCache: () => {
      saveToStorage(CUSTOMER_CREDITS_KEY, {});
      logger.info('Cache cleared');
    }
  };
}

export default createOfflineSyncManager; 