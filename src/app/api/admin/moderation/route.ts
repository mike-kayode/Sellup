
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { products, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/admin-audit";

const moderateSchema = z.object({
  productId: z.string().uuid(),
  action: z.enum(["flag", "unflag", "suspend", "unsuspend", "remove"]),
  reason: z.string().min(1).max(500).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const flaggedOnly = searchParams.get("flagged") === "true";

    const conditions = [];
    if (flaggedOnly) {
      conditions.push(eq(products.isFlagged, true));
    }

    const rows = await db
      .select({
        id: products.id,
        storeId: products.storeId,
        name: products.name,
        isFlagged: products.isFlagged,
        flagReason: products.flagReason,
        isActive: products.isActive,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(products.createdAt)
      .limit(100);

    // Enrich with store name.
    const enriched = await Promise.all(rows.map(async (p) => {
      const [store] = await db
        .select({ storeName: businesses.storeName, storeSlug: businesses.storeSlug })
        .from(businesses)
        .where(eq(businesses.id, p.storeId))
        .limit(1);
      return { ...p, storeName: store?.storeName, storeSlug: store?.storeSlug };
    }));

    return NextResponse.json({ products: enriched });
  } catch (error) {
    console.error("Content moderation get error:", error);
    return NextResponse.json({ error: "Failed to get moderation queue" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { user } = auth!;

  try {
    const body = await request.json();
    const { productId, action, reason } = moderateSchema.parse(body);

    const [product] = await db
      .select({ id: products.id, storeId: products.storeId, name: products.name, isFlagged: products.isFlagged, flagReason: products.flagReason, isActive: products.isActive })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    switch (action) {
      case "flag":
        updates.isFlagged = true;
        updates.flagReason = reason || "Flagged by admin";
        break;
      case "unflag":
        updates.isFlagged = false;
        updates.flagReason = null;
        break;
      case "suspend":
        updates.isActive = false;
        updates.isFlagged = true;
        updates.flagReason = reason || "Suspended by admin";
        break;
      case "unsuspend":
        updates.isActive = true;
        updates.isFlagged = false;
        updates.flagReason = null;
        break;
      case "remove":
        updates.isActive = false;
        updates.isFlagged = true;
        updates.flagReason = reason || "Removed by admin";
        break;
    }

    const [updated] = await db.update(products).set(updates).where(eq(products.id, productId)).returning();

    try {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: `admin.content.moderate_${action}`,
        resourceType: "product",
        resourceId: productId,
        previousValue: { isFlagged: product.isFlagged, flagReason: product.flagReason, isActive: product.isActive },
        newValue: { isFlagged: updated.isFlagged, flagReason: updated.flagReason, isActive: updated.isActive },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ product: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Content moderation error:", error);
    return NextResponse.json({ error: "Failed to moderate content" }, { status: 500 });
  }
}

