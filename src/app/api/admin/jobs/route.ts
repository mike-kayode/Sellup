import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, backgroundJobs, systemSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const actionSchema = z.object({
  jobId: z.string().uuid(),
  action: z.enum(["retry", "cancel"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const filters = status === "all" ? [] : [eq(backgroundJobs.status, status)];
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows, settingRows] = await Promise.all([
      db.select({ total: count() }).from(backgroundJobs).where(where),
      db.select({
        id: backgroundJobs.id,
        name: backgroundJobs.name,
        type: backgroundJobs.type,
        status: backgroundJobs.status,
        attempts: backgroundJobs.attempts,
        maxAttempts: backgroundJobs.maxAttempts,
        error: backgroundJobs.error,
        startedAt: backgroundJobs.startedAt,
        scheduledAt: backgroundJobs.scheduledAt,
        completedAt: backgroundJobs.completedAt,
        createdAt: backgroundJobs.createdAt,
      }).from(backgroundJobs).where(where)
        .orderBy(desc(backgroundJobs.createdAt), desc(backgroundJobs.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ key: systemSettings.key, updatedAt: systemSettings.updatedAt })
        .from(systemSettings)
        .where(inArray(systemSettings.key, ["cron.health", "cron.last_run.subscription_dunning", "cron.last_run.webhook_deliveries"]))
        .limit(20),
    ]);
    return NextResponse.json({
      jobs: rows.map((job) => ({
        ...job,
        lastRun: job.startedAt || job.createdAt,
        duration: job.completedAt && job.startedAt
          ? `${Math.max(0, Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000))}s`
          : job.status === "running" ? "running" : "—",
      })),
      cronHealth: settingRows.map(({ key, updatedAt }) => ({ name: key, lastRun: updatedAt })),
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin jobs error:", error);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid job action", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const job = await db.transaction(async (tx) => {
      const [before] = await tx.select({
        id: backgroundJobs.id,
        status: backgroundJobs.status,
        attempts: backgroundJobs.attempts,
        maxAttempts: backgroundJobs.maxAttempts,
        scheduledAt: backgroundJobs.scheduledAt,
      }).from(backgroundJobs).where(eq(backgroundJobs.id, parsed.data.jobId)).limit(1);
      if (!before) return { missing: true as const };
      if (parsed.data.action === "cancel" && before.status !== "pending") {
        return { conflict: "Only pending jobs can be cancelled" as const };
      }
      if (parsed.data.action === "retry" && (before.status !== "failed" || (before.attempts ?? 0) >= (before.maxAttempts ?? 3))) {
        return { conflict: "Only failed jobs with retry attempts remaining can be retried" as const };
      }
      const [after] = await tx.update(backgroundJobs)
        .set(parsed.data.action === "cancel"
          ? { status: "cancelled", completedAt: new Date() }
          : {
              status: "pending",
              attempts: 0,
              error: null,
              startedAt: null,
              completedAt: null,
              scheduledAt: new Date(),
            })
        .where(and(
          eq(backgroundJobs.id, parsed.data.jobId),
          eq(backgroundJobs.status, before.status)
        ))
        .returning({
          id: backgroundJobs.id,
          name: backgroundJobs.name,
          status: backgroundJobs.status,
        });
      if (!after) return { conflict: "Job changed while the action was being processed" as const };
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: `admin.job.${parsed.data.action}`,
        resourceType: "background_job",
        resourceId: before.id,
        previousValue: before,
        newValue: { status: after.status, reason: parsed.data.reason },
        ipAddress,
        userAgent,
      });
      return { job: after };
    });
    if ("missing" in job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if ("conflict" in job) return NextResponse.json({ error: job.conflict }, { status: 409 });
    return NextResponse.json(job);
  } catch (error) {
    console.error("Admin job action error:", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}
