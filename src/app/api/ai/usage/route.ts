
import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/merchant-auth";
import { getAiUsage } from "@/lib/ai-wrapper";

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const usage = await getAiUsage(merchant.storeId);
    return NextResponse.json({ usage });
  } catch (error) {
    console.error("AI usage error:", error);
    return NextResponse.json({ error: "Failed to get usage" }, { status: 500 });
  }
}

