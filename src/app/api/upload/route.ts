import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { validateImageFile, verifyImageSignature } from "@/lib/supabase/storage";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";

const IMAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "store-images";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const STORAGE_QUOTA_BYTES = 8 * 1024 * 1024;
const UPLOAD_FOLDERS = ["products", "logos", "banners"] as const;

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuthenticatedUser(request);
    if (authError) return authError;

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Upload request must be 8MB or smaller" }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const storeId = formData.get("storeId") as string | null;
    const requestedFolder = (formData.get("folder") as string | null) || "products";
    const folder = requestedFolder as typeof UPLOAD_FOLDERS[number];

    if (!file || !storeId) {
      return NextResponse.json(
        { error: "File and storeId are required" },
        { status: 400 }
      );
    }

    if (!["products", "logos", "banners"].includes(requestedFolder)) {
      return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
    }

    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.userId, user!.id)))
      .limit(1);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const validation = validateImageFile(file, MAX_UPLOAD_BYTES);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    if (!(await verifyImageSignature(file))) {
      return NextResponse.json({ error: "File content does not match its image type" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${storeId}/${folder}/${Date.now()}-${safeName}`;

    const adminSupabase = getSupabaseAdmin();
    let currentStorageBytes = 0;
    for (const uploadFolder of UPLOAD_FOLDERS) {
      const { data: storedFiles, error: listError } = await adminSupabase.storage
        .from(IMAGE_BUCKET)
        .list(`${storeId}/${uploadFolder}`, { limit: 1000 });
      if (listError) {
        console.error("Storage quota check error:", listError);
        return NextResponse.json({ error: "Unable to verify storage quota" }, { status: 503 });
      }
      currentStorageBytes += (storedFiles || []).reduce(
        (total, storedFile) => total + Number(storedFile.metadata?.size || 0),
        0
      );
    }

    if (currentStorageBytes + file.size > STORAGE_QUOTA_BYTES) {
      return NextResponse.json({ error: "Store storage quota exceeded (8MB maximum)" }, { status: 413 });
    }

    const { data, error: uploadError } = await adminSupabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError || !data) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const { data: publicData } = adminSupabase.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(data.path);

    return NextResponse.json(
      {
        url: publicData.publicUrl,
        path: data.path,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
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
