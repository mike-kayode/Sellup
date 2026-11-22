import { createHmac, timingSafeEqual } from "crypto";

const PURPOSE = "merchant_password_reset";
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function getSecret(): string {
  return (
    process.env.JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_URL || "sellup-dev"
  );
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/**
 * Create a short-lived token proving that the user completed 6-digit code
 * verification for a merchant password reset.
 */
export function createPasswordResetToken(userId: string, email: string): string {
  const payload = JSON.stringify({
    sub: userId,
    email: email.trim().toLowerCase(),
    purpose: PURPOSE,
    exp: Date.now() + TTL_MS,
  });
  const body = toBase64Url(payload);
  return `${body}.${sign(body)}`;
}

export interface PasswordResetTokenPayload {
  userId: string;
  email: string;
}

/**
 * Verify and decode a password reset token. Returns null if invalid/expired.
 */
export function verifyPasswordResetToken(
  token: string
): PasswordResetTokenPayload | null {
  try {
    const [body, sig, ...rest] = token.split(".");
    if (!body || !sig || rest.length > 0) return null;

    const expected = Buffer.from(sign(body));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(body)) as {
      sub?: unknown;
      email?: unknown;
      purpose?: unknown;
      exp?: unknown;
    };

    if (payload.purpose !== PURPOSE) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
