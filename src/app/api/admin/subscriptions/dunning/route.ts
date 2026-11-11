import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import {
  markExpiredSubscriptionsPastDue,
  processDueSubscriptionRetries,
} from "@/lib/subscription-dunning";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const clientInfo = getClientInfo(request);
    const actor = {
      id: user.id,
      role: user.role,
      ...clientInfo,
    };
    const marked = await markExpiredSubscriptionsPastDue(actor);
    const retries = await processDueSubscriptionRetries(actor);
    return NextResponse.json({ ...marked, retries });
  } catch (error) {
    console.error("Subscription dunning batch failed:", error);
    return NextResponse.json({ error: "Dunning batch failed" }, { status: 500 });
  }
}
