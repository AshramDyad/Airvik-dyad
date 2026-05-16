import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(
  process.cwd(),
  "src/app/admin/posts/categories/page.tsx",
);
const loaderPath = join(
  process.cwd(),
  "src/components/admin/posts/categories-manager-loader.tsx",
);

describe("admin post categories route code splitting", () => {
  it("loads the categories manager through a dynamic client loader", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("CategoriesManagerLoader");
    expect(pageSource).not.toContain(
      'import { CategoriesManager } from "@/components/admin/posts/categories-manager"',
    );
    expect(loaderSource).toContain("const DynamicCategoriesManager = dynamic");
    expect(loaderSource).toContain(
      "@/components/admin/posts/categories-manager",
    );
  });
});
