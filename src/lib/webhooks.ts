import crypto from "crypto";

export enum WebhookEvent {
  ORDER_CREATED = "order.created",
  ORDER_STATUS_CHANGED = "order.status_changed",
  PRODUCT_CREATED = "product.created",
  PRODUCT_UPDATED = "product.updated",
  CUSTOMER_CREATED = "customer.created",
  STORE_PUBLISHED = "store.published",
  DOMAIN_ACTIVATED = "domain.activated",
}

export interface Webhook {
  id: string;
  storeId: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  secret?: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  storeId: string;
}

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export async function triggerWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
  secret?: string
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": payload.event,
      "X-Webhook-Timestamp": payload.timestamp,
    };
    if (secret) {
      const timestamp = payload.timestamp;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      headers["X-Webhook-Signature"] = `t=${timestamp},v1=${signature}`;
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to trigger webhook: " + webhookUrl, error);
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
    triggerWebhook(webhook.url, payload, webhook.secret).catch(console.error);
  }
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "https:" || urlObj.protocol === "http:";
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const parts = signature.split(",").map((p) => p.trim());
  let timestampMs: number | null = null;
  let v1: string | null = null;
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx);
    const v = part.slice(eqIdx + 1);
    if (k === "t") timestampMs = Number(v);
    if (k === "v1") v1 = v;
  }
  if (timestampMs === null || !v1) return false;
  const now = Date.now();
  if (Math.abs(now - timestampMs) > REPLAY_WINDOW_MS) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestampMs}.${payload}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
