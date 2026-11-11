import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const REQUIRED_ENVIRONMENT = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "PAYSTACK_SECRET_KEY",
  "FLUTTERWAVE_SECRET_KEY",
  "CPANEL_UPLOAD_DIRECTORY",
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  "AI_PROVIDER_ALLOWED_HOSTS",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "BACKUP_DIRECTORY",
  "BACKUP_DOWNLOAD_SECRET",
  "BACKUP_RETENTION_DAYS",
  "PG_DUMP_PATH",
];

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const start = Date.now();
    await db.select({ key: systemSettings.key }).from(systemSettings).limit(1);
    const dbLatency = Date.now() - start;
    const environment = REQUIRED_ENVIRONMENT.map((name) => ({
      name,
      present: Boolean(process.env[name]),
    }));
    const emailConfigured = Boolean(process.env.RESEND_API_KEY);
    const storageConfigured = Boolean(
      process.env.CPANEL_UPLOAD_DIRECTORY
      || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET)
    );
    const paymentsConfigured = Boolean(
      process.env.PAYSTACK_SECRET_KEY
      || process.env.FLUTTERWAVE_SECRET_KEY
      || process.env.PAYMENT_SECRET_KEY
    );
    const dbStatus = { status: "operational", latency: `${dbLatency}ms` };
    const services = [
      { name: "Application", status: "operational", detail: "Admin API responding" },
      { name: "Database", status: dbStatus.status, detail: `Query latency ${dbStatus.latency}` },
      { name: "Email", status: emailConfigured ? "operational" : "degraded", detail: emailConfigured ? "Provider credentials configured" : "RESEND_API_KEY is missing" },
      { name: "Storage", status: storageConfigured ? "operational" : "degraded", detail: storageConfigured ? "Storage configuration detected" : "Storage configuration missing" },
      { name: "Payments", status: paymentsConfigured ? "operational" : "degraded", detail: paymentsConfigured ? "At least one provider credential configured" : "No payment provider credentials detected" },
      { name: "Cron", status: process.env.CRON_SECRET ? "operational" : "degraded", detail: process.env.CRON_SECRET ? "Secret-protected cron endpoints enabled" : "CRON_SECRET is missing" },
    ];
    return NextResponse.json({
      apiStatus: { status: "operational", uptime: "online" },
      dbStatus,
      services,
      environment,
      app: {
        version: process.env.APP_VERSION || "unknown",
        buildTime: process.env.BUILD_TIME || "unknown",
      },
    });
  } catch (error) {
    console.error("Admin system health query failed:", error);
    return NextResponse.json({ error: "Failed to load system status" }, { status: 500 });
  }
}
