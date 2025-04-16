import {
  reactExtension,
  useApi,
  BlockStack,
  Text,
  Divider,
  useExtensionData,
  Card
} from '@shopify/ui-extensions-react/point-of-sale';
import { useMemo, useEffect } from 'react';

/**
 * Receipt Component
 * 
 * Adds credit information to POS receipts
 * Appears on the receipt screen and printed receipts
 */
function ReceiptIntegration() {
  const { receipt, session } = useApi();
  const { data: extensionData } = useExtensionData();

  // Get credit information from the transaction
  const creditInfo = useMemo(() => {
    if (!receipt?.order || !extensionData?.creditTransactions) {
      return null;
    }

    // Find any credit transactions associated with this order
    const orderCredits = extensionData.creditTransactions.filter(
      transaction => transaction.orderId === receipt.order.id
    );

    if (orderCredits.length === 0) {
      return null;
    }

    // Calculate total credit applied
    const totalCreditApplied = orderCredits.reduce(
      (total, credit) => total + Math.abs(credit.amount),
      0
    );

    // Get customer info if available
    const customerName = receipt.order.customer 
      ? `${receipt.order.customer.firstName} ${receipt.order.customer.lastName}`.trim()
      : 'Customer';

    return {
      customerName,
      totalCreditApplied,
      transactions: orderCredits,
      remainingBalance: extensionData.remainingBalance || 0
    };
  }, [receipt, extensionData]);

  // Save credit transaction info in the Shopify order metadata
  useEffect(() => {
    const addMetadataToOrder = async () => {
      if (!creditInfo || !receipt?.order?.id) {
        return;
      }

      try {
        const token = await session.getSessionToken();
        await fetch('/api/pos/receipt-metadata', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Shopify-Shop-Domain': receipt.shop?.domain || '',
            'X-POS-Device-ID': session.device?.id || ''
          },
          body: JSON.stringify({
            orderId: receipt.order.id,
            creditInfo
          })
        });
      } catch (error) {
        console.error('Failed to save receipt metadata:', error);
      }
    };

    addMetadataToOrder();
  }, [creditInfo, receipt, session]);

  // Don't render anything if no credit was used
  if (!creditInfo) {
    return null;
  }

  return (
    <BlockStack spacing="tight">
      <Divider />
      <Text emphasis="bold">STORE CREDIT APPLIED</Text>
      <BlockStack spacing="none">
        <Text>Customer: {creditInfo.customerName}</Text>
        <Text emphasis="bold">Credit Amount: ${creditInfo.totalCreditApplied.toFixed(2)}</Text>
        <Text>Remaining Balance: ${creditInfo.remainingBalance.toFixed(2)}</Text>
      </BlockStack>
      <Text size="small">Thank you for using your store credit</Text>
      <Divider />
    </BlockStack>
  );
}

export default reactExtension(
  "pos.checkout.receipt.render",
  () => <ReceiptIntegration />
); 