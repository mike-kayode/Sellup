import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { payments, stores, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const querySchema = z.object({
  search: z.string().max(100).default(""),
  status: z
    .enum(["all", "pending", "success", "paid", "failed", "refunded", "refund_pending"])
    .default("all"),
  gateway: z.enum(["all", "paystack", "flutterwave"]).default("all"),
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
        { error: "Invalid payment filters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { search, status, gateway, sort, format, page, limit } = parsed.data;
    const searchTerm = search.trim().replace(/[%_\\]/g, "").toLowerCase();
    const filters = [];
    if (searchTerm) {
      const pattern = `${searchTerm}%`;
      filters.push(
        sql`(
          lower(${payments.reference}) LIKE ${pattern}
          OR lower(${stores.storeName}) LIKE ${pattern}
          OR lower(${users.email}) LIKE ${pattern}
          OR lower(${users.fullName}) LIKE ${pattern}
        )`
      );
    }
    if (status !== "all") filters.push(eq(payments.status, status));
    if (gateway !== "all") filters.push(eq(payments.gateway, gateway));
    const where = filters.length ? and(...filters) : undefined;
    const exporting = format === "csv";
    const [totalResult, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(payments)
        .innerJoin(stores, eq(stores.id, payments.storeId))
        .innerJoin(users, eq(users.id, payments.userId))
        .where(where),
      db
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          gateway: payments.gateway,
          reference: payments.reference,
          status: payments.status,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          storeId: payments.storeId,
          userId: payments.userId,
          storeName: stores.storeName,
          userName: users.fullName,
          userEmail: users.email,
        })
        .from(payments)
        .innerJoin(stores, eq(stores.id, payments.storeId))
        .innerJoin(users, eq(users.id, payments.userId))
        .where(where)
        .orderBy(
          ...(
          sort === "oldest"
            ? [sql`${payments.createdAt} ASC`, sql`${payments.id} ASC`]
            : sort === "amount"
              ? [sql`${payments.amount} DESC`, sql`${payments.createdAt} DESC`]
              : [desc(payments.createdAt), desc(payments.id)]
          )
        )
        .limit(exporting ? 5000 : limit)
        .offset(exporting ? 0 : (page - 1) * limit),
    ]);

    const total = totalResult[0]?.total ?? 0;
    if (exporting) {
      const header = [
        "reference",
        "store",
        "account",
        "amount",
        "currency",
        "gateway",
        "status",
        "paid_at",
        "created_at",
      ];
      const lines = rows.map((row) =>
        [
          row.reference,
          row.storeName,
          row.userEmail || row.userName,
          row.amount,
          row.currency,
          row.gateway,
          row.status,
          row.paidAt?.toISOString(),
          row.createdAt.toISOString(),
        ]
          .map(csvCell)
          .join(",")
      );
      return new NextResponse([header.map(csvCell).join(","), ...lines].join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="sellup-payments.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      payments: rows.map(({ userEmail, ...payment }) => ({
        ...payment,
        userName: payment.userName || userEmail || "Unknown",
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin payments error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}
