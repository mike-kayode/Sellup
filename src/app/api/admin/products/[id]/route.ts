import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, stores, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const [store] = await db.select().from(stores).where(eq(stores.id, product.storeId)).limit(1);
    let category = null;
    if (product.categoryId) {
      const [cat] = await db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1);
      category = cat || null;
    }

    return NextResponse.json({
      product,
      store,
      category,
    });
  } catch (error) {
    console.error("Admin product detail error:", error);
    return NextResponse.json({ error: "Failed to load product details" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json();

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const previousValue = { isActive: existing.isActive, price: existing.price };

    const [updated] = await db.update(products).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(products.id, id)).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "product.updated",
        resourceType: "product",
        resourceId: id,
        previousValue,
        newValue: { isActive: updated?.isActive, price: updated?.price },
        ...clientInfo,
      });
    }

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("Admin product update error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
