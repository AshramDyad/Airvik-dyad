import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { absoluteMediaUrl, publicMediaUrl } from "./cloudflare-images";

describe("cloudflare image URLs", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL", "https://media-origin.swaminarayan.yoga");
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps migrated local images to their public R2 URL", () => {
    expect(publicMediaUrl("/logo.png")).toBe(
      "https://media-origin.swaminarayan.yoga/static/58529a89110b16864723bb98.png",
    );
  });

  it("passes through external image URLs", () => {
    const source = "https://i.ytimg.com/vi/example/hqdefault.jpg";
    expect(publicMediaUrl(source)).toBe(source);
  });

  it("keeps local paths when R2 delivery is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED", "false");
    expect(publicMediaUrl("/logo.png")).toBe("/logo.png");
  });

  it("keeps local paths when the generated manifest has no entry", () => {
    expect(publicMediaUrl("/not-in-manifest.png")).toBe("/not-in-manifest.png");
  });

  it("builds absolute SEO URLs from the resolved media source", () => {
    expect(absoluteMediaUrl("/logo.png")).toBe(
      "https://media-origin.swaminarayan.yoga/static/58529a89110b16864723bb98.png",
    );
  });
});
