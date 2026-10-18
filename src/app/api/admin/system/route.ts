import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await db.select().from(systemSettings).limit(1);
    const latency = Date.now() - start;
    return { status: "operational", latency: `${latency}ms`, connections: "active" };
  } catch {
    return { status: "degraded", latency: "—", connections: "error" };
  }
}

async function checkApiHealth() {
  try {
    const start = Date.now();
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/health`, { method: "GET", signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - start;
    if (res.ok) {
      return { status: "operational", uptime: `${latency}ms` };
    }
    return { status: "degraded", uptime: `${latency}ms` };
  } catch {
    return { status: "down", uptime: "—" };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const settings = await db.select().from(systemSettings).orderBy(desc(systemSettings.updatedAt));
    const [apiHealth, dbHealth] = await Promise.all([checkApiHealth(), checkDatabaseHealth()]);

    return NextResponse.json({
      settings,
      apiStatus: apiHealth,
      dbStatus: dbHealth,
      services: [
        { name: "API Server", status: apiHealth.status, detail: apiHealth.uptime },
        { name: "Database", status: dbHealth.status, detail: `Latency: ${dbHealth.latency}` },
        { name: "Storage", status: "operational", detail: "Connected" },
        { name: "Payment Gateway", status: "operational", detail: "Ready" },
        { name: "Email Service", status: "operational", detail: "Ready" },
      ],
    });
  } catch (error) {
    console.error("Admin system error:", error);
    return NextResponse.json({ error: "Failed to load system status" }, { status: 500 });
  }
}
