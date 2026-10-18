import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, subscriptions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeBusinessSlug, validateStoreSlug } from "@/lib/slugs";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendStoreWelcomeEmail } from "@/lib/email";
import { storeHref } from "@/lib/urls";

const createStoreSchema = z.object({
  storeName: z.string().min(2).max(255),
  // Optional merchant-chosen slug (from onboarding). Normalized and
  // validated in the handler so friendly errors surface to the merchant.
  storeSlug: z.string().max(60).optional(),
  businessType: z.enum(["product", "service", "both"]).optional().default("product"),
  whatsappNumber: z.string().min(10).max(20),
  description: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Resolve authenticated user from Supabase JWT (never trust frontend userId)
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

    const userId = user.id;

    const body = await request.json();
    const validatedData = createStoreSchema.parse(body);

    // Resolve the store slug: a merchant-chosen slug (onboarding) wins and
    // must carry their business name; otherwise derive a unique one from it.
    let storeSlug = "";
    if (validatedData.storeSlug) {
      const requested = normalizeBusinessSlug(validatedData.storeSlug);
      const slugError = validateStoreSlug(requested);
      if (!requested || slugError) {
        return NextResponse.json(
          { error: slugError || "Store URL cannot be empty" },
          { status: 400 }
        );
      }
      const requestedExisting = await db.select({ id: stores.id }).from(stores)
        .where(eq(stores.storeSlug, requested)).limit(1);
      if (requestedExisting.length > 0) {
        return NextResponse.json(
          { error: `"${requested}" is already in use. Please choose another store URL.` },
          { status: 409 }
        );
      }
      storeSlug = requested;
    } else {
      const baseSlug = normalizeBusinessSlug(validatedData.storeName);
      if (!baseSlug) {
        return NextResponse.json({ error: "Store name cannot produce a valid store URL" }, { status: 400 });
      }

      for (let counter = 1; counter <= 1000; counter++) {
        const suffix = counter === 1 ? "" : `-${counter}`;
        const candidate = `${baseSlug.slice(0, 50 - suffix.length)}${suffix}`;
        if (validateStoreSlug(candidate)) continue;

        const existing = await db.select({ id: stores.id }).from(stores)
          .where(eq(stores.storeSlug, candidate)).limit(1);
        if (existing.length === 0) {
          storeSlug = candidate;
          break;
        }
      }

      if (!storeSlug) {
        return NextResponse.json({ error: "Unable to generate a unique store URL" }, { status: 409 });
      }
    }

    // Store and its initial subscription must be created together.
    const newStore = await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: user.email || `${userId}@supabase.local`,
        fullName: (user.user_metadata?.full_name as string) || user.email || "Sell Up user",
        phone: (user.user_metadata?.phone as string) || null,
        password: "",
      }).onConflictDoNothing({ target: users.id });

      const createdStore = await tx
        .insert(stores)
        .values({
          userId,
          storeName: validatedData.storeName,
          storeSlug,
          businessType: validatedData.businessType,
          whatsappNumber: validatedData.whatsappNumber,
          description: validatedData.description,
          email: validatedData.email,
          phone: validatedData.phone,
        })
        .returning({
          id: stores.id,
          storeName: stores.storeName,
          storeSlug: stores.storeSlug,
          businessType: stores.businessType,
          whatsappNumber: stores.whatsappNumber,
        });

      if (!createdStore[0]) {
        throw new Error("Store creation returned no record");
      }

      await tx.insert(subscriptions).values({
        storeId: createdStore[0].id,
        plan: "freemium",
        status: "active",
      });

      return createdStore;
    });

    // Fire-and-forget store welcome email (if the owner supplied an email).
    // Email failures must never fail store creation.
    const ownerEmail = validatedData.email || user.email;
    if (ownerEmail && newStore[0]) {
      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://sellup.ng"
      ).replace(/\/$/, "");
      sendStoreWelcomeEmail(
        ownerEmail,
        (user.user_metadata?.full_name as string) || user.email || "Seller",
        validatedData.storeName,
        storeHref(storeSlug, "", { absolute: true, origin: appUrl }),
        `${appUrl}/dashboard`
      ).catch((err) => console.error("Store welcome email failed:", err));
    }

    return NextResponse.json(
      {
        message: "Store created successfully",
        store: newStore[0],
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Store creation error:", error);
    return NextResponse.json(
      { error: "Failed to create store" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
