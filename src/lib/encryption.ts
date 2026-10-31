/**
 * Sell Up encryption helpers (Phase 5/6).
 *
 * AES-256-GCM with a random 96-bit IV per operation and a versioned key.
 * Output format: <key_version>:<iv_hex>:<auth_tag_hex>:<cipher_hex>
 * Replaces the insecure constant-IV AES-256-CBC used previously.
 */

import crypto from "crypto";

const KEY_VERSION = 1;
const KEY_MATERIAL = process.env.ENCRYPTION_MASTER_KEY; // 32 bytes base64 or hex

function getKey(): Buffer {
  if (!KEY_MATERIAL) {
    throw new Error("ENCRYPTION_MASTER_KEY is not configured");
  }
  // Support base64 or hex; fall back to SHA-256 of the string for compatibility.
  let key: Buffer;
  try {
    key = Buffer.from(KEY_MATERIAL, "base64");
    if (key.length !== 32) key = Buffer.alloc(0);
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length === 0) {
    try {
      key = Buffer.from(KEY_MATERIAL, "hex");
      if (key.length !== 32) key = Buffer.alloc(0);
    } catch {
      key = Buffer.alloc(0);
    }
  }
  if (key.length === 0) {
    key = crypto.createHash("sha256").update(KEY_MATERIAL).digest();
  }
  return key;
}

/** Encrypt a string. Returns <version>:<iv>:<tag>:<cipher>. */
export function encryptSensitiveDataV2(data: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(KEY_VERSION)));
  const cipherText = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${KEY_VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${cipherText.toString("hex")}`;
}

/** Decrypt a string produced by encryptSensitiveDataV2. */
export function decryptSensitiveDataV2(encrypted: string): string {
  const [versionStr, ivHex, tagHex, cipherHex] = encrypted.split(":");
  if (!versionStr || !ivHex || !tagHex || !cipherHex) {
    throw new Error("Invalid encrypted payload format");
  }
  const version = Number(versionStr);
  if (version !== KEY_VERSION) {
    throw new Error(`Unsupported encryption key version: ${version}`);
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAAD(Buffer.from(String(KEY_VERSION)));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
