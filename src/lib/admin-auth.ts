import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { adminMemberships, adminRoles, adminSessions, systemSettings, users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission, type Permission } from "@/lib/admin-rbac";
import { getClientInfo } from "@/lib/admin-audit";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export type AuthResult =
  | { user: null; error: NextResponse }
  | { user: AdminUser; error: NextResponse | null };

interface AdminJwtClaims {
  session_id: string;
  exp: number;
  aal?: string;
}

function readAdminJwtClaims(token: string): AdminJwtClaims | null {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const claims: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      !claims
      || typeof claims !== "object"
      || !("session_id" in claims)
      || typeof claims.session_id !== "string"
      || !("exp" in claims)
      || typeof claims.exp !== "number"
      || !Number.isFinite(claims.exp)
      || claims.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return {
      session_id: claims.session_id,
      exp: claims.exp,
      aal: "aal" in claims && typeof claims.aal === "string" ? claims.aal : undefined,
    };
  } catch {
    return null;
  }
}

function isStaffMfaRequired(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "boolean") {
    return value.value;
  }
  return true;
}

function permissionForRequest(request: NextRequest): Permission {
  const path = new URL(request.url).pathname.replace(/^\/api\/admin\/?/, "");
  const resource = path.split("/")[0];
  const resourceMap: Record<string, Permission> = {
    overview: "dashboard.read",
    businesses: "businesses.read",
    stores: "businesses.read",
    impersonation: "businesses.manage",
    users: "users.read",
    buyers: "users.read",
    orders: "orders.read",
    products: "products.read",
    moderation: "products.read",
    subscriptions: "subscriptions.read",
    plans: "plans.read",
    payments: "payments.read",
    promotions: "promotions.read",
    support: "support.read",
    "knowledge-base": "content.read",
    announcements: "content.read",
    notifications: "content.read",
    content: "content.read",
    domains: "domains.read",
    integrations: "integrations.read",
    ai: "integrations.read",
    features: "features.read",
    api: "integrations.read",
    webhooks: "integrations.read",
    staff: "staff.read",
    roles: "roles.read",
    "audit-logs": "audit_logs.read",
    security: "security.read",
    jobs: "system.read",
    system: "system.read",
    backups: "system.read",
    maintenance: "system.read",
    settings: "system.read",
  };
  const readPermission = resourceMap[resource] || "dashboard.read";
  return request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS"
    ? readPermission
    : (readPermission.replace(".read", ".manage") as Permission);
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = auth.slice(7);
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const claims = readAdminJwtClaims(token);
  if (!claims) {
    return {
      user: null,
      error: NextResponse.json({ error: "Invalid admin session" }, { status: 401 }),
    };
  }
  const mfaEnrollmentRequest =
    request.method === "GET" &&
    new URL(request.url).pathname === "/api/admin/security";

  let role: string | null = null;
  let permissions: string[] | null = null;
  let accountIsActive = false;
  let requireStaffMfa = false;
  try {
    const [account, membership, roleRecord, mfaSetting] = await Promise.all([
      db.select({ isActive: users.isActive }).from(users).where(eq(users.id, user.id)).limit(1),
      db.select({ role: adminMemberships.role, isActive: adminMemberships.isActive })
        .from(adminMemberships)
        .where(eq(adminMemberships.userId, user.id))
        .limit(1),
      db.select({
        id: adminRoles.id,
        permissions: adminRoles.permissions,
        isActive: adminRoles.isActive,
      }).from(adminRoles)
        .innerJoin(adminMemberships, eq(adminMemberships.role, adminRoles.id))
        .where(eq(adminMemberships.userId, user.id))
        .limit(1),
      db.select({ value: systemSettings.value }).from(systemSettings)
        .where(eq(systemSettings.key, "requireStaffMfa")).limit(1),
    ]);
    accountIsActive = account[0]?.isActive === true;
    if (membership[0]?.isActive && roleRecord[0]?.isActive) {
      role = membership[0].role;
      const stored = roleRecord[0].permissions;
      permissions = Array.isArray(stored) && stored.every((item) => typeof item === "string")
        ? stored
        : null;
    }
    if (mfaSetting[0]) requireStaffMfa = isStaffMfaRequired(mfaSetting[0].value);
  } catch (err) {
    // FAIL CLOSED: a permission lookup that fails must never grant access.
    // Deny on any DB outage instead of falling back to an authenticated-but-
    // unchecked session.
    console.error("[requireAdmin] account lookup failed, denying:", err);
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!accountIsActive || !role || !permissions) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (requireStaffMfa && claims.aal !== "aal2" && !mfaEnrollmentRequest) {
    return {
      user: null,
      error: NextResponse.json({
        error: "Staff multi-factor authentication is required",
        code: "MFA_REQUIRED",
      }, { status: 403 }),
    };
  }
  const mfaEnrollmentOnly = mfaEnrollmentRequest && requireStaffMfa && claims.aal !== "aal2";

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const sessionData = {
      sessionId: claims.session_id,
      userId: user.id,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      lastSeenAt: new Date(),
      expiresAt: new Date(claims.exp * 1000),
    };
    const [created] = await db.insert(adminSessions).values(sessionData)
      .onConflictDoNothing()
      .returning({ id: adminSessions.id });
    if (!created) {
      const [activeSession] = await db.update(adminSessions).set({
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        lastSeenAt: sessionData.lastSeenAt,
        expiresAt: sessionData.expiresAt,
      }).where(and(
        eq(adminSessions.sessionId, claims.session_id),
        eq(adminSessions.userId, user.id),
        isNull(adminSessions.revokedAt),
      )).returning({ id: adminSessions.id });
      if (!activeSession) {
        return {
          user: null,
          error: NextResponse.json({ error: "Admin session has been revoked" }, { status: 401 }),
        };
      }
    }
  } catch (sessionError) {
    console.error("[requireAdmin] session tracking failed, denying:", sessionError);
    return {
      user: null,
      error: NextResponse.json({ error: "Admin session could not be verified" }, { status: 503 }),
    };
  }

  const result: AuthResult = {
    user: {
      id: user.id,
      email: user.email || "",
      fullName: (user.user_metadata?.full_name as string) || user.email || "",
      role,
    },
    error: null,
  };

  if (!mfaEnrollmentOnly && !hasPermission(role, permissionForRequest(request), permissions)) {
    return {
      user: result.user,
      error: NextResponse.json({ error: "You do not have permission to perform this action", code: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Require admin AND a specific permission.
 * Returns a 403 if the user's role does not have the required permission.
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<AuthResult> {
  const result = await requireAdmin(request);
  if (result.error) return result;

  let permissions: string[] | null = null;
  try {
    if (result.user) {
      const [role] = await db.select({
        permissions: adminRoles.permissions,
        isActive: adminRoles.isActive,
      }).from(adminRoles)
        .where(eq(adminRoles.id, result.user.role))
        .limit(1);
      if (role?.isActive && Array.isArray(role.permissions) && role.permissions.every((item) => typeof item === "string")) {
        permissions = role.permissions;
      }
    }
  } catch (err) {
    console.error("[requirePermission] role permission lookup failed, denying:", err);
  }

  if (!result.user || !permissions || !hasPermission(result.user.role, permission, permissions)) {
    return {
      user: result.user,
      error: NextResponse.json(
        { error: "You do not have permission to perform this action", code: "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  return result;
}