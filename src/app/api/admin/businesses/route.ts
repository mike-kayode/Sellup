import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businesses, orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const querySchema = z.object({
  search: z.string().max(100).default(""),
  plan: z.string().max(100).default("all"),
  country: z.string().max(100).default(""),
  status: z
    .enum(["all", "active", "inactive", "suspended", "restricted", "verified", "unverified"])
    .default("all"),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid business list filters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { search: rawSearch, plan, country, status, sort, page, limit } =
      parsed.data;
    const search = rawSearch.replace(/[%_\\]/g, "").trim().toLowerCase();
    const offset = (page - 1) * limit;
    const filters = [];

    if (search) {
      const searchPattern = `${search}%`;
      filters.push(
        or(
          sql`lower(${businesses.storeName}) LIKE ${searchPattern}`,
          sql`lower(${businesses.storeSlug}) LIKE ${searchPattern}`,
          sql`lower(${users.fullName}) LIKE ${searchPattern}`,
          sql`lower(${users.email}) LIKE ${searchPattern}`
        )!
      );
    }
    if (plan !== "all") filters.push(eq(businesses.plan, plan));
    if (country) {
      filters.push(sql`lower(${businesses.country}) = ${country.toLowerCase()}`);
    }

    const notSuspended = or(
      eq(businesses.isSuspended, false),
      isNull(businesses.isSuspended)
    )!;
    const notRestricted = or(
      eq(businesses.isRestricted, false),
      isNull(businesses.isRestricted)
    )!;

    switch (status) {
      case "active":
        filters.push(
          and(eq(businesses.isPublished, true), notSuspended, notRestricted)!
        );
        break;
      case "inactive":
        filters.push(
          and(
            eq(businesses.isPublished, false),
            notSuspended,
            notRestricted
          )!
        );
        break;
      case "suspended":
        filters.push(eq(businesses.isSuspended, true));
        break;
      case "restricted":
        filters.push(eq(businesses.isRestricted, true));
        break;
      case "verified":
        filters.push(eq(businesses.isVerified, true));
        break;
      case "unverified":
        filters.push(eq(businesses.isVerified, false));
        break;
    }

    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows, planOptions, countryOptions] = await Promise.all([
      db
        .select({ total: count() })
        .from(businesses)
        .innerJoin(users, eq(users.id, businesses.userId))
        .where(where),
      db
        .select({
          id: businesses.id,
          name: businesses.storeName,
          slug: businesses.storeSlug,
          plan: businesses.plan,
          country: businesses.country,
          currency: businesses.currency,
          isPublished: businesses.isPublished,
          isSuspended: businesses.isSuspended,
          isRestricted: businesses.isRestricted,
          isVerified: businesses.isVerified,
          statusReason: businesses.statusReason,
          owner: users.fullName,
          ownerEmail: users.email,
          createdAt: businesses.createdAt,
        })
        .from(businesses)
        .innerJoin(users, eq(users.id, businesses.userId))
        .where(where)
        .orderBy(
          sort === "oldest"
            ? asc(businesses.createdAt)
            : sort === "name"
              ? asc(sql`lower(${businesses.storeName})`)
              : desc(businesses.createdAt)
        )
        .limit(limit)
        .offset(offset),
      db
        .selectDistinct({ plan: businesses.plan })
        .from(businesses)
        .where(isNotNull(businesses.plan))
        .orderBy(businesses.plan)
        .limit(100),
      db
        .selectDistinct({ country: businesses.country })
        .from(businesses)
        .where(isNotNull(businesses.country))
        .orderBy(businesses.country)
        .limit(100),
    ]);

    const storeIds = rows.map((row) => row.id);
    const orderTotals = storeIds.length
      ? await db
          .select({
            storeId: orders.storeId,
            orders: count(),
            revenue: sql<string>`COALESCE(SUM(
              CASE WHEN ${orders.paymentStatus} = 'paid' THEN ${orders.total} ELSE 0 END
            ), 0)::text`,
          })
          .from(orders)
          .where(inArray(orders.storeId, storeIds))
          .groupBy(orders.storeId)
      : [];
    const orderTotalsByStore = new Map(
      orderTotals.map((order) => [order.storeId, order])
    );
    const total = totalResult[0]?.total ?? 0;

    return NextResponse.json({
      businesses: rows.map((business) => {
        const totals = orderTotalsByStore.get(business.id);
        const state = business.isSuspended
          ? "suspended"
          : business.isRestricted
            ? "restricted"
            : business.isPublished
              ? "active"
              : "inactive";
        return {
          ...business,
          orders: totals?.orders ?? 0,
          revenue: totals?.revenue ?? "0",
          state,
        };
      }),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      planOptions: planOptions.flatMap((option) =>
        option.plan ? [option.plan] : []
      ),
      countryOptions: countryOptions.flatMap((option) =>
        option.country ? [option.country] : []
      ),
    });
  } catch (error) {
    console.error("Admin businesses error:", error);
    return NextResponse.json(
      { error: "Failed to load businesses" },
      { status: 500 }
    );
  }
}
