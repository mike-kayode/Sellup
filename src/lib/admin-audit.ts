import { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface AuditLogInput {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(input: AuditLogInput) {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      previousValue: input.previousValue as any,
      newValue: input.newValue as any,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export function getClientInfo(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}
