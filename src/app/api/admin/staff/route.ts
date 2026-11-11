import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminMemberships, adminRoles, adminSessions, auditLogs, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(255),
  role: z.string().min(1).max(50),
}).strict();

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  revokeSessions: z.boolean().optional(),
}).strict().refine((value) => value.role !== undefined || value.isActive !== undefined || value.revokeSessions === true, "No changes supplied");

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const role = url.searchParams.get("role") || "all";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const filters = [];
    if (role !== "all") filters.push(eq(adminMemberships.role, role));
    if (search) {
      const pattern = `%${search}%`;
      filters.push(or(ilike(users.fullName, pattern), ilike(users.email, pattern))!);
    }
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows, availableRoles] = await Promise.all([
      db.select({ total: count() }).from(adminMemberships)
        .innerJoin(users, eq(users.id, adminMemberships.userId)).where(where),
      db.select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: adminMemberships.role,
        isActive: adminMemberships.isActive,
        isVerified: users.isEmailVerified,
        createdAt: adminMemberships.createdAt,
        lastLoginAt: sql<Date | null>`(
          SELECT max(${adminSessions.createdAt})
          FROM ${adminSessions}
          WHERE ${adminSessions.userId} = ${users.id}
        )`,
      }).from(adminMemberships)
        .innerJoin(users, eq(users.id, adminMemberships.userId))
        .where(where)
        .orderBy(desc(adminMemberships.createdAt), desc(adminMemberships.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ id: adminRoles.id, name: adminRoles.name })
        .from(adminRoles).where(eq(adminRoles.isActive, true)).orderBy(adminRoles.name),
    ]);

    return NextResponse.json({
      staff: rows,
      roles: availableRoles,
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin staff error:", error);
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, fullName, role } = parsed.data;
  if (role === "superadmin" && user.role !== "superadmin") {
    return NextResponse.json({ error: "Only a superadmin can grant the superadmin role" }, { status: 403 });
  }
  try {
    const [roleRecord] = await db.select({ id: adminRoles.id })
      .from(adminRoles).where(and(eq(adminRoles.id, role), eq(adminRoles.isActive, true))).limit(1);
    if (!roleRecord) return NextResponse.json({ error: "Unknown or inactive role" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const invitation = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (invitation.error || !invitation.data.user) {
      return NextResponse.json({ error: invitation.error?.message || "Could not invite staff member" }, { status: 400 });
    }

    const invitedUser = invitation.data.user;
    const { ipAddress, userAgent } = getClientInfo(request);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: invitedUser.id,
          email,
          fullName,
          role: "admin",
          isEmailVerified: false,
          isActive: true,
        });
        await tx.insert(adminMemberships).values({ userId: invitedUser.id, role, isActive: true });
        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: "admin.staff.invited",
          resourceType: "admin_membership",
          resourceId: invitedUser.id,
          newValue: { email, fullName, role, isActive: true },
          ipAddress,
          userAgent,
        });
      });
    } catch (databaseError) {
      const deletion = await supabase.auth.admin.deleteUser(invitedUser.id);
      if (deletion.error) {
        console.error("Failed to clean up invited auth user after database failure:", deletion.error);
      }
      throw databaseError;
    }
    return NextResponse.json({ staff: { id: invitedUser.id, email, fullName, role, isActive: true } }, { status: 201 });
  } catch (error) {
    console.error("Admin staff invite error:", error);
    return NextResponse.json({ error: "Failed to invite staff member" }, { status: 500 });
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
    return NextResponse.json({ error: "Invalid staff update", details: parsed.error.flatten() }, { status: 400 });
  }
  const { userId, role, isActive, revokeSessions } = parsed.data;
  if (userId === user.id && (role !== undefined || isActive === false)) {
    return NextResponse.json({ error: "You cannot change your own role or deactivate yourself" }, { status: 400 });
  }
  if (role === "superadmin" && user.role !== "superadmin") {
    return NextResponse.json({ error: "Only a superadmin can grant the superadmin role" }, { status: 403 });
  }

  try {
    if (role) {
      const [roleRecord] = await db.select({ id: adminRoles.id })
        .from(adminRoles).where(and(eq(adminRoles.id, role), eq(adminRoles.isActive, true))).limit(1);
      if (!roleRecord) return NextResponse.json({ error: "Unknown or inactive role" }, { status: 400 });
    }
    const { ipAddress, userAgent } = getClientInfo(request);
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select({
        role: adminMemberships.role,
        isActive: adminMemberships.isActive,
        userActive: users.isActive,
        sessionsRevokedAt: users.sessionsRevokedAt,
      }).from(adminMemberships)
        .innerJoin(users, eq(users.id, adminMemberships.userId))
        .where(eq(adminMemberships.userId, userId))
        .limit(1);
      if (!existing) return null;

      const removingLastSuperadmin =
        existing.role === "superadmin" &&
        existing.isActive &&
        ((role !== undefined && role !== "superadmin") || isActive === false);
      if (removingLastSuperadmin) {
        const [countResult] = await tx.select({ total: count() }).from(adminMemberships)
          .where(and(eq(adminMemberships.role, "superadmin"), eq(adminMemberships.isActive, true)));
        if ((countResult?.total ?? 0) <= 1) {
          throw new Error("Cannot remove the last active superadmin");
        }
      }
      const previousValue = { ...existing };
      const [membership] = await tx.update(adminMemberships)
        .set({
          ...(role !== undefined ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          updatedAt: new Date(),
        })
        .where(eq(adminMemberships.userId, userId))
        .returning();
      if (isActive !== undefined) {
        await tx.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
      }
      if (revokeSessions) {
        await tx.update(users)
          .set({ sessionsRevokedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, userId));
      }
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "admin.staff.updated",
        resourceType: "admin_membership",
        resourceId: userId,
        previousValue,
        newValue: {
          role: membership.role,
          isActive: membership.isActive,
          userActive: isActive ?? existing.userActive,
          sessionsRevokedAt: revokeSessions ? new Date().toISOString() : existing.sessionsRevokedAt,
        },
        ipAddress,
        userAgent,
      });
      return membership;
    });
    if (!updated) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    return NextResponse.json({ staff: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot remove the last active superadmin") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Admin staff update error:", error);
    return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 });
  }
}
