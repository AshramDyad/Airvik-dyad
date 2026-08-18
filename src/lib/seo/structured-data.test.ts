import { describe, expect, it } from "vitest";
import { blogPostingSchema } from "@/lib/seo/structured-data";

describe("blog structured data", () => {
  it("emits an absolute article URL and publication dates", () => {
    const schema = blogPostingSchema({
      title: "Rishikesh guide",
      url: "/blog/rishikesh-guide",
      datePublished: "2026-08-18T00:00:00.000Z",
      dateModified: "2026-08-19T00:00:00.000Z",
      section: "Ashram Stays",
      keywords: ["rishikesh ashram stay"],
    });

    expect(schema.mainEntityOfPage).toContain("/blog/rishikesh-guide");
    expect(schema.datePublished).toBe("2026-08-18T00:00:00.000Z");
    expect(schema.dateModified).toBe("2026-08-19T00:00:00.000Z");
    expect(schema.articleSection).toBe("Ashram Stays");
  });
});
