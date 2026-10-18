import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks, stores } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { isValidWebhookUrl } from "@/lib/webhooks";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const registerWebhookSchema = z.object({
  storeId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(
    z.enum([
      "order.created",
      "order.status_changed",
      "product.created",
      "customer.created",
      "payment.success",
      "payment.failed",
    ])
  ),
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
    const validatedData = registerWebhookSchema.parse(body);

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

    if (!isValidWebhookUrl(validatedData.url)) {
      return NextResponse.json(
        { error: "Invalid webhook URL" },
        { status: 400 }
      );
    }

    const [webhook] = await db
      .insert(webhooks)
      .values({
        storeId: validatedData.storeId,
        url: validatedData.url,
        events: validatedData.events,
        status: "active",
        retryCount: 0,
        failureCount: 0,
      })
      .returning();

    return NextResponse.json(
      {
        message: "Webhook registered successfully",
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          status: webhook.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Webhook registration error:", error);
    return NextResponse.json(
      { error: "Failed to register webhook" },
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
