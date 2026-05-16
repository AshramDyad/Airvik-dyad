import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/admin/feedback/page.tsx");

describe("admin feedback code splitting", () => {
  it("keeps the feedback workflow behind a dynamic import", () => {
    const pageSource = readFileSync(pagePath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("./feedback-panel");
    expect(pageSource).not.toContain("@/components/ui/table");
    expect(pageSource).not.toContain("@/components/ui/dialog");
    expect(pageSource).not.toContain("@/components/ui/calendar");
    expect(pageSource).not.toContain("@/components/ui/popover");
    expect(pageSource).not.toContain("@/lib/auth/client-session");
    expect(pageSource).not.toContain("@/hooks/use-feedback-query-params");
  });
});
