/**
 * Image deletion endpoint.
 *
 * Authenticated users can delete images they own. The endpoint:
 * 1. Verifies the user's identity via Supabase Auth.
 * 2. Looks up the image record by ID and verifies ownership.
 * 3. Deletes the file from cPanel filesystem storage.
 * 4. Deletes the metadata record from PostgreSQL.
 * 5. Handles partial failures (file delete succeeds but DB delete fails, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthenticatedUser } from "@/lib/auth-middleware";
import { deleteFromCpanel } from "@/lib/cpanel-storage";

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuthenticatedUser(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("id");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 },
      );
    }

    // Look up the image record and verify ownership
    const [image] = await db
      .select()
      .from(images)
      .where(eq(images.id, imageId))
      .limit(1);

    if (!image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 },
      );
    }

    // Verify ownership (user is guaranteed non-null when auth passes)
    const userId = user!.id;
    if (image.ownerId && image.ownerId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to delete this image" },
        { status: 403 },
      );
    }

    // Delete the file from cPanel storage
    let fileDeleted = false;
    try {
      fileDeleted = await deleteFromCpanel(image.filePath);
      if (!fileDeleted) {
        console.warn(`Image file not found on disk: ${image.filePath}`);
      }
    } catch (fileErr) {
      console.error("Failed to delete image file from cPanel:", fileErr);
      // Continue to delete the DB record even if file deletion fails
    }

    // Delete the metadata record from PostgreSQL
    try {
      await db.delete(images).where(eq(images.id, imageId));
    } catch (dbErr) {
      console.error("Failed to delete image metadata from database:", dbErr);
      return NextResponse.json(
        { error: "Failed to delete image record" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Image deleted successfully",
        fileDeleted,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Image delete route error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
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