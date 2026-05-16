import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const postsComponentsDir = join(process.cwd(), "src/components/admin/posts");

describe("admin blog mutation egress", () => {
  it("updates categories through the no-return mutation helper", () => {
    const source = readFileSync(
      join(postsComponentsDir, "categories-manager.tsx"),
      "utf8",
    );

    expect(source).toContain("updateCategoryWithoutReturning");
    expect(source).not.toContain("await updateCategory(");
  });

  it("creates categories through the id-only mutation helper", () => {
    const source = readFileSync(
      join(postsComponentsDir, "categories-manager.tsx"),
      "utf8",
    );

    expect(source).toContain("createCategoryIdOnly");
    expect(source).not.toContain("await createCategory(");
  });

  it("updates posts through the no-return mutation helper", () => {
    const source = readFileSync(join(postsComponentsDir, "post-form.tsx"), "utf8");

    expect(source).toContain("updatePostWithoutReturning");
    expect(source).not.toContain("await updatePost(");
  });

  it("creates posts through the id-only no-return mutation helper", () => {
    const source = readFileSync(join(postsComponentsDir, "post-form.tsx"), "utf8");

    expect(source).toContain("createPostWithoutReturning");
    expect(source).not.toContain("await createPost(");
  });
});
