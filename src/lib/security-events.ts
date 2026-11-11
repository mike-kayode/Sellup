import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function recordSecurityEvent(
  action: string,
  request: Request,
  actorId?: string
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: actorId || null,
      actorRole: "system",
      action,
      resourceType: "authentication",
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      newValue: { outcome: "denied" },
    });
  } catch (error) {
    console.error("Security event recording failed:", error);
  }
}
