import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { eq, and, or, ilike, sql, desc, asc, isNotNull } from "drizzle-orm";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";

const buyersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  q: z.string().optional(),
  minSpent: z.coerce.number().optional(),
  maxSpent: z.coerce.number().optional(),
  isEmailVerified: z.coerce.boolean().optional(),
  sort: z.enum(["total_spent", "last_order_date", "created_at", "name"]).default("total_spent"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  export: z.enum(["csv"]).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const merchant = auth.merchant!;

  try {
    const {
      page,
      pageSize,
      q,
      minSpent,
      maxSpent,
      isEmailVerified,
      sort,
      dir,
      export: exportFmt,
    } = buyersSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const conditions = [eq(customers.storeId, merchant.storeId)];
    if (q) {
      const searchCondition = or(
        ilike(customers.name, `%${q}%`),
        ilike(customers.email, `%${q}%`),
        ilike(customers.phone, `%${q}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (minSpent !== null && minSpent !== undefined)
      conditions.push(sql`${customers.totalSpent} >= ${minSpent}`);
    if (maxSpent !== null && maxSpent !== undefined)
      conditions.push(sql`${customers.totalSpent} <= ${maxSpent}`);
    if (isEmailVerified !== null && isEmailVerified !== undefined)
      conditions.push(eq(customers.isEmailVerified, isEmailVerified));

    const orderDir = dir === "asc" ? asc : desc;
    const sortCol =
      sort === "total_spent" ? customers.totalSpent
        : sort === "last_order_date" ? customers.lastOrderDate
        : sort === "name" ? customers.name
        : customers.createdAt;

    const offset = (page - 1) * pageSize;

    const [rows, countRow] = await Promise.all([
      db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          totalSpent: customers.totalSpent,
          totalOrders: customers.totalOrders,
          lastOrderDate: customers.lastOrderDate,
          isEmailVerified: customers.isEmailVerified,
          isWhatsAppVerified: customers.isWhatsAppVerified,
          notes: customers.notes,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .where(and(...conditions))
        .orderBy(orderDir(sortCol))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(customers)
        .where(and(...conditions)),
    ]);

    const total = Number(countRow?.[0]?.count ?? 0);

    // Audit: merchant viewed their buyers list.
    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.buyers.list",
        resourceType: "customer",
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: {
          storeId: merchant.storeId,
          page,
          pageSize,
          q,
          total,
        },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch {
      // ignore audit failures
    }

    if (exportFmt === "csv") {
      const csv =
        "id,name,phone,email,total_spent,total_orders,last_order_date,is_email_verified,notes\n" +
        rows
          .map((r) => {
            const esc = (v: unknown) =>
              JSON.stringify(v ?? "").replace(/^"|"$/g, "");
            return [
              esc(r.id),
              esc(r.name),
              esc(r.phone),
              esc(r.email),
              esc(r.totalSpent),
              esc(r.totalOrders),
              esc(r.lastOrderDate),
              esc(r.isEmailVerified),
              esc(r.notes),
            ].join(",");
          })
          .join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="buyers-${merchant.storeSlug}.csv"`,
        },
      });
    }

    return NextResponse.json({
      customers: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Merchant buyers list error:", error);
    return NextResponse.json({ error: "Failed to list buyers" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

