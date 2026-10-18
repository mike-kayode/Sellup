import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, stack, url } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    await db.insert(auditLogs).values({
      action: "client_error",
      resourceType: "error",
      previousValue: {
        message,
        stack,
        url,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json(
      { message: "Error logged successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error logging failed:", error);
    return NextResponse.json(
      { error: "Failed to log error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (process.env.NODE_ENV === "development") {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "client_error"))
        .orderBy(desc(auditLogs.createdAt))
        .limit(20);

      return NextResponse.json(
        {
          logs: logs.map((log) => ({
            id: log.id,
            message: (log.previousValue as { message: string } | null)?.message || "",
            stack: (log.previousValue as { stack?: string } | null)?.stack,
            url: (log.previousValue as { url?: string } | null)?.url,
            timestamp: log.createdAt,
          })),
          count: logs.length,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve logs" },
      { status: 500 }
    );
  }
}
