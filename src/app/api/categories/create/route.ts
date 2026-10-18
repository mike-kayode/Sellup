import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const createCategorySchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  image: z.string().optional(),
});

export async function POST(request: NextRequest) {
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
    const validatedData = createCategorySchema.parse(body);

    // Verify the user owns the store
    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, validatedData.storeId))
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

    const newCategory = await db
      .insert(categories)
      .values({
        storeId: validatedData.storeId,
        name: validatedData.name,
        slug: slugify(validatedData.name),
        description: validatedData.description,
        image: validatedData.image,
      })
      .returning({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      });

    return NextResponse.json(
      {
        message: "Category created successfully",
        category: newCategory[0],
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

    console.error("Category creation error:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
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
