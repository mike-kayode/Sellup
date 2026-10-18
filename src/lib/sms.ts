/**
 * SMS service for Sell Up
 * Foundation for Phase 2 SMS integration with Twilio/Termii
 */

export enum SMSTemplate {
  ORDER_CONFIRMATION = "order_confirmation",
  ORDER_SHIPPED = "order_shipped",
  ORDER_DELIVERED = "order_delivered",
  ORDER_STATUS = "order_status",
  VERIFICATION_CODE = "verification_code",
}

export interface SMSMessage {
  phoneNumber: string;
  message: string;
  template?: SMSTemplate;
  templateData?: Record<string, any>;
}

/**
 * Send SMS notification
 * Currently logs to console - integrate with Twilio/Termii/AWS SNS in Phase 2
 */
export async function sendSMS(message: SMSMessage): Promise<boolean> {
  try {
    // TODO: Integrate with SMS service provider (Twilio, Termii, AWS SNS)
    // For now, just log
    console.log(`SMS would be sent to ${message.phoneNumber}:`, {
      message: message.message,
      template: message.template,
      data: message.templateData,
    });

    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(
  phoneNumber: string,
  orderNumber: string,
  total: string,
  storeName: string
): Promise<boolean> {
  const message = `Thank you for your order #${orderNumber} from ${storeName}. Total: ₦${total}. You'll receive updates via WhatsApp.`;

  return sendSMS({
    phoneNumber,
    message,
    template: SMSTemplate.ORDER_CONFIRMATION,
    templateData: {
      orderNumber,
      total,
      storeName,
    },
  });
}

/**
 * Send order status SMS
 */
export async function sendOrderStatusSMS(
  phoneNumber: string,
  orderNumber: string,
  status: string,
  storeName: string
): Promise<boolean> {
  const message = `Order #${orderNumber} from ${storeName} status: ${status}`;

  return sendSMS({
    phoneNumber,
    message,
    template: SMSTemplate.ORDER_STATUS,
    templateData: {
      orderNumber,
      status,
      storeName,
    },
  });
}

/**
 * Send verification code SMS
 */
export async function sendVerificationCodeSMS(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  const message = `Your Sell Up verification code is: ${code}. Valid for 10 minutes.`;

  return sendSMS({
    phoneNumber,
    message,
    template: SMSTemplate.VERIFICATION_CODE,
    templateData: { code },
  });
}

/**
 * Format phone number for SMS
 */
export function formatPhoneForSMS(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, "");

  // If starts with 0 (Nigeria), replace with 234
  if (cleaned.startsWith("0")) {
    return "+234" + cleaned.slice(1);
  }

  // If starts with 234 (Nigeria without +), add +
  if (cleaned.startsWith("234")) {
    return "+" + cleaned;
  }

  // Otherwise assume international format
  return "+" + cleaned;
}

/**
 * Validate phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  // Must be at least 10 digits
  return cleaned.length >= 10 && cleaned.length <= 15;
}
