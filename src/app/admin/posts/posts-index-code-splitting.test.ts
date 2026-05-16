import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const postsDir = join(process.cwd(), "src/app/admin/posts");

describe("admin posts index code splitting", () => {
  it("keeps the posts table and filters behind a dynamic client loader", () => {
    const pageSource = readFileSync(join(postsDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(postsDir, "posts-index-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("PostsIndexLoader");
    expect(pageSource).not.toContain(
      'import { PostsTable } from "@/components/admin/posts/posts-table"',
    );
    expect(pageSource).not.toContain(
      'import { PostsFilters } from "@/components/admin/posts/posts-filters"',
    );
    expect(pageSource).not.toContain("next/link");
    expect(pageSource).toContain('href="/admin/posts/create"');
    expect(loaderSource).toContain("const DynamicPostsIndexPanel = dynamic");
    expect(loaderSource).toContain("./posts-index-panel");
  });
});
