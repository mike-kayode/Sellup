import { NextRequest, NextResponse } from "next/server";
import { processBackupRetentionBatch } from "@/lib/admin-backups";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await processBackupRetentionBatch());
  } catch (error) {
    console.error("Backup retention cron failed:", error);
    return NextResponse.json({ error: "Backup retention failed" }, { status: 500 });
  }
}
