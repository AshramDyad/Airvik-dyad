import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reportsDir = join(process.cwd(), "src/app/admin/reports");

describe("admin reports code splitting", () => {
  it("keeps the route page as a server shell around a dynamic reports loader", () => {
    const pageSource = readFileSync(join(reportsDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(reportsDir, "reports-panel-loader.tsx"),
      "utf8",
    );
    const panelSource = readFileSync(join(reportsDir, "reports-panel.tsx"), "utf8");

    expect(pageSource).toContain("ReportsPanelLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("dynamic(");
    expect(pageSource).not.toContain("@/components/admin/permission-gate");
    expect(loaderSource).toContain("const DynamicReportsPanel = dynamic");
    expect(loaderSource).toContain("./reports-panel");
    expect(panelSource).toContain("PermissionGate");
    expect(panelSource).toContain('feature="reports"');
  });

  it("keeps chart-heavy reports behind dynamic imports", () => {
    const pageSource = readFileSync(join(reportsDir, "page.tsx"), "utf8");
    const tabsSource = readFileSync(join(reportsDir, "reports-tabs.tsx"), "utf8");

    expect(pageSource).not.toContain('import { ReportsTabs } from "./reports-tabs"');
    expect(pageSource).not.toContain("./components/occupancy-report");
    expect(pageSource).not.toContain("./components/revenue-report");
    expect(tabsSource).toContain("dynamic(");
    expect(tabsSource).toContain("./components/occupancy-report");
    expect(tabsSource).toContain("./components/revenue-report");
  });

  it("uses the report API room count instead of global room rows for occupancy", () => {
    const occupancySource = readFileSync(
      join(reportsDir, "components/occupancy-report.tsx"),
      "utf8",
    );

    expect(occupancySource).toContain("roomsForSaleCount");
    expect(occupancySource).not.toContain("useDataContext");
    expect(occupancySource).not.toContain("rooms.length");
  });
});
