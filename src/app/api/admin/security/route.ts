import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminMemberships,
  adminSessions,
  auditLogs,
  systemSettings,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SECURITY_ACTIONS = [
  "login_failed",
  "login_rate_limited",
  "login_inactive_account",
  "customer_login_failed",
  "customer_login_rate_limited",
  "account_locked",
  "suspicious_activity",
  "password_reset",
  "session_revoked",
  "security.admin_session_revoked",
  "security.staff_mfa_requirement_changed",
] as const;

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("require_staff_mfa"),
    enabled: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal("revoke_session"),
    sessionRecordId: z.string().uuid(),
  }).strict(),
]);

function isMfaRequired(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "boolean") {
    return value.value;
  }
  return true;
}

function getTokenClaims(request: NextRequest): { sessionId: string | null; aal: string | null } {
  const token = request.headers.get("authorization")?.slice("Bearer ".length) || "";
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return { sessionId: null, aal: null };
    const payload: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return { sessionId: null, aal: null };
    return {
      sessionId: "session_id" in payload && typeof payload.session_id === "string" ? payload.session_id : null,
      aal: "aal" in payload && typeof payload.aal === "string" ? payload.aal : null,
    };
  } catch {
    return { sessionId: null, aal: null };
  }
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [setting] = await db.select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, "requireStaffMfa"))
      .limit(1);
    const requireStaffMfa = setting ? isMfaRequired(setting.value) : false;
    const { aal, sessionId } = getTokenClaims(request);
    if (requireStaffMfa && aal !== "aal2") {
      return NextResponse.json({
        requireStaffMfa,
        role: user.role,
        mfaEnrollmentOnly: true,
        events: [],
        sessions: [],
        total: 0,
      });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "all";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const now = new Date();
    const eventWhere = inArray(
      auditLogs.action,
      action === "all" ? SECURITY_ACTIONS : SECURITY_ACTIONS.filter((value) => value === action),
    );
    const [totalResult, rows, sessionRows] = await Promise.all([
      db.select({ total: count() }).from(auditLogs).where(eventWhere),
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorId: auditLogs.actorId,
        actorRole: auditLogs.actorRole,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      }).from(auditLogs).where(eventWhere)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({
        id: adminSessions.id,
        userId: adminSessions.userId,
        email: users.email,
        role: adminMemberships.role,
        ipAddress: adminSessions.ipAddress,
        userAgent: adminSessions.userAgent,
        lastSeenAt: adminSessions.lastSeenAt,
        expiresAt: adminSessions.expiresAt,
        createdAt: adminSessions.createdAt,
        sessionId: adminSessions.sessionId,
      }).from(adminSessions)
        .innerJoin(users, eq(users.id, adminSessions.userId))
        .innerJoin(adminMemberships, eq(adminMemberships.userId, users.id))
        .where(and(
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, now),
          eq(adminMemberships.isActive, true),
          eq(users.isActive, true),
        ))
        .orderBy(desc(adminSessions.lastSeenAt), desc(adminSessions.id))
        .limit(100),
    ]);
    const actorIds = [...new Set(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, actorIds))
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor.email]));
    const events = rows.map((row) => ({
      ...row,
      actorName: row.actorId ? actorMap.get(row.actorId) || "Unknown account" : "System",
    }));
    return NextResponse.json({
      requireStaffMfa,
      role: user.role,
      mfaEnrollmentOnly: false,
      events,
      sessions: sessionRows.map(({ sessionId: _sessionId, ...row }) => ({
        ...row,
        isCurrent: Boolean(sessionId && sessionId === _sessionId),
      })),
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin security events error:", error);
    return NextResponse.json({ error: "Failed to load security data" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid security action", details: parsed.error.flatten() }, { status: 400 });
  }
  const update = parsed.data;

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    if (update.action === "require_staff_mfa") {
      if (user.role !== "superadmin") {
        return NextResponse.json({ error: "Only a superadmin can change staff MFA enforcement" }, { status: 403 });
      }
      if (update.enabled) {
        const [staffCount] = await db.select({ total: count() }).from(adminMemberships)
          .innerJoin(users, eq(users.id, adminMemberships.userId))
          .where(and(eq(adminMemberships.isActive, true), eq(users.isActive, true)));
        if ((staffCount?.total ?? 0) > 100) {
          return NextResponse.json({ error: "Enablement is limited to 100 active staff accounts per validation run" }, { status: 409 });
        }
        const staff = await db.select({ userId: adminMemberships.userId }).from(adminMemberships)
          .innerJoin(users, eq(users.id, adminMemberships.userId))
          .where(and(eq(adminMemberships.isActive, true), eq(users.isActive, true)))
          .limit(100);
        const supabase = getSupabaseAdmin();
        let missingFactors = 0;
        for (let offset = 0; offset < staff.length; offset += 10) {
          const factorResults = await Promise.all(
            staff.slice(offset, offset + 10).map((member) =>
              supabase.auth.admin.mfa.listFactors({ userId: member.userId }),
            ),
          );
          for (const result of factorResults) {
            if (result.error || !result.data) {
              console.error("Staff MFA enrollment check failed for an active account");
              return NextResponse.json({ error: "Could not verify MFA enrollment for every active staff account" }, { status: 503 });
            }
            if (!result.data.factors.some((factor) => factor.status === "verified")) missingFactors++;
          }
        }
        if (missingFactors) {
          return NextResponse.json({
            error: "Every active staff account must verify an MFA factor before enforcement can be enabled",
            missingFactorCount: missingFactors,
          }, { status: 409 });
        }
      }

      const updated = await db.transaction(async (tx) => {
        const [before] = await tx.select({ value: systemSettings.value })
          .from(systemSettings).where(eq(systemSettings.key, "requireStaffMfa")).limit(1);
        await tx.insert(systemSettings).values({
          key: "requireStaffMfa",
          value: update.enabled,
          description: "Require verified Supabase MFA for staff admin access",
        }).onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: update.enabled, updatedAt: new Date() },
        });
        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: "security.staff_mfa_requirement_changed",
          resourceType: "system_settings",
          previousValue: { requireStaffMfa: before ? isMfaRequired(before.value) : false },
          newValue: { requireStaffMfa: update.enabled },
          ipAddress,
          userAgent,
        });
        return update.enabled;
      });
      return NextResponse.json({ requireStaffMfa: updated });
    }

    const { sessionRecordId } = update;
    const { sessionId: currentSessionId } = getTokenClaims(request);
    if (!currentSessionId) return NextResponse.json({ error: "Admin session could not be verified" }, { status: 401 });
    const revoked = await db.transaction(async (tx) => {
      const [session] = await tx.select({
        id: adminSessions.id,
        sessionId: adminSessions.sessionId,
        userId: adminSessions.userId,
        revokedAt: adminSessions.revokedAt,
        expiresAt: adminSessions.expiresAt,
      }).from(adminSessions)
        .where(eq(adminSessions.id, sessionRecordId))
        .for("update")
        .limit(1);
      if (!session) return "not_found";
      if (session.sessionId === currentSessionId) return "current";
      if (session.revokedAt || session.expiresAt <= new Date()) return "inactive";
      const now = new Date();
      await tx.update(adminSessions).set({ revokedAt: now })
        .where(and(eq(adminSessions.id, sessionRecordId), isNull(adminSessions.revokedAt)));
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "security.admin_session_revoked",
        resourceType: "admin_session",
        resourceId: sessionRecordId,
        newValue: { sessionUserId: session.userId, revokedAt: now },
        ipAddress,
        userAgent,
      });
      return "revoked";
    });
    if (revoked === "not_found") return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (revoked === "current") return NextResponse.json({ error: "You cannot revoke your current session here" }, { status: 409 });
    if (revoked === "inactive") return NextResponse.json({ error: "Session is already inactive" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin security update failed:", error);
    return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 });
  }
}
