import { describe, expect, it } from "vitest";
import { getPostSeoValues } from "@/lib/seo/metadata";

describe("post SEO fallbacks", () => {
  it("uses stored values when an older post has no SEO fields", () => {
    expect(getPostSeoValues({ title: "Older guide", excerpt: "Existing summary" })).toEqual({
      title: "Older guide",
      description: "Existing summary",
    });
  });

  it("prefers the stored SEO title and description", () => {
    expect(
      getPostSeoValues({
        title: "Post title",
        excerpt: "Post excerpt",
        seo_title: "Search title",
        meta_description: "Search description",
      }),
    ).toEqual({ title: "Search title", description: "Search description" });
  });
});
