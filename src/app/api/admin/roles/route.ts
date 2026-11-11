import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminRoles, auditLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { ALL_PERMISSIONS } from "@/lib/admin-rbac";

const roleUpdateSchema = z.object({
  id: z.string().min(1).max(50),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const roles = await db.select({
      id: adminRoles.id,
      name: adminRoles.name,
      description: adminRoles.description,
      permissions: adminRoles.permissions,
      isSystem: adminRoles.isSystem,
      isActive: adminRoles.isActive,
      createdAt: adminRoles.createdAt,
      updatedAt: adminRoles.updatedAt,
    }).from(adminRoles).orderBy(adminRoles.name);
    return NextResponse.json({ roles, total: roles.length, availablePermissions: ALL_PERMISSIONS });
  } catch (error) {
    console.error("Admin roles load error:", error);
    return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = roleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role permissions", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.id === "superadmin") {
    return NextResponse.json({ error: "The superadmin permission set is protected" }, { status: 403 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const role = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(adminRoles).where(eq(adminRoles.id, parsed.data.id)).limit(1);
      if (!existing) return null;
      const [updated] = await tx.update(adminRoles)
        .set({ permissions: parsed.data.permissions, updatedAt: new Date() })
        .where(eq(adminRoles.id, parsed.data.id))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "admin.role.permissions_updated",
        resourceType: "admin_role",
        previousValue: { id: existing.id, permissions: existing.permissions },
        newValue: { id: updated.id, permissions: updated.permissions },
        ipAddress,
        userAgent,
      });
      return updated;
    });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json({ role });
  } catch (error) {
    console.error("Admin role update error:", error);
    return NextResponse.json({ error: "Failed to update role permissions" }, { status: 500 });
  }
}
