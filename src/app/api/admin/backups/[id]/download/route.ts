import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { backupRecords } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { createBackupDownloadSignature } from "@/lib/admin-backups";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
  try {
    const [backup] = await db.select({ id: backupRecords.id, status: backupRecords.status })
      .from(backupRecords).where(eq(backupRecords.id, id)).limit(1);
    if (!backup) return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    if (backup.status !== "completed") return NextResponse.json({ error: "Backup is not available for download" }, { status: 409 });
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const signature = createBackupDownloadSignature(id, expiresAt);
    const downloadUrl = new URL("/api/backups/download", request.url);
    downloadUrl.searchParams.set("id", id);
    downloadUrl.searchParams.set("expires", String(expiresAt));
    downloadUrl.searchParams.set("signature", signature);
    return NextResponse.json({ downloadUrl: downloadUrl.toString(), expiresAt });
  } catch (error) {
    console.error("Backup download link creation failed:", error);
    return NextResponse.json({ error: "Failed to create download link" }, { status: 500 });
  }
}
