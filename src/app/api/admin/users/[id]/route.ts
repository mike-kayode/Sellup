import { NextRequest, NextResponse } from "next/server";
import {
  and,
  count,
  desc,
  eq,
  sql,
  sum,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminMemberships,
  auditLogs,
  businesses,
  orders,
  payments,
  users,
} from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { issueVerificationCode } from "@/lib/verification";
import { sendVerificationCodeEmail } from "@/lib/email";

const userIdSchema = z.string().uuid();
const platformRoles = [
  "user",
  "merchant",
  "superadmin",
  "admin",
  "platform_admin",
  "support_agent",
  "finance_manager",
  "content_manager",
  "moderator",
  "developer",
  "analyst",
] as const;
const patchSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("set_role"),
      role: z.enum(platformRoles),
    })
    .strict(),
  z
    .object({ action: z.literal("set_active"), isActive: z.boolean() })
    .strict(),
  z.object({ action: z.literal("force_sign_out") }).strict(),
]);
const resendSchema = z.object({ action: z.literal("resend_verification") }).strict();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user: actor, error } = await requireAdmin(request);
    if (error) return error;
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!userIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const [targetUser] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [membership] = await db
      .select({ role: adminMemberships.role, isActive: adminMemberships.isActive })
      .from(adminMemberships)
      .where(eq(adminMemberships.userId, id))
      .limit(1);
    const userStores = await db
      .select({
        id: businesses.id,
        storeName: businesses.storeName,
        storeSlug: businesses.storeSlug,
        isPublished: businesses.isPublished,
        plan: businesses.plan,
        createdAt: businesses.createdAt,
      })
      .from(businesses)
      .where(eq(businesses.userId, id))
      .orderBy(desc(businesses.createdAt))
      .limit(50);
    const [storeTotals, orderTotals, recentOrders, recentPayments, paymentTotals] =
      await Promise.all([
        db
          .select({ total: count() })
          .from(businesses)
          .where(eq(businesses.userId, id)),
        db
          .select({ total: count() })
          .from(orders)
          .innerJoin(businesses, eq(businesses.id, orders.storeId))
          .where(eq(businesses.userId, id)),
        db
          .select({
            id: orders.id,
            storeId: orders.storeId,
            orderNumber: orders.orderNumber,
            total: orders.total,
            status: orders.status,
            paymentStatus: orders.paymentStatus,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .innerJoin(businesses, eq(businesses.id, orders.storeId))
          .where(eq(businesses.userId, id))
          .orderBy(desc(orders.createdAt))
          .limit(20),
        db
          .select({
            id: payments.id,
            amount: payments.amount,
            status: payments.status,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(eq(payments.userId, id))
          .orderBy(desc(payments.createdAt))
          .limit(20),
        db
          .select({ total: sum(payments.amount) })
          .from(payments)
          .where(eq(payments.userId, id)),
      ]);

    return NextResponse.json({
      user: {
        ...targetUser,
        role:
          membership?.isActive && membership.role
            ? membership.role
            : userStores.length > 0
              ? "merchant"
              : targetUser.role || "user",
      },
      canManageRole: actor.role === "superadmin",
      staffMembership: membership?.isActive ? membership : null,
      stores: userStores,
      orders: recentOrders,
      payments: recentPayments,
      stats: {
        stores: storeTotals[0]?.total ?? 0,
        orders: orderTotals[0]?.total ?? 0,
        paymentsTotal: paymentTotals[0]?.total ?? "0",
      },
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json(
      { error: "Failed to load user details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!userIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid account action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: users.id,
        role: users.role,
        isActive: users.isActive,
        sessionsRevokedAt: users.sessionsRevokedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [membership] = await db
      .select({ role: adminMemberships.role, isActive: adminMemberships.isActive })
      .from(adminMemberships)
      .where(eq(adminMemberships.userId, id))
      .limit(1);
    const currentRole =
      membership?.isActive && membership.role
        ? membership.role
        : existing.role || "user";
    const { ipAddress, userAgent } = getClientInfo(request);

    if (parsed.data.action === "set_role") {
      const newRole = parsed.data.role;
      if (user.role !== "superadmin") {
        return NextResponse.json(
          { error: "Only a superadmin can change platform roles" },
          { status: 403 }
        );
      }
      if (id === user.id && newRole !== "superadmin") {
        return NextResponse.json(
          { error: "You cannot demote yourself" },
          { status: 400 }
        );
      }

      const isStaffRole = newRole !== "user" && newRole !== "merchant";
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext('sellup:last-superadmin'))`
        );
        if (
          currentRole === "superadmin" &&
          (newRole !== "superadmin" || !existing.isActive)
        ) {
          const [activeSuperadmins] = await tx
            .select({ total: count() })
            .from(adminMemberships)
            .innerJoin(users, eq(users.id, adminMemberships.userId))
            .where(
              and(
                eq(adminMemberships.role, "superadmin"),
                eq(adminMemberships.isActive, true),
                eq(users.isActive, true)
              )
            );
          if ((activeSuperadmins?.total ?? 0) <= 1) {
            throw new Error("CANNOT_REMOVE_LAST_SUPERADMIN");
          }
        }

        await tx
          .update(users)
          .set({ role: newRole, updatedAt: new Date() })
          .where(eq(users.id, id));

        if (isStaffRole) {
          await tx
            .insert(adminMemberships)
            .values({
              userId: id,
              role: newRole,
              isActive: true,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: adminMemberships.userId,
              set: { role: newRole, isActive: true, updatedAt: new Date() },
            });
        } else if (membership) {
          await tx
            .update(adminMemberships)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(adminMemberships.userId, id));
        }

        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: "user.role_changed",
          resourceType: "user",
          resourceId: id,
          previousValue: { role: currentRole },
          newValue: { role: newRole },
          ipAddress,
          userAgent,
        });
      });

      return NextResponse.json({ success: true, role: newRole });
    }

    if (parsed.data.action === "set_active") {
      const isActive = parsed.data.isActive;
      if (!isActive && id === user.id) {
        return NextResponse.json(
          { error: "You cannot deactivate your own account" },
          { status: 400 }
        );
      }

      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext('sellup:last-superadmin'))`
        );
        if (
          !isActive &&
          currentRole === "superadmin" &&
          existing.isActive
        ) {
          const [activeSuperadmins] = await tx
            .select({ total: count() })
            .from(adminMemberships)
            .innerJoin(users, eq(users.id, adminMemberships.userId))
            .where(
              and(
                eq(adminMemberships.role, "superadmin"),
                eq(adminMemberships.isActive, true),
                eq(users.isActive, true)
              )
            );
          if ((activeSuperadmins?.total ?? 0) <= 1) {
            throw new Error("CANNOT_REMOVE_LAST_SUPERADMIN");
          }
        }

        await tx
          .update(users)
          .set({
            isActive,
            sessionsRevokedAt: isActive
              ? existing.sessionsRevokedAt
              : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, id));
        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: isActive ? "user.activated" : "user.deactivated",
          resourceType: "user",
          resourceId: id,
          previousValue: { isActive: existing.isActive },
          newValue: { isActive },
          ipAddress,
          userAgent,
        });
      });

      return NextResponse.json({
        success: true,
        isActive,
      });
    }

    if (id === user.id) {
      return NextResponse.json(
        { error: "Use the normal sign-out action to end your own session" },
        { status: 400 }
      );
    }

    const revokedAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ sessionsRevokedAt: revokedAt, updatedAt: revokedAt })
        .where(eq(users.id, id));
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "user.sessions_revoked",
        resourceType: "user",
        resourceId: id,
        previousValue: {
          sessionsRevokedAt: existing.sessionsRevokedAt?.toISOString() ?? null,
        },
        newValue: { sessionsRevokedAt: revokedAt.toISOString() },
        ipAddress,
        userAgent,
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "CANNOT_REMOVE_LAST_SUPERADMIN") {
      return NextResponse.json(
        { error: "The last active superadmin cannot be removed or deactivated" },
        { status: 409 }
      );
    }
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!userIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = resendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid verification request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [target] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isEmailVerified: users.isEmailVerified,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.isEmailVerified) {
      return NextResponse.json({ error: "Account is already verified" }, { status: 409 });
    }

    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } =
      await supabase.auth.admin.getUserById(id);
    if (authError || !authData.user || authData.user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Account is already verified or unavailable" },
        { status: 409 }
      );
    }

    const code = await issueVerificationCode(target.email);
    const sent = await sendVerificationCodeEmail(
      target.email,
      code,
      target.fullName
    );
    if (!sent) {
      return NextResponse.json(
        { error: "Unable to send verification email" },
        { status: 502 }
      );
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "user.verification_resent",
      resourceType: "user",
      resourceId: id,
      previousValue: { isEmailVerified: false },
      newValue: { emailSent: true },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user verification resend error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 }
    );
  }
}
