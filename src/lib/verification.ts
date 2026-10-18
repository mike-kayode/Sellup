import { randomInt, createHmac, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically random 6-digit code (zero-padded).
 */
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(CODE_LENGTH, "0");
}

function pepper(): string {
  return (
    process.env.JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_URL || "sellup-dev"
  );
}

/**
 * Hash the code together with the (normalized) email so a leaked DB row
 * alone is not enough to recover a usable code.
 */
export function hashCode(email: string, code: string): string {
  return createHmac("sha256", pepper())
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

/**
 * Issue (or replace) the pending verification code for an email address.
 * Returns the plaintext code — it is only ever sent by email, never stored.
 */
export async function issueVerificationCode(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  const codeHash = hashCode(normalized, code);

  await db
    .insert(emailVerifications)
    .values({
      email: normalized,
      codeHash,
      attempts: 0,
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: emailVerifications.email,
      set: {
        codeHash,
        attempts: 0,
        expiresAt,
        updatedAt: new Date(),
      },
    });

  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_pending" | "expired" | "locked" }
  | { ok: false; reason: "invalid"; attempts: number };

/**
 * Check a submitted code against the pending row. Wrong guesses increment
 * the attempt counter (max MAX_ATTEMPTS before the row locks).
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<VerifyResult> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.email, normalized))
    .limit(1);
  const row = rows[0];

  if (!row) return { ok: false, reason: "no_pending" };
  if (row.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashCode(normalized, code), "hex");
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    const attempts = row.attempts + 1;
    await db
      .update(emailVerifications)
      .set({ attempts, updatedAt: new Date() })
      .where(eq(emailVerifications.id, row.id));
    return { ok: false, reason: "invalid", attempts };
  }

  return { ok: true };
}

/**
 * Remove the pending code after successful verification.
 */
export async function consumeVerification(email: string): Promise<void> {
  await db
    .delete(emailVerifications)
    .where(
      eq(emailVerifications.email, email.trim().toLowerCase())
    );
}

/**
 * Look up our users row by email (case-insensitive).
 */
export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  return rows[0] ?? null;
}
