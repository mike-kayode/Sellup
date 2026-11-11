import { NextRequest, NextResponse } from "next/server";
import {
  markExpiredSubscriptionsPastDue,
  processDueSubscriptionRetries,
} from "@/lib/subscription-dunning";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const actor = {
      id: null,
      role: "system",
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent"),
    };
    const marked = await markExpiredSubscriptionsPastDue(actor);
    const retries = await processDueSubscriptionRetries(actor);
    return NextResponse.json({ ...marked, retries });
  } catch (error) {
    console.error("Subscription dunning cron batch failed:", error);
    return NextResponse.json({ error: "Dunning batch failed" }, { status: 500 });
  }
}
