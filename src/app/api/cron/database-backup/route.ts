import { NextRequest, NextResponse } from "next/server";
import { processOneDatabaseBackup } from "@/lib/admin-backups";

export const runtime = "nodejs";
export const maxDuration = 150;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await processOneDatabaseBackup();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Database backup cron failed:", error);
    return NextResponse.json({ error: "Database backup failed" }, { status: 500 });
  }
}
