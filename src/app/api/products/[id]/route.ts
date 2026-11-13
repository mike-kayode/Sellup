import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, products, stores } from "@/db/schema";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";
import { canUseFeature, normalizePlan } from "@/lib/entitlements";
import { slugify } from "@/lib/utils";

const variantSchema = z.object({
  name: z.string().min(1).max(80),
  options: z.array(z.string().min(1).max(100)).min(1).max(30),
});

const updateProductSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(2).max(255).optional(),
  description: z.string().nullable().optional(),
  price: z.string().or(z.number()).optional(),
  comparePrice: z.string().or(z.number()).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().nullable().optional(),
  images: z.array(z.string().url()).max(5).optional(),
  variants: z.array(variantSchema).max(20).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuthenticatedUser(request);
    if (error) return error;

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const parsed = updateProductSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { storeId, ...changes } = parsed.data;
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "No product changes provided" }, { status: 400 });
    }

    const [store] = await db
      .select({ id: stores.id, userId: stores.userId, plan: stores.plan })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.userId, user!.id)))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .limit(1);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (changes.categoryId) {
      if (!canUseFeature("CATEGORIES", normalizePlan(store.plan))) {
        return NextResponse.json(
          { error: "Categories are not available on your current plan." },
          { status: 403 }
        );
      }
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, changes.categoryId), eq(categories.storeId, storeId)))
        .limit(1);
      if (!category) {
        return NextResponse.json(
          { error: "Category does not belong to this store" },
          { status: 400 }
        );
      }
    }

    const { price, comparePrice, ...otherChanges } = changes;
    const updateData: Partial<typeof products.$inferInsert> = {
      ...otherChanges,
      ...(changes.name ? { slug: slugify(changes.name) } : {}),
      ...(price !== undefined ? { price: String(price) } : {}),
      ...(comparePrice !== undefined
        ? { comparePrice: comparePrice === null ? null : String(comparePrice) }
        : {}),
      updatedAt: new Date(),
    };

    if (changes.name) {
      const [slugConflict] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.storeId, storeId),
            eq(products.slug, slugify(changes.name)),
            ne(products.id, id)
          )
        )
        .limit(1);
      if (slugConflict) {
        return NextResponse.json(
          { error: "A product with this name already exists in your store" },
          { status: 409 }
        );
      }
    }

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning({ id: products.id, name: products.name });

    return NextResponse.json({ message: "Product updated successfully", product: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
    }
    console.error("Product update error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuthenticatedUser(request);
    if (error) return error;

    const { id } = await params;
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(storeId).success) {
      return NextResponse.json({ error: "Invalid product or store id" }, { status: 400 });
    }

    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, storeId!), eq(stores.userId, user!.id)))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const [deleted] = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.storeId, storeId!)))
      .returning({ id: products.id });
    if (!deleted) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Product deletion error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
