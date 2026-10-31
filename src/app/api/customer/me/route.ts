import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCustomerSession, buyerCookieName } from "@/lib/customer-auth";

const meSchema = z.object({
  storeSlug: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { storeSlug } = meSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const [store] = await db
      .select({ id: businesses.id, storeSlug: businesses.storeSlug })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const result = await getCustomerSession(
      store.id,
      buyerCookieName(store.storeSlug),
      request.headers
    );
    if (!result.customer) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({ customer: result.customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer me error:", error);
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
