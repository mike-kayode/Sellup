import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, stores, categories } from "@/db/schema";
import { eq, desc, inArray, ilike, and, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const storeId = url.searchParams.get("storeId") || "";
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    if (search) filters.push(ilike(products.name, `%${search}%`));
    if (storeId) filters.push(eq(products.storeId, storeId));
    if (status === "active") filters.push(eq(products.isActive, true));
    if (status === "inactive") filters.push(eq(products.isActive, false));
    if (status === "flagged") filters.push(eq(products.isFlagged, true));
    const where = filters.length ? and(...filters) : undefined;

    const query = db.select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      stock: products.stock,
      isActive: products.isActive,
      isFlagged: products.isFlagged,
      flagReason: products.flagReason,
      storeId: products.storeId,
      categoryId: products.categoryId,
      createdAt: products.createdAt,
    }).from(products);

    const totalAgg = await db.select({ total: count() }).from(products).where(where);
    const productList = await query.where(where).orderBy(desc(products.createdAt)).limit(limit).offset(offset);

    const storeIds = Array.from(new Set(productList.map((p) => p.storeId)));
    const categoryIds = Array.from(new Set(productList.map((p) => p.categoryId).filter(Boolean))) as string[];

    const [storeRows, categoryRows] = await Promise.all([
      storeIds.length
        ? db.select({ id: stores.id, storeName: stores.storeName }).from(stores).where(inArray(stores.id, storeIds))
        : Promise.resolve([]),
      categoryIds.length
        ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds as readonly string[]))
        : Promise.resolve([]),
    ]);

    const storeMap = new Map(storeRows.map((s) => [s.id, s]));
    const categoryMap = new Map(categoryRows.map((c) => [c.id, c]));

    const result = productList.map((product) => {
      const store = storeMap.get(product.storeId);
      const category = product.categoryId ? categoryMap.get(product.categoryId) : null;
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        stock: product.stock,
        isActive: product.isActive,
        isFlagged: product.isFlagged,
        flagReason: product.flagReason,
        storeName: store?.storeName || "Unknown",
        categoryName: category?.name || null,
        createdAt: product.createdAt,
      };
    });

    return NextResponse.json({
      products: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin products error:", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
