import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { analyticsEvents, stores } from "@/db/schema";
import { eq } from "drizzle-orm";

const clickSchema = z.object({
  storeSlug: z.string().min(1).max(100),
  page: z.string().min(1).max(50),
  productId: z.string().uuid().nullable().optional(),
  device: z.enum(["mobile", "desktop", "tablet"]),
  productName: z.string().max(255).nullable().optional(),
  productPrice: z.string().max(50).nullable().optional(),
  productUrl: z.string().max(2048).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = clickSchema.parse(await request.json());
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.storeSlug, input.storeSlug))
      .limit(1);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    await db.insert(analyticsEvents).values({
      storeId: store.id,
      productId: input.productId ?? null,
      orderId: null,
      eventName: "whatsapp_click",
      metadata: {
        page: input.page,
        device: input.device,
        product: input.productName ?? null,
        price: input.productPrice ?? null,
        url: input.productUrl ?? null,
      },
    });

    return NextResponse.json({ message: "Event recorded" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("WhatsApp click tracking error:", error);
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 }
    );
  }
}
