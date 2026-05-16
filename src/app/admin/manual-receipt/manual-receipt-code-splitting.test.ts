import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const historyPagePath = join(
  process.cwd(),
  "src/app/admin/manual-receipt/page.tsx",
);

const newPagePath = join(
  process.cwd(),
  "src/app/admin/manual-receipt/new/page.tsx",
);

describe("manual receipt code splitting", () => {
  it("keeps the receipt history workflow behind a dynamic import", () => {
    const pageSource = readFileSync(historyPagePath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("./manual-receipt-history");
    expect(pageSource).not.toContain('from "react-hook-form"');
    expect(pageSource).not.toContain('from "@hookform/resolvers/zod"');
    expect(pageSource).not.toContain('from "zod"');
    expect(pageSource).not.toContain("@/components/ui/table");
    expect(pageSource).not.toContain("@/components/ui/dialog");
    expect(pageSource).not.toContain("@/lib/auth/client-session");
    expect(pageSource).not.toContain("generate-manual-donation-receipt");
  });

  it("keeps the new receipt form behind a dynamic import", () => {
    const pageSource = readFileSync(newPagePath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("./new-manual-receipt-form");
    expect(pageSource).not.toContain('from "react-hook-form"');
    expect(pageSource).not.toContain('from "@hookform/resolvers/zod"');
    expect(pageSource).not.toContain('from "zod"');
    expect(pageSource).not.toContain("@/components/ui/form");
    expect(pageSource).not.toContain("@/components/ui/radio-group");
    expect(pageSource).not.toContain("@/lib/auth/client-session");
    expect(pageSource).not.toContain("generate-manual-donation-receipt");
  });
});
