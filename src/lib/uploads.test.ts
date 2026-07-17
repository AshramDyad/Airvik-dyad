import { describe, expect, it } from "vitest";

import {
  isAllowedImageMimeType,
  isUploadCategory,
  MAX_ADMIN_IMAGE_BYTES,
} from "./uploads";

describe("image upload validation", () => {
  it("accepts only known upload categories", () => {
    expect(isUploadCategory("rooms")).toBe(true);
    expect(isUploadCategory("event-banners")).toBe(false);
    expect(isUploadCategory(null)).toBe(false);
  });

  it("allows supported raster formats and blocks SVG uploads", () => {
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
    expect(isAllowedImageMimeType("image/webp")).toBe(true);
    expect(isAllowedImageMimeType("image/svg+xml")).toBe(false);
  });

  it("keeps the existing five-megabyte admin limit", () => {
    expect(MAX_ADMIN_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });
});
