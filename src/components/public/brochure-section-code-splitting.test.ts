import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sectionPath = join(
  process.cwd(),
  "src/components/public/brochure-section.tsx",
);

describe("brochure section code splitting", () => {
  it("defers the PDF viewer dialog until the viewer is opened", () => {
    const sectionSource = readFileSync(sectionPath, "utf8");

    expect(sectionSource).toContain("dynamic(");
    expect(sectionSource).not.toContain("@/components/ui/dialog");
    expect(sectionSource).toContain("viewerOpen &&");
  });
});
