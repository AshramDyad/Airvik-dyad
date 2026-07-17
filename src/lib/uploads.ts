export const UPLOAD_CATEGORIES = [
  "properties",
  "rooms",
  "room-types",
  "events",
  "reviews",
  "posts",
] as const;

export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_ADMIN_IMAGE_BYTES = 5 * 1024 * 1024;

const uploadCategorySet = new Set<string>(UPLOAD_CATEGORIES);
const imageMimeTypeSet = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

export function isUploadCategory(value: unknown): value is UploadCategory {
  return typeof value === "string" && uploadCategorySet.has(value);
}

export function isAllowedImageMimeType(value: string): boolean {
  return imageMimeTypeSet.has(value);
}
