import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/(public)/feedback/page.tsx");
const loaderPath = join(
  process.cwd(),
  "src/components/feedback/feedback-form-loader.tsx",
);
const formPath = join(process.cwd(), "src/components/feedback/feedback-form.tsx");

describe("public feedback code splitting", () => {
  it("loads the feedback form through a dynamic client loader", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("FeedbackFormLoader");
    expect(pageSource).not.toContain(
      'import { FeedbackForm } from "@/components/feedback/feedback-form"',
    );
    expect(pageSource).not.toContain("react-hook-form");
    expect(pageSource).not.toContain("zod");
    expect(loaderSource).toContain("const DynamicFeedbackForm = dynamic");
    expect(loaderSource).toContain("@/components/feedback/feedback-form");
  });

  it("posts feedback submissions without caching responses", () => {
    const formSource = readFileSync(formPath, "utf8");

    expect(formSource).toContain('fetch("/api/feedback", {');
    expect(formSource).toContain('cache: "no-store"');
  });
});
