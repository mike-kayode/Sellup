import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeBusinessSlug, validateStoreSlug } from "@/lib/slugs";
import { canUseFeature, normalizePlan } from "@/lib/entitlements";

const updateStoreSchema = z.object({
  id: z.string().uuid(),
  storeName: z.string().min(2).max(255).optional(),
  // Normalized + validated in the handler so merchant typos (spaces,
  // capitals) are canonicalised rather than rejected.
  storeSlug: z.string().max(60).optional(),
  businessType: z.enum(["product", "service", "both"]).optional(),
  description: z.string().optional(),
  whatsappNumber: z.string().min(10).max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  // Merchant-supplied storefront logo (paid plans only — enforced below).
  logo: z.string().url().max(500).optional(),
  aboutText: z.string().optional(),
  isPublished: z.boolean().optional(),
  plan: z.string().optional(),
  // Product listing template for the public storefront.
  template: z.enum(["basic", "showcase"]).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    // Resolve authenticated user
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateStoreSchema.parse(body);

    const { id, ...updateData } = validatedData;

    // Verify the user owns the store
    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId, plan: stores.plan })
      .from(stores)
      .where(eq(stores.id, id))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (storeResult[0].userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this store" },
        { status: 403 }
      );
    }

    // Canonicalise and de-duplicate slug changes before writing.
    if (updateData.storeSlug !== undefined) {
      const requested = normalizeBusinessSlug(updateData.storeSlug);
      const slugError = validateStoreSlug(requested);
      if (!requested || slugError) {
        return NextResponse.json(
          { error: slugError || "Business URL cannot be empty" },
          { status: 400 }
        );
      }
      const taken = await db.select({ id: stores.id }).from(stores)
        .where(eq(stores.storeSlug, requested)).limit(1);
      if (taken.length > 0 && taken[0].id !== id) {
        return NextResponse.json(
          { error: `"${requested}" is already in use. Please choose another business URL.` },
          { status: 409 }
        );
      }
      updateData.storeSlug = requested;
    }

    // Custom merchant logos are a paid-plan perk (Starter and above).
    if (
      updateData.logo !== undefined &&
      !canUseFeature("CUSTOM_LOGO", normalizePlan(storeResult[0].plan))
    ) {
      return NextResponse.json(
        {
          error:
            "Custom store logos are available on paid plans (₦5,000/month and above).",
        },
        { status: 403 }
      );
    }

    // The Showcase product listing template requires the ₦5,000/month plan
    // (or any higher plan).
    if (
      updateData.template === "showcase" &&
      !canUseFeature(
        "PRODUCT_LISTING_TEMPLATE",
        normalizePlan(storeResult[0].plan)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The product listing template is available on the ₦5,000/month plan and above.",
        },
        { status: 403 }
      );
    }

    const updatedStore = await db
      .update(stores)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, id))
      .returning({
        id: stores.id,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
        businessType: stores.businessType,
      });

    if (updatedStore.length === 0) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Store updated successfully",
        store: updatedStore[0],
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Store update error:", error);
    return NextResponse.json(
      { error: "Failed to update store" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Use PUT method" },
    { status: 405 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
