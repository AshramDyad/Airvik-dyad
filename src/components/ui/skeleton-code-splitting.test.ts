import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("skeleton code splitting", () => {
  it("does not pull class merging utilities into lightweight loading fallbacks", () => {
    const skeletonSource = readFileSync(
      join(process.cwd(), "src/components/ui/skeleton.tsx"),
      "utf8",
    );

    expect(skeletonSource).not.toContain("@/lib/utils");
    expect(skeletonSource).not.toContain("cn(");
    expect(skeletonSource).toContain("animate-pulse");
    expect(skeletonSource).toContain("className");
  });
});
