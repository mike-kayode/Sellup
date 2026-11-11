import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  adminImpersonationSessions,
  adminMemberships,
  businesses,
  users,
} from "@/db/schema";

export const ADMIN_IMPERSONATION_PREFIX = "imp_";

export interface ActiveImpersonation {
  id: string;
  adminUserId: string;
  merchantUserId: string;
  merchantEmail: string;
  merchantFullName: string;
  storeId: string;
  storeName: string;
  expiresAt: Date;
}

export function createImpersonationToken() {
  const token = `${ADMIN_IMPERSONATION_PREFIX}${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashImpersonationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAdminImpersonationToken(token: string) {
  return token.startsWith(ADMIN_IMPERSONATION_PREFIX);
}

export async function resolveActiveImpersonation(
  token: string
): Promise<ActiveImpersonation | null> {
  if (!isAdminImpersonationToken(token)) return null;

  const adminUser = alias(users, "impersonation_admin");
  const [session] = await db
    .select({
      id: adminImpersonationSessions.id,
      adminUserId: adminImpersonationSessions.adminUserId,
      merchantUserId: users.id,
      merchantEmail: users.email,
      merchantFullName: users.fullName,
      storeId: businesses.id,
      storeName: businesses.storeName,
      expiresAt: adminImpersonationSessions.expiresAt,
    })
    .from(adminImpersonationSessions)
    .innerJoin(users, eq(users.id, adminImpersonationSessions.merchantUserId))
    .innerJoin(
      businesses,
      and(
        eq(businesses.id, adminImpersonationSessions.storeId),
        eq(businesses.userId, users.id)
      )
    )
    .innerJoin(
      adminMemberships,
      eq(adminMemberships.userId, adminImpersonationSessions.adminUserId)
    )
    .innerJoin(
      adminUser,
      eq(adminUser.id, adminImpersonationSessions.adminUserId)
    )
    .where(
      and(
        eq(
          adminImpersonationSessions.tokenHash,
          hashImpersonationToken(token)
        ),
        isNull(adminImpersonationSessions.revokedAt),
        gt(adminImpersonationSessions.expiresAt, new Date()),
        eq(users.isActive, true),
        eq(users.role, "merchant"),
        eq(adminMemberships.isActive, true),
        eq(adminMemberships.role, "superadmin"),
        eq(adminUser.isActive, true)
      )
    )
    .limit(1);

  return session ?? null;
}
