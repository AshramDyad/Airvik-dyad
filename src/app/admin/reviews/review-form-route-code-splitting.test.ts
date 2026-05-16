import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reviewsDir = join(process.cwd(), "src/app/admin/reviews");
const loaderPath = join(
  process.cwd(),
  "src/components/admin/reviews/review-form-loader.tsx",
);

describe("admin review form route code splitting", () => {
  it("loads the review form through a dynamic client loader", () => {
    const createSource = readFileSync(join(reviewsDir, "create/page.tsx"), "utf8");
    const editSource = readFileSync(join(reviewsDir, "[id]/page.tsx"), "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(createSource).toContain("ReviewFormLoader");
    expect(editSource).toContain("ReviewFormLoader");
    expect(createSource).not.toContain(
      'import { ReviewForm } from "@/components/admin/reviews/review-form"',
    );
    expect(editSource).not.toContain(
      'import { ReviewForm } from "@/components/admin/reviews/review-form"',
    );
    expect(loaderSource).toContain("const DynamicReviewForm = dynamic");
    expect(loaderSource).toContain("@/components/admin/reviews/review-form");
    expect(loaderSource).not.toContain("@/components/ui/card");
    expect(loaderSource).not.toContain("<Card");
  });
});
