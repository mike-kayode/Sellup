import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, orders, stores } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const querySchema = z.object({
  search: z.string().max(100).default(""),
  status: z
    .enum(["all", "pending", "confirmed", "processing", "preparing", "ready", "completed", "cancelled"])
    .default("all"),
  paymentStatus: z.enum(["all", "pending", "paid", "failed", "refunded"]).default("all"),
  storeId: z.string().uuid().optional(),
  sort: z.enum(["newest", "oldest", "amount"]).default("newest"),
  format: z.enum(["json", "csv"]).default("json"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order filters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { search, status, paymentStatus, storeId, sort, format, page, limit } =
      parsed.data;
    const searchTerm = search.trim().replace(/[%_\\]/g, "").toLowerCase();
    const filters = [];
    if (searchTerm) {
      const pattern = `${searchTerm}%`;
      filters.push(
        sql`(
          lower(${orders.orderNumber}) LIKE ${pattern}
          OR lower(${customers.name}) LIKE ${pattern}
          OR lower(${customers.phone}) LIKE ${pattern}
          OR lower(${stores.storeName}) LIKE ${pattern}
        )`
      );
    }
    if (status !== "all") filters.push(eq(orders.status, status));
    if (paymentStatus !== "all") {
      filters.push(eq(orders.paymentStatus, paymentStatus));
    }
    if (storeId) filters.push(eq(orders.storeId, storeId));
    const where = filters.length ? and(...filters) : undefined;
    const exportMode = format === "csv";
    const maxRows = exportMode ? 5000 : limit;
    const offset = exportMode ? 0 : (page - 1) * limit;
    const orderBy =
      sort === "oldest"
        ? [sql`${orders.createdAt} ASC`, sql`${orders.id} ASC`]
        : sort === "amount"
          ? [sql`${orders.total} DESC`, sql`${orders.createdAt} DESC`]
          : [desc(orders.createdAt), desc(orders.id)];

    const [totalResult, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(orders)
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .innerJoin(stores, eq(stores.id, orders.storeId))
        .where(where),
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          storeId: orders.storeId,
          storeName: stores.storeName,
          storeSlug: stores.storeSlug,
          customerName: customers.name,
          customerPhone: customers.phone,
          total: orders.total,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .innerJoin(stores, eq(stores.id, orders.storeId))
        .where(where)
        .orderBy(...orderBy)
        .limit(maxRows)
        .offset(offset),
    ]);

    const total = totalResult[0]?.total ?? 0;
    if (exportMode) {
      const header = [
        "order_number",
        "store",
        "store_slug",
        "customer",
        "customer_phone",
        "total",
        "status",
        "payment_status",
        "created_at",
      ];
      const lines = rows.map((row) =>
        [
          row.orderNumber,
          row.storeName,
          row.storeSlug,
          row.customerName,
          row.customerPhone,
          row.total,
          row.status,
          row.paymentStatus,
          row.createdAt?.toISOString(),
        ]
          .map(csvCell)
          .join(",")
      );
      return new NextResponse([header.map(csvCell).join(","), ...lines].join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="sellup-orders.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      orders: rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin orders error:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
