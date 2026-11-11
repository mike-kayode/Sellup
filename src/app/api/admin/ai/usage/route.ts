import { count, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiGenerations } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const requestedDays = Number.parseInt(new URL(request.url).searchParams.get("days") || "30", 10);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const usage = await db.select({
      day: sql<string>`to_char(date_trunc('day', ${aiGenerations.createdAt}), 'YYYY-MM-DD')`,
      requests: count(),
      inputTokens: sql<number>`coalesce(sum(${aiGenerations.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${aiGenerations.outputTokens}), 0)`,
      costUsd: sql<string>`coalesce(sum(${aiGenerations.costUsd}), 0)::text`,
    }).from(aiGenerations)
      .where(gte(aiGenerations.createdAt, since))
      .groupBy(sql`date_trunc('day', ${aiGenerations.createdAt})`)
      .orderBy(sql`date_trunc('day', ${aiGenerations.createdAt})`)
      .limit(days);
    return NextResponse.json({ days, usage });
  } catch (cause) {
    console.error("AI usage report failed:", cause);
    return NextResponse.json({ error: "Failed to load AI usage" }, { status: 500 });
  }
}
