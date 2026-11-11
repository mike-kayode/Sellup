import { createReadStream } from "node:fs";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { backupRecords } from "@/db/schema";
import { verifyBackupDownloadSignature } from "@/lib/admin-backups";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const expiresAt = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  if (!z.string().uuid().safeParse(id).success || !Number.isSafeInteger(expiresAt)
      || !verifyBackupDownloadSignature(id, expiresAt, signature)) {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
  }
  try {
    const [backup] = await db.select({
      name: backupRecords.name,
      status: backupRecords.status,
      location: backupRecords.location,
    }).from(backupRecords).where(eq(backupRecords.id, id)).limit(1);
    if (!backup || backup.status !== "completed" || !backup.location) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    const configuredDirectory = process.env.BACKUP_DIRECTORY;
    if (!configuredDirectory || !path.isAbsolute(configuredDirectory)) {
      return NextResponse.json({ error: "Backup storage is unavailable" }, { status: 503 });
    }
    const backupRoot = await realpath(configuredDirectory);
    const filePath = await realpath(backup.location);
    if (!filePath.startsWith(`${backupRoot}${path.sep}`)) {
      console.error("Backup file location is outside the configured backup directory");
      return NextResponse.json({ error: "Backup storage is unavailable" }, { status: 500 });
    }
    const fileStream = createReadStream(filePath);
    return new Response(Readable.toWeb(fileStream) as ReadableStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(backup.name)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Backup download failed:", error);
    return NextResponse.json({ error: "Failed to download backup" }, { status: 500 });
  }
}
