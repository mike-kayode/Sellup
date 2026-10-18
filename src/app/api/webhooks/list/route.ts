import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks, stores } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const listWebhooksSchema = z.object({
  storeId: z.string().uuid(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

export async function POST(request: NextRequest) {
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
    const validatedData = listWebhooksSchema.parse(body);

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

    const totalAgg = await db
      .select({ total: webhooks.id })
      .from(webhooks)
      .where(eq(webhooks.storeId, validatedData.storeId));

    const webhooksList = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.storeId, validatedData.storeId))
      .orderBy(desc(webhooks.createdAt))
      .limit(validatedData.limit)
      .offset(validatedData.offset);

    const webhookRows = webhooksList.map((hook) => ({
      id: hook.id,
      url: hook.url,
      events: Array.isArray(hook.events) ? hook.events : [],
      status: hook.status,
      lastDelivery: hook.lastDelivery,
      retryCount: hook.retryCount,
      createdAt: hook.createdAt,
    }));

    return NextResponse.json(
      {
        webhooks: webhookRows,
        total: totalAgg.length,
        limit: validatedData.limit,
        offset: validatedData.offset,
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

    console.error("List webhooks error:", error);
    return NextResponse.json(
      { error: "Failed to list webhooks" },
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
