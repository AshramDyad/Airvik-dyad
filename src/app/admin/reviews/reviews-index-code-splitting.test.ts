import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/admin/reviews/page.tsx");
const loaderPath = join(
  process.cwd(),
  "src/components/admin/reviews/reviews-table-loader.tsx",
);

describe("admin reviews index code splitting", () => {
  it("keeps the reviews table behind a dynamic client loader", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("ReviewsTableLoader");
    expect(pageSource).not.toContain(
      'import { ReviewsTable } from "@/components/admin/reviews/reviews-table"',
    );
    expect(pageSource).not.toContain("next/link");
    expect(pageSource).toContain('href="/admin/reviews/create"');
    expect(loaderSource).toContain("const DynamicReviewsTable = dynamic");
    expect(loaderSource).toContain("@/components/admin/reviews/reviews-table");
  });
});
