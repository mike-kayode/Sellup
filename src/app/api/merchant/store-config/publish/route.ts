import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStoreOwnership } from "@/lib/storefront/api";
import { deriveThemeTokens } from "@/lib/storefront/theme";
import {
  getPublishedConfig,
  publishDraftConfig,
} from "@/lib/storefront/store";

const bodySchema = z.object({ storeId: z.string().uuid() });

/**
 * POST /api/merchant/store-config/publish
 * Copy the draft to the live config and keep the last 10 revisions.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    const access = await requireStoreOwnership(request, parsed.data.storeId);
    if (!access.ok) return access.response;

    const published = await publishDraftConfig(access.store.id);
    if (!published) {
      return NextResponse.json(
        { error: "Nothing to publish yet — save a draft first." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Published",
      config: published,
      theme: deriveThemeTokens(published.brand.color),
      publishedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Store config publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish store config" },
      { status: 500 }
    );
  }
}

/** GET returns whether a published config exists (wizard status chip). */
export async function GET(request: NextRequest) {
  try {
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId || !z.string().uuid().safeParse(storeId).success) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }
    const access = await requireStoreOwnership(request, storeId);
    if (!access.ok) return access.response;

    const published = await getPublishedConfig(access.store.id);
    return NextResponse.json({
      published: published !== null,
      publishedAt: published ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error("Store config publish status error:", error);
    return NextResponse.json(
      { error: "Failed to load publish status" },
      { status: 500 }
    );
  }
}