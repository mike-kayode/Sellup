import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreOwnership } from "@/lib/storefront/api";
import { createPreviewToken } from "@/lib/storefront/store";

const bodySchema = z.object({ storeId: z.string().uuid() });

/**
 * POST /api/merchant/store-config/preview-token
 * Mints a private 24h preview link: {origin}/preview/{token}.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    const access = await requireStoreOwnership(request, parsed.data.storeId);
    if (!access.ok) return access.response;

    const token = await createPreviewToken(access.store.id);
    const origin = (
      process.env.NEXT_PUBLIC_APP_URL || "https://sellup.ng"
    ).replace(/\/$/, "");

    return NextResponse.json({
      token,
      url: `${origin}/preview/${token}`,
      expiresInHours: 24,
    });
  } catch (error) {
    console.error("Preview token error:", error);
    return NextResponse.json(
      { error: "Failed to create preview link" },
      { status: 500 }
    );
  }
}