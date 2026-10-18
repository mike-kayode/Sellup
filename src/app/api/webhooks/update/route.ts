import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const updateWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  storeId: z.string().uuid(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateWebhookSchema.parse(body);

    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, validatedData.storeId))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (storeResult[0].userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this store" },
        { status: 403 }
      );
    }

    const webhookResult = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, validatedData.webhookId), eq(webhooks.storeId, validatedData.storeId)))
      .limit(1);

    if (webhookResult.length === 0) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validatedData.url) updateData.url = validatedData.url;
    if (validatedData.events) updateData.events = validatedData.events;
    if (validatedData.isActive !== undefined) updateData.status = validatedData.isActive ? "active" : "inactive";

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, validatedData.webhookId))
      .returning();

    return NextResponse.json(
      {
        message: "Webhook updated successfully",
        webhook: {
          id: updated.id,
          url: updated.url,
          events: updated.events,
          status: updated.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Update webhook error:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
