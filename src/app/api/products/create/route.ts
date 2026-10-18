import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, stores } from "@/db/schema";
import { eq, count as countProducts } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";
import { canUseFeature, getProductLimit, normalizePlan } from "@/lib/entitlements";

const createProductSchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).max(255),
  description: z.string().optional(),
  price: z.string().or(z.number()),
  comparePrice: z.string().or(z.number()).optional(),
  costPrice: z.string().or(z.number()).optional(),
  stock: z.number().optional(),
  sku: z.string().optional(),
  images: z.array(z.string()).optional(),
  variants: z.array(z.object({})).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuthenticatedUser(request);
    if (error) return error;

    const body = await request.json();
    const validatedData = createProductSchema.parse(body);

    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId, plan: stores.plan })
      .from(stores)
      .where(eq(stores.id, validatedData.storeId))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (storeResult[0].userId !== user!.id) {
      return NextResponse.json(
        { error: "You do not have access to this store" },
        { status: 403 }
      );
    }

    const store = storeResult[0];
    const plan = normalizePlan(store.plan);
    const productLimit = getProductLimit(plan);

    if (productLimit !== -1) {
      const [{ count }] = await db
        .select({ count: countProducts() })
        .from(products)
        .where(eq(products.storeId, validatedData.storeId));

      if ((count || 0) >= productLimit) {
        return NextResponse.json(
          {
            error: `Product limit reached for ${plan} plan. Upgrade to add more products.`,
            limit: productLimit,
          },
          { status: 403 }
        );
      }
    }

    if (!canUseFeature("CATEGORIES", plan) && validatedData.categoryId) {
      return NextResponse.json(
        { error: "Categories are not available on your current plan." },
        { status: 403 }
      );
    }

    const newProduct = await db
      .insert(products)
      .values({
        storeId: validatedData.storeId,
        categoryId: validatedData.categoryId,
        name: validatedData.name,
        slug: slugify(validatedData.name),
        description: validatedData.description,
        price: validatedData.price.toString(),
        comparePrice: validatedData.comparePrice?.toString(),
        costPrice: validatedData.costPrice?.toString(),
        stock: validatedData.stock || 0,
        sku: validatedData.sku,
        images: validatedData.images || [],
        variants: validatedData.variants || [],
      })
      .returning({
        id: products.id,
        name: products.name,
        price: products.price,
      });

    return NextResponse.json(
      {
        message: "Product created successfully",
        product: newProduct[0],
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

    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
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