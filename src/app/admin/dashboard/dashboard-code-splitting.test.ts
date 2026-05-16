import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardDir = join(process.cwd(), "src/app/admin/dashboard");

describe("admin dashboard code splitting", () => {
  it("keeps the route page as a server shell around a dynamic dashboard loader", () => {
    const pageSource = readFileSync(join(dashboardDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(dashboardDir, "dashboard-panel-loader.tsx"),
      "utf8",
    );
    const panelSource = readFileSync(
      join(dashboardDir, "components/dashboard-panel.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("DashboardPanelLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("dynamic(");
    expect(pageSource).not.toContain("@/components/admin/permission-gate");
    expect(loaderSource).toContain("const DynamicDashboardPanel = dynamic");
    expect(loaderSource).toContain("./components/dashboard-panel");
    expect(panelSource).toContain("PermissionGate");
    expect(panelSource).toContain('feature="dashboard"');
  });

  it("keeps dashboard board dependencies behind a dynamic panel", () => {
    const pageSource = readFileSync(join(dashboardDir, "page.tsx"), "utf8");

    expect(pageSource).not.toContain("@dnd-kit/core");
    expect(pageSource).not.toContain("@/components/shared/availability-calendar");
    expect(pageSource).not.toContain("./components/DashboardStickyNotes");
    expect(pageSource).not.toContain("./components/dashboard-table");
  });

  it("uses a compact dashboard summary API instead of global reservation data", () => {
    const panelSource = readFileSync(
      join(dashboardDir, "components/dashboard-panel.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("useDashboardSummary");
    expect(panelSource).not.toContain("bookings,");
    expect(panelSource).not.toContain("rooms,");
    expect(panelSource).not.toContain("buildDashboardSummary");
    expect(panelSource).not.toContain("getTodayRange");
  });

  it("loads sticky notes from the widget instead of dashboard startup data", () => {
    const notesSource = readFileSync(
      join(dashboardDir, "components/DashboardStickyNotes.tsx"),
      "utf8",
    );

    expect(notesSource).toContain("refetchStickyNotes");
    expect(notesSource).toContain("void refetchStickyNotes()");
  });
});
