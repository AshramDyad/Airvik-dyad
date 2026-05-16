import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(
  process.cwd(),
  "src/app/admin/reservations/new/page.tsx",
);

describe("admin reservation creation code splitting", () => {
  it("keeps the create workflow behind a dynamic import", () => {
    const pageSource = readFileSync(pagePath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("./create-reservation-form");
    expect(pageSource).not.toContain('from "react-hook-form"');
    expect(pageSource).not.toContain('from "@hookform/resolvers/zod"');
    expect(pageSource).not.toContain('from "zod"');
    expect(pageSource).not.toContain("@/components/ui/command");
    expect(pageSource).not.toContain("@/components/ui/popover");
    expect(pageSource).not.toContain("@/lib/pricing-calculator");
    expect(pageSource).not.toContain("@/hooks/use-admin-room-conflicts");
  });
});
