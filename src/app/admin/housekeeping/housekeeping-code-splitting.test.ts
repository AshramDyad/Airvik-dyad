import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const housekeepingDir = join(process.cwd(), "src/app/admin/housekeeping");

describe("admin housekeeping code splitting", () => {
  it("keeps the route page as a server shell around a dynamic housekeeping loader", () => {
    const pageSource = readFileSync(join(housekeepingDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(housekeepingDir, "housekeeping-panel-loader.tsx"),
      "utf8",
    );
    const panelSource = readFileSync(
      join(housekeepingDir, "housekeeping-panel.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("HousekeepingPanelLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("dynamic(");
    expect(pageSource).not.toContain("@/components/admin/permission-gate");
    expect(loaderSource).toContain("const DynamicHousekeepingPanel = dynamic");
    expect(loaderSource).toContain("./housekeeping-panel");
    expect(panelSource).toContain("PermissionGate");
    expect(panelSource).toContain('feature="housekeeping"');
  });

  it("keeps the housekeeping workflow behind a dynamic import", () => {
    const pageSource = readFileSync(join(housekeepingDir, "page.tsx"), "utf8");

    expect(pageSource).not.toContain(
      'import { HousekeepingToolbar } from "./components/housekeeping-toolbar"',
    );
    expect(pageSource).not.toContain(
      'import { RoomStatusCard } from "./components/room-status-card"',
    );
    expect(pageSource).not.toContain("@/context/data-context");
    expect(pageSource).not.toContain('from "sonner"');
  });

  it("lets housekeeping hydrate through a route-backed API instead of global app data", () => {
    const panelSource = readFileSync(
      join(housekeepingDir, "housekeeping-panel.tsx"),
      "utf8",
    );
    const assignDialogSource = readFileSync(
      join(housekeepingDir, "components/assign-housekeeper-dialog.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("/api/admin/housekeeping");
    expect(panelSource).not.toContain("rooms: allRooms");
    expect(panelSource).not.toContain("roomTypes,\n    users");
    expect(panelSource).not.toContain("housekeepingAssignments,");
    expect(assignDialogSource).not.toContain("users: housekeepers");
  });
});
