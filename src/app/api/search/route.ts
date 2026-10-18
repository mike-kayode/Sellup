import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, categories, stores } from "@/db/schema";
import { ilike, eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, storeId, type = "all" } = body;

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const searchTerm = `%${query}%`;
    const results: any = {};

    // Search products
    if (type === "all" || type === "products") {
      const conditions = [
        or(
          ilike(products.name, searchTerm),
          ilike(products.description, searchTerm)
        ),
      ];

      if (storeId) {
        conditions.push(eq(products.storeId, storeId));
      }

      results.products = await db
        .select()
        .from(products)
        .where(or(...conditions))
        .limit(10);
    }

    // Search categories
    if (type === "all" || type === "categories") {
      const conditions = [ilike(categories.name, searchTerm)];

      if (storeId) {
        conditions.push(eq(categories.storeId, storeId));
      }

      results.categories = await db
        .select()
        .from(categories)
        .where(or(...conditions))
        .limit(10);
    }

    // Search stores (public)
    if (type === "all" || type === "stores") {
      results.stores = await db
        .select({
          id: stores.id,
          storeName: stores.storeName,
          storeSlug: stores.storeSlug,
          description: stores.description,
          logo: stores.logo,
        })
        .from(stores)
        .where(
          or(
            ilike(stores.storeName, searchTerm),
            ilike(stores.description, searchTerm)
          )
        )
        .limit(10);
    }

    return NextResponse.json(
      {
        query,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
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
