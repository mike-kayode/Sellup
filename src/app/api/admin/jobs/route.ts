import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { backgroundJobs, systemSettings } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const totalAgg = await db.select({ total: count() }).from(backgroundJobs);
    const jobs = await db.select().from(backgroundJobs).orderBy(desc(backgroundJobs.createdAt)).limit(50);
    const settings = await db.select().from(systemSettings).orderBy(desc(systemSettings.updatedAt)).limit(10);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        lastRun: job.startedAt || job.createdAt,
        nextRun: job.scheduledAt,
        duration: job.completedAt && job.startedAt
          ? `${Math.max(0, Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000))}s`
          : job.status === "running" ? "running" : "—",
      })),
      total: totalAgg[0]?.total ?? 0,
      settings,
    });
  } catch (error) {
    console.error("Admin jobs error:", error);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}
