import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, orders, products, customers } from "@/db/schema";
import { eq, count, sum } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/stores/list
 * Lists stores owned by the authenticated user.
 * The user id is resolved from the Supabase session, never from the body.
 */
export async function POST(request: NextRequest) {
  try {
    // Resolve authenticated user
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

const userStores = await db
      .select({
        id: stores.id,
        userId: stores.userId,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
        description: stores.description,
        whatsappNumber: stores.whatsappNumber,
        email: stores.email,
        phone: stores.phone,
        address: stores.address,
        city: stores.city,
        state: stores.state,
        country: stores.country,
        logo: stores.logo,
        bannerImage: stores.bannerImage,
        primaryColor: stores.primaryColor,
        accentColor: stores.accentColor,
        fontFamily: stores.fontFamily,
        aboutText: stores.aboutText,
        socialLinks: stores.socialLinks,
        plan: stores.plan,
        template: stores.template,
        isPublished: stores.isPublished,
        createdAt: stores.createdAt,
        updatedAt: stores.updatedAt,
      })
      .from(stores)
      .where(eq(stores.userId, user.id));

    // Attach aggregate counts per store (orders, products, customers, revenue)
    const storesWithCounts = await Promise.all(
      userStores.map(async (store) => {
        const [orderAgg] = await db
          .select({ total: count(), revenue: sum(orders.total) })
          .from(orders)
          .where(eq(orders.storeId, store.id));
        const [productAgg] = await db
          .select({ total: count() })
          .from(products)
          .where(eq(products.storeId, store.id));
        const [customerAgg] = await db
          .select({ total: count() })
          .from(customers)
          .where(eq(customers.storeId, store.id));

        return {
          ...store,
          _count: {
            orders: orderAgg?.total ?? 0,
            products: productAgg?.total ?? 0,
            customers: customerAgg?.total ?? 0,
          },
          _sum: {
            orders: {
              total: orderAgg?.revenue ?? "0",
            },
          },
        };
      })
    );

    return NextResponse.json(
      {
        stores: storesWithCounts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error listing stores:", error);
    return NextResponse.json(
      { error: "Failed to list stores" },
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
