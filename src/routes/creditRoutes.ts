import NotificationTriggerService from '../services/emailService/notificationTriggers';

// ... existing code ...

// Find the route for issuing a credit and add notification trigger:
// In the POST /credits route handler, after credit is created:

// Send notification if enabled
try {
  await NotificationTriggerService.onCreditIssued(newCredit.id);
} catch (error) {
  // Log but don't fail the request if notification fails
  logger.error(`Failed to send credit issuance notification: ${error instanceof Error ? error.message : String(error)}`);
}

// ... existing code ...

// Find the route for extending credit expiration and add notification trigger:
// In the POST /credits/:id/extend-expiration route handler:

// Send notification if requested
if (req.body.notifyCustomer) {
  try {
    await NotificationTriggerService.onCreditExpiring(credit.id, 
      Math.ceil((new Date(req.body.newExpirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
  } catch (error) {
    // Log but don't fail the request if notification fails
    logger.error(`Failed to send credit extension notification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ... existing code ...

// Find the route for redeeming a credit and add notification trigger:
// In the POST /credits/:id/redeem route handler, after transaction is created:

// Send notification if this is a redemption
if (transaction.type === 'REDEMPTION') {
  try {
    await NotificationTriggerService.onCreditRedeemed(credit.id, transaction.id);
  } catch (error) {
    // Log but don't fail the request if notification fails
    logger.error(`Failed to send credit redemption notification: ${error instanceof Error ? error.message : String(error)}`);
  }
} 