import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, businesses, products } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const moderationSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["flag", "unflag", "suspend", "unsuspend"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const flagged = url.searchParams.get("flagged");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (flagged === "true") filters.push(eq(products.isFlagged, true));
    if (flagged === "false") filters.push(eq(products.isFlagged, false));
    if (search) {
      const pattern = `%${search}%`;
      filters.push(or(ilike(products.name, pattern), ilike(businesses.storeName, pattern))!);
    }
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(products).innerJoin(businesses, eq(businesses.id, products.storeId)).where(where),
      db.select({
        id: products.id,
        storeId: products.storeId,
        name: products.name,
        isFlagged: products.isFlagged,
        flagReason: products.flagReason,
        isActive: products.isActive,
        createdAt: products.createdAt,
        storeName: businesses.storeName,
      }).from(products)
        .innerJoin(businesses, eq(businesses.id, products.storeId))
        .where(where)
        .orderBy(desc(products.createdAt), desc(products.id))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    return NextResponse.json({
      products: rows,
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin moderation queue error:", error);
    return NextResponse.json({ error: "Failed to load moderation queue" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminUser = auth.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = moderationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid moderation request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { productIds, action, reason } = parsed.data;
  const { ipAddress, userAgent } = getClientInfo(request);

  try {
    const updated = await db.transaction(async (tx) => {
      const before = await tx.select({
        id: products.id,
        storeId: products.storeId,
        isFlagged: products.isFlagged,
        flagReason: products.flagReason,
        isActive: products.isActive,
      }).from(products).where(inArray(products.id, productIds));

      if (before.length !== productIds.length) {
        throw new Error("One or more products were not found");
      }

      const values = {
        flag: { isFlagged: true, flagReason: reason },
        unflag: { isFlagged: false, flagReason: null },
        suspend: { isActive: false, isFlagged: true, flagReason: reason },
        unsuspend: { isActive: true, isFlagged: false, flagReason: null },
      }[action];
      const result = [];

      for (const product of before) {
        const [after] = await tx.update(products)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(products.id, product.id))
          .returning({
            id: products.id,
            isFlagged: products.isFlagged,
            flagReason: products.flagReason,
            isActive: products.isActive,
          });
        await tx.insert(auditLogs).values({
          actorId: adminUser.id,
          actorRole: adminUser.role,
          action: `admin.product.${action}`,
          resourceType: "product",
          resourceId: product.id,
          storeId: product.storeId,
          previousValue: {
            isFlagged: product.isFlagged,
            flagReason: product.flagReason,
            isActive: product.isActive,
          },
          newValue: { ...after, reason },
          ipAddress,
          userAgent,
        });
        result.push(after);
      }
      return result;
    });
    return NextResponse.json({ updated });
  } catch (error) {
    if (error instanceof Error && error.message === "One or more products were not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Admin product moderation error:", error);
    return NextResponse.json({ error: "Failed to moderate products" }, { status: 500 });
  }
}
