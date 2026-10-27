import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { validateImageFile, verifyImageSignature } from "@/lib/supabase/storage";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";
import { uploadToCpanel, getPublicUrl } from "@/lib/cpanel-storage";

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
        { status: 400 },
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
        { status: 400 },
      );
    }

    if (!(await verifyImageSignature(file))) {
      return NextResponse.json({ error: "File content does not match its image type" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const relativePath = `${storeId}/${folder}/${Date.now()}-${safeName}`;

    // Convert file to buffer for cPanel upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to cPanel filesystem storage
    let uploadResult;
    try {
      uploadResult = await uploadToCpanel(file.name, buffer, file.type, folder);
    } catch (cpanelErr) {
      console.error("cPanel upload failed:", cpanelErr);
      return NextResponse.json(
        { error: "Image storage unavailable. Please try again later." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        url: uploadResult.publicUrl,
        path: uploadResult.filePath,
        contentType: uploadResult.mimeType,
        size: uploadResult.size,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}
