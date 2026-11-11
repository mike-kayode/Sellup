import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  auditLogs,
  businessInternalNotes,
  businesses,
  users,
} from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const paramsSchema = z.string().uuid();
const noteSchema = z
  .object({ note: z.string().trim().min(1).max(3000) })
  .strict();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;
    if (!paramsSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const notes = await db
      .select({
        id: businessInternalNotes.id,
        note: businessInternalNotes.note,
        actorId: businessInternalNotes.actorId,
        actorName: users.fullName,
        createdAt: businessInternalNotes.createdAt,
      })
      .from(businessInternalNotes)
      .leftJoin(users, eq(users.id, businessInternalNotes.actorId))
      .where(eq(businessInternalNotes.storeId, id))
      .orderBy(desc(businessInternalNotes.createdAt))
      .limit(50);

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Admin business notes error:", error);
    return NextResponse.json(
      { error: "Failed to load business notes" },
      { status: 500 }
    );
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
    if (!paramsSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid internal note", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [business] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    const note = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(businessInternalNotes)
        .values({
          storeId: id,
          actorId: user.id,
          note: parsed.data.note,
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "business.note.created",
        resourceType: "business_internal_note",
        resourceId: created.id,
        storeId: id,
        previousValue: null,
        newValue: { note: created.note },
        ipAddress,
        userAgent,
      });

      return created;
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Admin business note create error:", error);
    return NextResponse.json(
      { error: "Failed to create business note" },
      { status: 500 }
    );
  }
}
