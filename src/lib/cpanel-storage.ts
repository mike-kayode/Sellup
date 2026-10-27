/**
 * cPanel filesystem storage for Sell Up product/image storage.
 *
 * Images are written to a dedicated uploads directory on the cPanel server
 * and served over HTTPS via the configured MEDIA_BASE_URL. Supabase remains
 * the source of truth for image metadata (URLs, storeId, folder, size, etc.).
 *
 * Required env vars:
 *   MEDIA_BASE_URL          https://media.example.com or https://example.com/uploads
 *   CPANEL_UPLOAD_DIRECTORY /home/username/public_html/uploads (absolute filesystem path)
 *   CPANEL_BASE_URL         https://example.com/uploads (public URL prefix matching the directory)
 *
 * Optional env vars:
 *   MAX_IMAGE_BYTES         Max upload size in bytes (default 8MB)
 *   ALLOWED_IMAGE_TYPES     Comma-separated MIME types (default: image/jpeg,image/png,image/webp,image/gif)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const uploadDir =
  process.env.CPANEL_UPLOAD_DIRECTORY ||
  path.join(process.cwd(), "public_html", "uploads");
const mediaBaseUrl =
  process.env.MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const cpanelBaseUrl =
  process.env.CPANEL_BASE_URL ||
  mediaBaseUrl.replace(/\/+$/, "") + "/uploads";
const maxImageBytes = Number(process.env.MAX_IMAGE_BYTES || 8 * 1024 * 1024);
const allowedTypes = new Set(
  (process.env.ALLOWED_IMAGE_TYPES ||
    "image/jpeg,image/png,image/webp,image/gif")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
);

export interface CPanelUploadResult {
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  size: number;
}

export interface ImageMetadata {
  id: string;
  ownerId: string | null;
  fileName: string;
  originalName: string | null;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const IMAGE_SIGNATURES: Record<string, number[] | null> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/webp": null,
  "image/gif": [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
};

const SCRIPT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".php", ".py", ".rb", ".pl", ".sh", ".cgi",
  ".asp", ".aspx", ".jsp", ".htm", ".html", ".phtml",
]);

export function ensureUploadDir(): void {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
}

function hasDangerousExtension(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return SCRIPT_EXTENSIONS.has(ext);
}

function validateImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/webp") {
    if (buffer.length < 12) return false;
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    return riff === "RIFF" && webp === "WEBP";
  }
  const sig = IMAGE_SIGNATURES[mimeType];
  if (!sig) return false;
  if (buffer.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buffer[i] !== sig[i]) return false;
  }
  return true;
}

export function validateUploadFile(
  fileName: string,
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  if (!allowedTypes.has(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Allowed: ${Array.from(allowedTypes).join(", ")}.`,
    };
  }
  if (size > maxImageBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.round(maxImageBytes / 1024 / 1024)}MB.`,
    };
  }
  if (size === 0) {
    return { valid: false, error: "Empty file." };
  }
  if (hasDangerousExtension(fileName)) {
    return {
      valid: false,
      error: "File extension not allowed.",
    };
  }
  return { valid: true };
}

function generateFileName(originalName: string): string {
  const randomBytes = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const ext = path.extname(originalName).toLowerCase();
  const base = safeFileName(path.basename(originalName, ext));
  return `${timestamp}-${randomBytes}-${base}${ext}`;
}

function buildRelativePath(folder: string, fileName: string): string {
  const safeFolder = folder.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safeFolder}/${fileName}`;
}

function getFullPath(relativePath: string): string {
  return path.join(uploadDir, relativePath);
}

export function getPublicUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, "");
  const base = cpanelBaseUrl.replace(/\/+$/, "");
  return `${base}/${normalized}`;
}

export async function uploadToCpanel(
  fileName: string,
  buffer: Buffer,
  mimeType: string,
  folder: string = "products"
): Promise<CPanelUploadResult> {
  const validation = validateUploadFile(fileName, mimeType, buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!validateImageSignature(buffer, mimeType)) {
    throw new Error("File content does not match its image type.");
  }

  ensureUploadDir();

  const safeName = generateFileName(fileName);
  const relativePath = buildRelativePath(folder, safeName);
  const fullPath = getFullPath(relativePath);

  const resolvedFullPath = path.resolve(fullPath);
  const resolvedUploadDir = path.resolve(uploadDir);
  if (!resolvedFullPath.startsWith(resolvedUploadDir + path.sep)) {
    throw new Error("Invalid file path.");
  }

  fs.writeFileSync(resolvedFullPath, buffer);

  return {
    fileName: safeName,
    filePath: relativePath,
    publicUrl: getPublicUrl(relativePath),
    mimeType,
    size: buffer.length,
  };
}

export async function deleteFromCpanel(relativePath: string): Promise<boolean> {
  const fullPath = getFullPath(relativePath);
  const resolvedFullPath = path.resolve(fullPath);
  const resolvedUploadDir = path.resolve(uploadDir);
  if (!resolvedFullPath.startsWith(resolvedUploadDir + path.sep)) {
    return false;
  }
  try {
    if (fs.existsSync(resolvedFullPath)) {
      fs.unlinkSync(resolvedFullPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function fileExists(relativePath: string): boolean {
  try {
    const fullPath = getFullPath(relativePath);
    const resolvedFullPath = path.resolve(fullPath);
    const resolvedUploadDir = path.resolve(uploadDir);
    if (!resolvedFullPath.startsWith(resolvedUploadDir + path.sep)) {
      return false;
    }
    return fs.existsSync(resolvedFullPath);
  } catch {
    return false;
  }
}