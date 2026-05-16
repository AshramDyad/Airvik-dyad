import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const blogDir = join(process.cwd(), "src/app/(public)/blog");

describe("blog page code splitting", () => {
  it("keeps static blog navigation free of the client Link runtime", () => {
    const listSource = readFileSync(join(blogDir, "page.tsx"), "utf8");
    const detailSource = readFileSync(join(blogDir, "[slug]/page.tsx"), "utf8");

    expect(listSource).not.toContain("next/link");
    expect(listSource).not.toContain("<Link");
    expect(listSource).toContain('href={`/blog/${post.slug}`}');
    expect(detailSource).not.toContain("next/link");
    expect(detailSource).not.toContain("<Link");
    expect(detailSource).toContain('href="/blog"');
  });

  it("sizes responsive blog images for transformed Supabase image variants", () => {
    const listSource = readFileSync(join(blogDir, "page.tsx"), "utf8");
    const detailSource = readFileSync(join(blogDir, "[slug]/page.tsx"), "utf8");

    expect(listSource).toContain("fill");
    expect(listSource).toContain('sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"');
    expect(detailSource).toContain("fill");
    expect(detailSource).toContain('sizes="(max-width: 896px) 100vw, 896px"');
  });
});
