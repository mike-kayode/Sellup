import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminMemberships,
  businesses,
  customers,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const querySchema = z.object({
  type: z.enum(["platform", "buyers"]).default("platform"),
  search: z.string().max(100).default(""),
  role: z
    .enum([
      "all",
      "user",
      "merchant",
      "superadmin",
      "admin",
      "platform_admin",
      "support_agent",
      "finance_manager",
      "content_manager",
      "moderator",
      "developer",
      "analyst",
    ])
    .default("all"),
  status: z.enum(["all", "active", "inactive", "blocked", "unblocked"]).default("all"),
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
        { error: "Invalid user list filters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, search, role, status, sort, page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const searchTerm = search.trim().replace(/[%_\\]/g, "");

    if (type === "buyers") {
      const filters = [];
      if (searchTerm) {
        const pattern = `${searchTerm.toLowerCase()}%`;
        filters.push(
          or(
            sql`lower(${customers.name}) LIKE ${pattern}`,
            sql`lower(${customers.email}) LIKE ${pattern}`,
            sql`lower(${customers.phone}) LIKE ${pattern}`,
            sql`lower(${businesses.storeName}) LIKE ${pattern}`
          )!
        );
      }
      if (status === "blocked") filters.push(eq(customers.isBlocked, true));
      if (status === "unblocked") filters.push(eq(customers.isBlocked, false));
      const where = filters.length ? and(...filters) : undefined;
      const orderBy =
        sort === "oldest"
          ? [sql`${customers.createdAt} ASC`, sql`${customers.id} ASC`]
          : sort === "name"
            ? [sql`lower(${customers.name}) ASC`, sql`${customers.id} ASC`]
            : [desc(customers.createdAt), desc(customers.id)];

      const [totalResult, rows] = await Promise.all([
        db
          .select({ total: count() })
          .from(customers)
          .innerJoin(businesses, eq(businesses.id, customers.storeId))
          .where(where),
        db
          .select({
            id: customers.id,
            storeId: customers.storeId,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            totalSpent: customers.totalSpent,
            totalOrders: customers.totalOrders,
            isBlocked: customers.isBlocked,
            createdAt: customers.createdAt,
            storeName: businesses.storeName,
            storeSlug: businesses.storeSlug,
          })
          .from(customers)
          .innerJoin(businesses, eq(businesses.id, customers.storeId))
          .where(where)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset),
      ]);
      const total = totalResult[0]?.total ?? 0;
      return NextResponse.json({
        type,
        users: rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
    }

    const filters = [];
    if (searchTerm) {
      const pattern = `${searchTerm.toLowerCase()}%`;
      filters.push(
        or(
          sql`lower(${users.fullName}) LIKE ${pattern}`,
          sql`lower(${users.email}) LIKE ${pattern}`
        )!
      );
    }
    if (role !== "all") {
      if (role === "merchant") {
        filters.push(
          or(
            eq(users.role, "merchant"),
            sql`EXISTS (
              SELECT 1 FROM ${businesses} merchant_business
              WHERE merchant_business.user_id = ${users.id}
            )`
          )!
        );
      } else {
        filters.push(
          or(
            eq(adminMemberships.role, role),
            and(isNull(adminMemberships.id), eq(users.role, role))
          )!
        );
      }
    }
    if (status === "active") filters.push(eq(users.isActive, true));
    if (status === "inactive") filters.push(eq(users.isActive, false));
    const where = filters.length ? and(...filters) : undefined;
    const orderBy =
      sort === "oldest"
        ? [sql`${users.createdAt} ASC`, sql`${users.id} ASC`]
        : sort === "name"
          ? [sql`lower(${users.fullName}) ASC`, sql`${users.id} ASC`]
          : [desc(users.createdAt), desc(users.id)];

    const [totalResult, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(users)
        .leftJoin(adminMemberships, eq(adminMemberships.userId, users.id))
        .where(where),
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          phone: users.phone,
          isEmailVerified: users.isEmailVerified,
          isActive: users.isActive,
          accountRole: users.role,
          staffRole: adminMemberships.role,
          staffActive: adminMemberships.isActive,
          createdAt: users.createdAt,
          storeCount: sql<number>`(
            SELECT count(*)::int FROM ${businesses}
            WHERE ${businesses.userId} = ${users.id}
          )`,
        })
        .from(users)
        .leftJoin(adminMemberships, eq(adminMemberships.userId, users.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.total ?? 0;
    return NextResponse.json({
      type,
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        phone: row.phone,
        isVerified: row.isEmailVerified,
        isActive: row.isActive,
        role:
          row.staffActive && row.staffRole
            ? row.staffRole
            : row.storeCount > 0
              ? "merchant"
              : row.accountRole || "user",
        storeCount: row.storeCount,
        createdAt: row.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
