/**
 * Supabase Storage helpers for Sell Up.
 * Used for product images, store logos, and banner uploads.
 *
 * Buckets (must be created in the Supabase dashboard):
 *   - store-images  (public read, authenticated write)
 *
 * Files are stored under `{bucket}/{storeId}/{uuid}-{safeName}`.
 */
import { getSupabaseClient } from "./client";

const IMAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "store-images";

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Build a public URL for a stored file path.
 */
export function getPublicUrl(path: string): string {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload an image (client-side). Uses the browser client (anon key) with
 * the currently authenticated session. Expects RLS policies to allow
 * authenticated uploads to the store-images bucket.
 */
export async function uploadImage(
  storeId: string,
  file: File,
  folder: "products" | "logos" | "banners" = "products"
): Promise<UploadResult> {
  const supabase = getSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${storeId}/${folder}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return {
    url: getPublicUrl(data.path),
    path: data.path,
  };
}

/**
 * Delete an image by its path.
 */
export async function deleteImage(path: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) {
    console.error("Delete image error:", error.message);
  }
}

/**
 * Validate a file before upload (MIME + size).
 */
export function validateImageFile(
  file: File,
  maxBytes: number = 5 * 1024 * 1024
): { valid: boolean; error?: string } {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return { valid: false, error: "Only JPG, PNG, WEBP and GIF images are allowed." };
  }
  if (file.size > maxBytes) {
    return { valid: false, error: "Image must be 5MB or smaller." };
  }
  return { valid: true };
}

export async function verifyImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (file.type === "image/webp") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (file.type === "image/gif") {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }
  return false;
}

export { IMAGE_BUCKET };
