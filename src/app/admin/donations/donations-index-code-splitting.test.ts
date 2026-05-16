import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const donationsDir = join(process.cwd(), "src/app/admin/donations");

describe("admin donations index code splitting", () => {
  it("keeps donation filters and table behind a dynamic client panel", () => {
    const pageSource = readFileSync(join(donationsDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(donationsDir, "donations-index-loader.tsx"),
      "utf8",
    );
    const panelSource = readFileSync(
      join(donationsDir, "donations-index-panel.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("DonationsIndexLoader");
    expect(pageSource).toContain("DonationStatsGrid");
    expect(pageSource).not.toContain(
      "@/components/admin/donations/donation-filters",
    );
    expect(pageSource).not.toContain(
      "@/components/admin/donations/donations-table",
    );
    expect(loaderSource).toContain("const DynamicDonationsIndexPanel = dynamic");
    expect(loaderSource).toContain("./donations-index-panel");
    expect(panelSource).toContain("DonationFilters");
    expect(panelSource).toContain("DonationsTable");
  });
});
