import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import supabaseImageLoader from "../../supabase-image-loader.js";

describe("Supabase image loader", () => {
  it("routes Supabase public storage images through the transformation endpoint", () => {
    expect(
      supabaseImageLoader({
        src: "https://fflsucsqhjjuozmfwpho.supabase.co/storage/v1/object/public/images/events/photo.jpg",
        width: 640,
        quality: 70,
      }),
    ).toBe(
      "https://fflsucsqhjjuozmfwpho.supabase.co/storage/v1/render/image/public/images/events/photo.jpg?width=640&quality=70",
    );
  });

  it("preserves existing query parameters while adding width and quality", () => {
    expect(
      supabaseImageLoader({
        src: "https://fflsucsqhjjuozmfwpho.supabase.co/storage/v1/object/public/images/posts/photo.jpg?v=2",
        width: 828,
      }),
    ).toBe(
      "https://fflsucsqhjjuozmfwpho.supabase.co/storage/v1/render/image/public/images/posts/photo.jpg?v=2&width=828&quality=75",
    );
  });

  it("leaves local and non-Supabase URLs unchanged", () => {
    expect(
      supabaseImageLoader({
        src: "/home-img.png",
        width: 1080,
        quality: 80,
      }),
    ).toBe("/home-img.png");
    expect(
      supabaseImageLoader({
        src: "https://i.ytimg.com/vi/example/maxresdefault.jpg",
        width: 1080,
        quality: 80,
      }),
    ).toBe("https://i.ytimg.com/vi/example/maxresdefault.jpg");
  });

  it("uses the custom loader instead of globally disabling image optimization", () => {
    expect(nextConfig.images?.loader).toBe("custom");
    expect(nextConfig.images?.loaderFile).toBe("./supabase-image-loader.js");
    expect(nextConfig.images?.unoptimized).not.toBe(true);
  });
});
