/**
 * Webhook system for Sell Up
 * Allows sending real-time notifications for key events
 */

export enum WebhookEvent {
  ORDER_CREATED = "order.created",
  ORDER_STATUS_CHANGED = "order.status_changed",
  PRODUCT_CREATED = "product.created",
  PRODUCT_UPDATED = "product.updated",
  CUSTOMER_CREATED = "customer.created",
  STORE_PUBLISHED = "store.published",
}

export interface Webhook {
  id: string;
  storeId: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  storeId: string;
}

export async function triggerWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": payload.event,
        "X-Webhook-Timestamp": payload.timestamp,
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error(`Failed to trigger webhook: ${webhookUrl}`, error);
    return false;
  }
}

export async function triggerWebhooks(
  webhooks: Webhook[],
  event: WebhookEvent,
  data: any,
  storeId: string
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    storeId,
  };

  const activeWebhooks = webhooks.filter(
    (w) => w.isActive && w.events.includes(event)
  );

  for (const webhook of activeWebhooks) {
    // Fire and forget - don't block the response
    triggerWebhook(webhook.url, payload).catch(console.error);
  }
}

/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "https:" || urlObj.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Verify webhook signature (for security)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Implementation would use HMAC-SHA256
  // This is a placeholder
  return true;
}
