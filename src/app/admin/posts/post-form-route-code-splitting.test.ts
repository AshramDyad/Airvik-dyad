import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const postsDir = join(process.cwd(), "src/app/admin/posts");
const loaderPath = join(process.cwd(), "src/components/admin/posts/post-form-loader.tsx");

describe("admin post form route code splitting", () => {
  it("loads the heavy post form through a dynamic client loader", () => {
    const createSource = readFileSync(join(postsDir, "create/page.tsx"), "utf8");
    const editSource = readFileSync(join(postsDir, "[id]/page.tsx"), "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(createSource).toContain("PostFormLoader");
    expect(editSource).toContain("PostFormLoader");
    expect(createSource).not.toContain(
      'import { PostForm } from "@/components/admin/posts/post-form"',
    );
    expect(editSource).not.toContain(
      'import { PostForm } from "@/components/admin/posts/post-form"',
    );
    expect(loaderSource).toContain("const DynamicPostForm = dynamic");
    expect(loaderSource).toContain("@/components/admin/posts/post-form");
  });
});
