import { and, asc, eq, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, contentPages } from "@/db/schema";

const BATCH_SIZE = 25;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const now = new Date();
    const published = await db.transaction(async (tx) => {
      const due = await tx.select({
        id: contentPages.id,
        title: contentPages.title,
        scheduledAt: contentPages.scheduledAt,
      }).from(contentPages)
        .where(and(
          eq(contentPages.status, "scheduled"),
          lte(contentPages.scheduledAt, now)
        ))
        .orderBy(asc(contentPages.scheduledAt), asc(contentPages.id))
        .limit(BATCH_SIZE);
      const updatedIds = [];
      for (const page of due) {
        const [updated] = await tx.update(contentPages)
          .set({ status: "published", updatedAt: now })
          .where(and(
            eq(contentPages.id, page.id),
            eq(contentPages.status, "scheduled"),
            lte(contentPages.scheduledAt, now)
          ))
          .returning({ id: contentPages.id });
        if (!updated) continue;
        await tx.insert(auditLogs).values({
          actorRole: "system",
          action: "content.page.scheduled_published",
          resourceType: "content_page",
          resourceId: page.id,
          previousValue: { status: "scheduled", scheduledAt: page.scheduledAt },
          newValue: { status: "published", title: page.title },
        });
        updatedIds.push(page.id);
      }
      return updatedIds;
    });
    return NextResponse.json({ processed: published.length, batchLimit: BATCH_SIZE });
  } catch (error) {
    console.error("Scheduled content publishing failed:", error);
    return NextResponse.json({ error: "Scheduled content publishing failed" }, { status: 500 });
  }
}
