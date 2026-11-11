import { createHmac, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, realpath, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, backupRecords } from "@/db/schema";

function getBackupConfiguration() {
  const directory = process.env.BACKUP_DIRECTORY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!directory || !path.isAbsolute(directory)) {
    throw new Error("BACKUP_DIRECTORY must be configured as an absolute path");
  }
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const signingSecret = process.env.BACKUP_DOWNLOAD_SECRET || process.env.CRON_SECRET;
  if (!signingSecret) throw new Error("A backup signing secret is not configured");
  return { directory, databaseUrl, signingSecret };
}

function databaseEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  return {
    ...process.env,
    PGHOST: decodeURIComponent(parsed.hostname),
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    ...(parsed.searchParams.get("sslmode")
      ? { PGSSLMODE: parsed.searchParams.get("sslmode")! }
      : {}),
  };
}

export async function processOneDatabaseBackup() {
  const { directory, databaseUrl } = getBackupConfiguration();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const backupDirectory = await realpath(directory);
  const publicDirectory = path.resolve(process.cwd(), "public");
  if (backupDirectory === publicDirectory || backupDirectory.startsWith(`${publicDirectory}${path.sep}`)) {
    throw new Error("BACKUP_DIRECTORY must be outside the public directory");
  }

  const result = await db.transaction(async (tx) => {
    const [pending] = await tx.select({
      id: backupRecords.id,
      name: backupRecords.name,
    }).from(backupRecords)
      .where(eq(backupRecords.status, "pending"))
      .orderBy(asc(backupRecords.createdAt), asc(backupRecords.id))
      .limit(1);
    if (!pending) return null;
    const [claimed] = await tx.update(backupRecords)
      .set({ status: "running" })
      .where(and(eq(backupRecords.id, pending.id), eq(backupRecords.status, "pending")))
      .returning({ id: backupRecords.id });
    return claimed ? pending : null;
  });
  if (!result) return { processed: 0 };

  const filePath = path.join(backupDirectory, `${result.id}.dump`);
  try {
    const environment = databaseEnvironment(databaseUrl);
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        process.env.PG_DUMP_PATH || "pg_dump",
        ["--format=custom", "--no-owner", "--no-privileges", "--file", filePath],
        { env: environment, stdio: "ignore" }
      );
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, 120_000);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        if (timedOut) reject(new Error("Database backup timed out"));
        else resolve(code ?? 1);
      });
    });
    if (exitCode !== 0) throw new Error("pg_dump failed");

    await chmod(filePath, 0o600);
    const fileStat = await stat(filePath);
    await db.transaction(async (tx) => {
      await tx.update(backupRecords)
        .set({
          status: "completed",
          size: `${fileStat.size} bytes`,
          location: filePath,
          completedAt: new Date(),
        })
        .where(eq(backupRecords.id, result.id));
      await tx.insert(auditLogs).values({
        action: "backup.completed",
        actorRole: "system",
        resourceType: "backup",
        resourceId: result.id,
        newValue: { status: "completed", sizeBytes: fileStat.size },
      });
    });
    return { processed: 1, backupId: result.id, status: "completed" };
  } catch (error) {
    try {
      await unlink(filePath);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error("Failed to remove incomplete database backup file:", cleanupError);
      }
    }
    await db.transaction(async (tx) => {
      await tx.update(backupRecords)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(backupRecords.id, result.id));
      await tx.insert(auditLogs).values({
        action: "backup.failed",
        actorRole: "system",
        resourceType: "backup",
        resourceId: result.id,
        newValue: { status: "failed" },
      });
    });
    throw error;
  }
}

export async function processBackupRetentionBatch() {
  const { directory } = getBackupConfiguration();
  const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error("BACKUP_RETENTION_DAYS must be between 1 and 3650");
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const backupDirectory = await realpath(directory);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx.select({
      id: backupRecords.id,
      location: backupRecords.location,
      size: backupRecords.size,
    }).from(backupRecords)
      .where(and(
        eq(backupRecords.status, "completed"),
        lt(backupRecords.completedAt, cutoff)
      ))
      .orderBy(asc(backupRecords.completedAt), asc(backupRecords.id))
      .limit(10);
    const rows = [];
    for (const candidate of candidates) {
      const [claim] = await tx.update(backupRecords)
        .set({ status: "expiring" })
        .where(and(
          eq(backupRecords.id, candidate.id),
          eq(backupRecords.status, "completed")
        ))
        .returning({ id: backupRecords.id });
      if (claim) rows.push(candidate);
    }
    return rows;
  });

  let expired = 0;
  for (const backup of claimed) {
    try {
      if (backup.location) {
        const resolvedPath = path.resolve(backup.location);
        if (path.dirname(resolvedPath) !== backupDirectory) {
          throw new Error("Backup path is outside the configured backup directory");
        }
        try {
          const actualPath = await realpath(resolvedPath);
          if (path.dirname(actualPath) !== backupDirectory) {
            throw new Error("Backup file resolves outside the configured backup directory");
          }
          await unlink(actualPath);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
            throw error;
          }
        }
      }

      await db.transaction(async (tx) => {
        await tx.update(backupRecords)
          .set({ status: "expired", location: null })
          .where(and(eq(backupRecords.id, backup.id), eq(backupRecords.status, "expiring")));
        await tx.insert(auditLogs).values({
          action: "backup.expired",
          actorRole: "system",
          resourceType: "backup",
          resourceId: backup.id,
          previousValue: { status: "completed", size: backup.size },
          newValue: { status: "expired" },
        });
      });
      expired++;
    } catch (error) {
      await db.update(backupRecords)
        .set({ status: "completed" })
        .where(and(eq(backupRecords.id, backup.id), eq(backupRecords.status, "expiring")));
      throw error;
    }
  }
  return { processed: expired, batchLimit: 10, retentionDays };
}

export function createBackupDownloadSignature(id: string, expiresAt: number): string {
  const { signingSecret } = getBackupConfiguration();
  return createHmac("sha256", signingSecret).update(`${id}.${expiresAt}`).digest("hex");
}

export function verifyBackupDownloadSignature(id: string, expiresAt: number, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  try {
    const expected = Buffer.from(createBackupDownloadSignature(id, expiresAt), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
