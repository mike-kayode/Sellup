import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { analyticsEvents, orders, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const eventSchema = z.object({
  orderId: z.string().uuid().optional(),
  eventName: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = eventSchema.parse(body);

    let storeId: string | undefined;

    if (validatedData.orderId) {
      const orderResult = await db
        .select({ storeId: orders.storeId })
        .from(orders)
        .where(eq(orders.id, validatedData.orderId))
        .limit(1);

      if (orderResult.length > 0) {
        storeId = orderResult[0].storeId;
      }
    }

    await db.insert(analyticsEvents).values({
      storeId: storeId || "",
      orderId: validatedData.orderId,
      eventName: validatedData.eventName,
      sessionId: validatedData.sessionId,
      metadata: validatedData.metadata || {},
    });

    return NextResponse.json(
      { message: "Event recorded" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Event tracking error:", error);
    return NextResponse.json(
      { error: "Failed to record event" },
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
