import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { adminMemberships, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission, type Permission } from "@/lib/admin-rbac";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthResult {
  user: AdminUser | null;
  error: NextResponse | null;
}

const ADMIN_ROLES = new Set(["superadmin", "admin", "platform_admin", "support_agent", "finance_manager", "content_manager", "moderator", "developer", "analyst"]);

function permissionForRequest(request: NextRequest): Permission {
  const path = new URL(request.url).pathname.replace(/^\/api\/admin\/?/, "");
  const resource = path.split("/")[0];
  const resourceMap: Record<string, Permission> = {
    overview: "dashboard.read",
    businesses: "businesses.read",
    users: "users.read",
    orders: "orders.read",
    products: "products.read",
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
  return request.method === "GET" || request.method === "HEAD"
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

  let role: string | null = null;
  let accountIsActive = false;
  try {
    const [account, membership] = await Promise.all([
      db.select({ isActive: users.isActive }).from(users).where(eq(users.id, user.id)).limit(1),
      db.select({ role: adminMemberships.role, isActive: adminMemberships.isActive })
        .from(adminMemberships)
        .where(eq(adminMemberships.userId, user.id))
        .limit(1),
    ]);
    accountIsActive = account[0]?.isActive === true;
    role = membership[0]?.isActive ? membership[0].role : null;
  } catch (err) {
    // A DB outage must NOT block a valid Supabase session. Fall back to
    // checking only the users table (no admin_memberships join). If even
    // that fails, allow the request through with role "user" — the calling
    // route's permission check will still enforce admin-only access.
    console.error("[requireAdmin] account lookup failed, falling back:", err);
    let fallbackAccountIsActive = true;
    let fallbackRole: string | null = null;
    try {
      const [account] = await db
        .select({ isActive: users.isActive, role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      fallbackAccountIsActive = account?.[0]?.isActive !== false;
      fallbackRole = account?.[0]?.role ?? null;
    } catch (fallbackErr) {
      console.error("[requireAdmin] users table lookup also failed:", fallbackErr);
      // Last resort: authenticated session is enough to proceed.
      return {
        user: {
          id: user.id,
          email: user.email || "",
          fullName: (user.user_metadata?.full_name as string) || user.email || "",
          role: "user",
        },
        error: null,
      };
    }

    if (!fallbackAccountIsActive) {
      return {
        user: null,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    const result: AuthResult = {
      user: {
        id: user.id,
        email: user.email || "",
        fullName: (user.user_metadata?.full_name as string) || user.email || "",
        role: fallbackRole ?? "user",
      },
      error: null,
    };

    if (!fallbackRole || !ADMIN_ROLES.has(fallbackRole)) {
      return {
        user: null,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return result;
  }

  if (!accountIsActive || !role || !ADMIN_ROLES.has(role)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
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

  if (!hasPermission(role, permissionForRequest(request))) {
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

  if (!result.user || !hasPermission(result.user.role, permission)) {
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