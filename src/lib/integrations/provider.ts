/**
 * Sell Up integration provider interface (Phase 5).
 *
 * Every provider (Meta, TikTok, WhatsApp, Google, ...) implements this
 * interface. Connections are per-store (integration_connections) and tokens
 * are encrypted with AES-256-GCM (src/lib/encryption.ts).
 */

import { encryptSensitiveDataV2, decryptSensitiveDataV2 } from "@/lib/encryption";

export type IntegrationProvider =
  | "meta"
  | "tiktok"
  | "whatsapp"
  | "google"
  | "mailchimp"
  | "brevo"
  | "zapier"
  | "make";

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "expired";

export interface IntegrationConnection {
  id: string;
  storeId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  scopes: string[];
  externalIds: Record<string, string>;
  encryptedToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  lastError?: string;
}

export interface ConnectResult {
  status: IntegrationStatus;
  externalIds: Record<string, string>;
  scopes: string[];
  token?: string; // plaintext — shown/returned once, then encrypted & stored
  tokenExpiresAt?: Date;
}

export interface HealthResult {
  healthy: boolean;
  error?: string;
}

export interface RefreshResult {
  token: string; // plaintext new access token
  tokenExpiresAt: Date;
  scopes: string[];
}

export interface WebhookIntakeResult {
  accepted: boolean;
  reason?: string;
}

export abstract class IntegrationProviderBase {
  constructor(
    readonly provider: IntegrationProvider,
    readonly featureFlag: string
  ) {}

  /** Whether this provider is enabled for a given store (feature flag + env). */
  abstract isEnabled(storeId: string): Promise<boolean>;

  /** OAuth connect URL to send the merchant to. */
  abstract connectUrl(storeId: string, redirectUri: string): Promise<string>;

  /** Complete OAuth: exchange code for token, store encrypted. */
  abstract completeConnect(
    storeId: string,
    code: string,
    redirectUri: string
  ): Promise<ConnectResult>;

  /** Disconnect and purge the stored token. */
  abstract disconnect(storeId: string): Promise<void>;

  /** Health check: is the stored token still valid? */
  abstract health(storeId: string): Promise<HealthResult>;

  /** Refresh an expired access token. */
  abstract refresh(storeId: string): Promise<RefreshResult>;

  /** Verify and ingest an incoming webhook (signature check included). */
  abstract webhookIntake(
    storeId: string,
    headers: Record<string, string>,
    body: string
  ): Promise<WebhookIntakeResult>;

  /** Encrypt a token for storage. */
  protected encryptToken(token: string): string {
    return encryptSensitiveDataV2(token);
  }

  /** Decrypt a stored token. */
  protected decryptToken(encrypted?: string): string | null {
    if (!encrypted) return null;
    try {
      return decryptSensitiveDataV2(encrypted);
    } catch {
      return null;
    }
  }
}
