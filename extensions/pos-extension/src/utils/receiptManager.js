import { useAppBridge } from '../hooks/useAppBridge';
import { useState, useCallback } from 'react';

/**
 * Hook for managing receipt integration with POS
 * @returns {Object} Receipt manager utilities
 */
export function useReceiptManager() {
  const { fetchWithAuth, showToast } = useAppBridge();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Generate receipt content for credit issuance
   * @param {Object} credit - Credit data
   * @returns {Object} Receipt section data
   */
  const generateCreditIssuanceReceiptContent = useCallback((credit) => {
    if (!credit) return null;
    
    // Format the timestamp
    const issueDate = new Date(credit.createdAt);
    const formattedDate = issueDate.toLocaleDateString();
    const formattedTime = issueDate.toLocaleTimeString();
    
    // Format the expiry date if present
    let expiryInfo = '';
    if (credit.expiresAt) {
      const expiryDate = new Date(credit.expiresAt);
      expiryInfo = `\nExpires: ${expiryDate.toLocaleDateString()}`;
    }
    
    // Create the receipt section
    return {
      title: "STORE CREDIT ISSUED",
      data: [
        { label: "Credit ID", value: credit.id.substring(0, 8) + "..." },
        { label: "Amount", value: `$${parseFloat(credit.amount).toFixed(2)}` },
        { label: "Reason", value: credit.reason || "Store Credit" },
        { label: "Date", value: `${formattedDate} ${formattedTime}` },
        { label: "Status", value: credit.status.toUpperCase() }
      ],
      note: `This credit can be applied to future purchases.${expiryInfo}`,
      border: true
    };
  }, []);
  
  /**
   * Generate receipt content for credit application
   * @param {Object} credit - Credit data
   * @param {number} appliedAmount - Amount applied
   * @returns {Object} Receipt section data
   */
  const generateCreditApplicationReceiptContent = useCallback((credit, appliedAmount) => {
    if (!credit || !appliedAmount) return null;
    
    // Format the timestamp
    const applyDate = new Date();
    const formattedDate = applyDate.toLocaleDateString();
    const formattedTime = applyDate.toLocaleTimeString();
    
    // Calculate remaining amount
    const remainingAmount = parseFloat(credit.remainingAmount || credit.amount) - parseFloat(appliedAmount);
    
    // Create the receipt section
    return {
      title: "STORE CREDIT APPLIED",
      data: [
        { label: "Credit ID", value: credit.id.substring(0, 8) + "..." },
        { label: "Applied", value: `$${parseFloat(appliedAmount).toFixed(2)}` },
        { label: "Remaining", value: `$${remainingAmount.toFixed(2)}` },
        { label: "Date", value: `${formattedDate} ${formattedTime}` }
      ],
      note: `Thank you for using your store credit.`,
      border: true
    };
  }, []);
  
  /**
   * Add credit info to a POS receipt
   * @param {string} orderId - The Shopify order ID
   * @param {Object} receiptContent - Receipt section data
   * @returns {Promise<Object>} Result of the operation
   */
  const addToReceipt = useCallback(async (orderId, receiptContent) => {
    if (!orderId || !receiptContent) {
      return { success: false, error: 'Missing order ID or receipt content' };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth('/api/pos/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId,
          receiptSection: receiptContent
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add to receipt');
      }
      
      const result = await response.json();
      return { success: true, data: result };
      
    } catch (err) {
      console.error('Receipt integration error:', err);
      setError(err.message || 'An error occurred with receipt integration');
      return { success: false, error: err.message || 'Receipt integration failed' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  
  /**
   * Add credit issuance to receipt
   * @param {string} orderId - The Shopify order ID
   * @param {Object} credit - Credit data
   * @returns {Promise<Object>} Result of the operation
   */
  const addCreditIssuanceToReceipt = useCallback(async (orderId, credit) => {
    const receiptContent = generateCreditIssuanceReceiptContent(credit);
    const result = await addToReceipt(orderId, receiptContent);
    
    if (result.success) {
      showToast('Credit added to customer receipt', 'success');
    } else {
      showToast(`Failed to add credit to receipt: ${result.error}`, 'critical');
    }
    
    return result;
  }, [addToReceipt, generateCreditIssuanceReceiptContent, showToast]);
  
  /**
   * Add credit application to receipt
   * @param {string} orderId - The Shopify order ID
   * @param {Object} credit - Credit data
   * @param {number} appliedAmount - Amount applied
   * @returns {Promise<Object>} Result of the operation
   */
  const addCreditApplicationToReceipt = useCallback(async (orderId, credit, appliedAmount) => {
    const receiptContent = generateCreditApplicationReceiptContent(credit, appliedAmount);
    const result = await addToReceipt(orderId, receiptContent);
    
    if (result.success) {
      showToast('Credit application added to customer receipt', 'success');
    } else {
      showToast(`Failed to add credit application to receipt: ${result.error}`, 'critical');
    }
    
    return result;
  }, [addToReceipt, generateCreditApplicationReceiptContent, showToast]);
  
  /**
   * Create standalone credit receipt
   * @param {Object} credit - Credit data
   * @returns {Promise<Object>} Result of the operation with receipt URL
   */
  const createStandaloneCreditReceipt = useCallback(async (credit) => {
    if (!credit) {
      return { success: false, error: 'Missing credit data' };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth('/api/pos/standalone-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credit })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create standalone receipt');
      }
      
      const result = await response.json();
      showToast('Created printable credit receipt', 'success');
      return { success: true, data: result };
      
    } catch (err) {
      console.error('Standalone receipt error:', err);
      setError(err.message || 'An error occurred creating the receipt');
      showToast(`Failed to create receipt: ${err.message}`, 'critical');
      return { success: false, error: err.message || 'Receipt creation failed' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, showToast]);
  
  return {
    isLoading,
    error,
    addCreditIssuanceToReceipt,
    addCreditApplicationToReceipt,
    createStandaloneCreditReceipt,
    generateCreditIssuanceReceiptContent,
    generateCreditApplicationReceiptContent
  };
}

export default { useReceiptManager }; 