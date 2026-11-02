/**
 * Sell Up WhatsApp chat widget helpers (Phase 2.1).
 *
 * - E.164 number normalisation / validation.
 * - Context-aware message template substitution ({store}, {product}, {url}, {price}).
 * - Business hours / away-message gating.
 * - Optional multi-agent round-robin selection.
 * - Analytics: record whatsapp_click events into analytics_events.
 */

import { formatPhoneNumber } from "@/lib/utils";

export interface WhatsAppAgent {
  name: string;
  number: string;
}

export interface WhatsAppChatConfig {
  enabled: boolean;
  number: string;
  position: "bottom-right" | "bottom-left";
  color: string;
  size: "small" | "medium" | "large";
  greetingText: string;
  agentName: string;
  agentAvatar: string;
  businessHours: {
    enabled: boolean;
    timezone: string;
    awayMessage: string;
  };
  showOnPages: ("home" | "product" | "cart" | "checkout" | "all")[];
  messageTemplate: string;
  agents: WhatsAppAgent[];
}

export interface ChatButtonDecision {
  show: boolean;
  number: string | null;
  message: string;
  away: boolean;
}

/** E.164 regex: optional leading +, then 1-15 digits. */
const E164_RE = /^\+?[1-9]\d{1,14}$/;

/** Normalise a phone number to E.164 using the existing helper (+234 prefix for NG). */
export function normaliseE164(phone: string): string | null {
  const cleaned = formatPhoneNumber(phone);
  if (!cleaned) return null;
  const digits = cleaned.replace(/^\+/, "");
  if (!E164_RE.test("+" + digits)) return null;
  return "+" + digits;
}

/** Validate that a raw user-supplied number is a valid E.164 number. */
export function isValidE164(phone: string): boolean {
  return normaliseE164(phone) !== null;
}

/**
 * Pick the agent number to use. Falls back to the store's primary number.
 * Round-robin is best-effort: without persistence it picks a stable agent
 * derived from the config index; merchants can rotate by reordering agents.
 */
export function pickAgentNumber(config: WhatsAppChatConfig): string | null {
  const agents = config.agents.filter(
    (a) => a.name && isValidE164(a.number)
  );
  if (agents.length === 0) {
    return config.number && isValidE164(config.number) ? config.number : null;
  }
  // Stable deterministic pick (index 0). True round-robin requires server
  // state; keep this deterministic so the greeting/number never flickers.
  return agents[0].number;
}

/**
 * Substitute template variables. Missing product/price/url render as empty.
 */
export function substituteTemplate(
  template: string,
  vars: { store?: string; product?: string; url?: string; price?: string }
): string {
  return template
    .replace(/\{store\}/gi, vars.store ?? "")
    .replace(/\{product\}/gi, vars.product ?? "")
    .replace(/\{url\}/gi, vars.url ?? "")
    .replace(/\{price\}/gi, vars.price ?? "");
}

/**
 * Determine whether the chat button should show and what number/message to
 * use, honouring business hours (best-effort via Intl; unknown timezones
   * fall back to "open").
 */
export function evaluateChatButton(
  config: WhatsAppChatConfig,
  page: "home" | "product" | "cart" | "checkout",
  now: Date = new Date()
): ChatButtonDecision {
  const showOn = config.showOnPages.includes("all")
    ? true
    : config.showOnPages.includes(page);
  if (!config.enabled || !showOn) {
    return { show: false, number: null, message: "", away: false };
  }

  const number = pickAgentNumber(config);
  if (!number) {
    return { show: false, number: null, message: "", away: false };
  }

  let away = false;
  let greeting = config.greetingText;
  if (config.businessHours.enabled && config.businessHours.timezone) {
    try {
      // Resolve the timezone; unknown timezones fall back to "open".
      Intl.DateTimeFormat.prototype.resolvedOptions.call(
        new Intl.DateTimeFormat("en-US", {
          timeZone: config.businessHours.timezone,
        })
      );
      const local = new Date(
        now.toLocaleString("en-US", { timeZone: config.businessHours.timezone })
      );
      const hour = local.getHours();
      const day = local.getDay();
      // Simple default business hours: Mon-Sat 8am-8pm, closed Sun & overnight.
      const isWeekend = day === 0;
      const isOutsideHours = hour < 8 || hour >= 20;
      away = isWeekend || isOutsideHours;
    } catch {
      away = false;
    }
  }

  const message = away
    ? config.businessHours.awayMessage || config.greetingText
    : greeting;

  return { show: true, number, message, away };
}

/**
 * Record a whatsapp_click analytics event. Fail-closed (never throws).
 */
export async function recordWhatsAppClick(input: {
  storeSlug: string;
  page: string;
  productId?: string | null;
  device: "mobile" | "desktop" | "tablet";
  productName?: string | null;
  productPrice?: string | null;
  productUrl?: string | null;
}): Promise<void> {
  try {
    await fetch("/api/analytics/whatsapp-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Analytics must never break the chat flow.
  }
}
