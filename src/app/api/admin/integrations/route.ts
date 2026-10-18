import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const rows = await db.select().from(integrations).orderBy(desc(integrations.createdAt));
    const integrationList = rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.isEnabled ? "active" : row.status,
      description: row.description || "",
      createdAt: row.createdAt,
    }));

    return NextResponse.json({
      integrations: integrationList,
      total: integrationList.length,
    });
  } catch (error) {
    console.error("Admin integrations error:", error);
    return NextResponse.json({ error: "Failed to load integrations" }, { status: 500 });
  }
}
