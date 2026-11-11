import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { announcements, auditLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  isActive: z.boolean(),
}).strict();

export async function PATCH(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid announcement ID" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid announcement update", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const announcement = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(announcements).where(eq(announcements.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(announcements).set({ isActive: parsed.data.isActive })
        .where(eq(announcements.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: parsed.data.isActive ? "announcement.activated" : "announcement.deactivated",
        resourceType: "announcement",
        resourceId: id,
        storeId: before.targetStoreId,
        previousValue: before,
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!announcement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    return NextResponse.json({ announcement });
  } catch (error) {
    console.error("Admin announcement update error:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}
