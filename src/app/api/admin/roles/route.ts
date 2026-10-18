import { NextRequest, NextResponse } from "next/server";
import { ROLE_PERMISSIONS, type RoleId } from "@/lib/admin-rbac";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const roles = Object.entries(ROLE_PERMISSIONS).map(([id, permissions]) => ({
      id,
      name: id.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      description: `Access level: ${permissions.length} permissions`,
      permissions,
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      roles,
      total: roles.length,
    });
  } catch (error) {
    console.error("Admin roles error:", error);
    return NextResponse.json({ error: "Failed to load roles" }, { status: 500 });
  }
}
