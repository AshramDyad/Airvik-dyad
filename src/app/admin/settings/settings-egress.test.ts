import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsDir = join(process.cwd(), "src/app/admin/settings");

describe("admin settings egress", () => {
  it("loads CSV import room options through a narrow route instead of global rooms", () => {
    const csvImportSource = readFileSync(
      join(settingsDir, "components/data-tools/csv-import-panel.tsx"),
      "utf8",
    );

    expect(csvImportSource).toContain("/api/admin/rooms/options");
    expect(csvImportSource).not.toContain("rooms = []");
    expect(csvImportSource).not.toContain("useDataContext");
  });

  it("hydrates amenities from the tab instead of settings startup data", () => {
    const amenitiesSource = readFileSync(
      join(settingsDir, "components/amenities-management.tsx"),
      "utf8",
    );

    expect(amenitiesSource).toContain("refetchAmenities");
    expect(amenitiesSource).toContain("void refetchAmenities()");
  });

  it("hydrates roles and users from their tabs instead of settings startup data", () => {
    const rolesSource = readFileSync(
      join(settingsDir, "components/roles-permissions.tsx"),
      "utf8",
    );
    const usersSource = readFileSync(
      join(settingsDir, "components/users-management.tsx"),
      "utf8",
    );

    expect(rolesSource).toContain("refetchRoles");
    expect(rolesSource).toContain("void refetchRoles()");
    expect(usersSource).toContain("refetchRoles");
    expect(usersSource).toContain("refetchUsers");
  });

  it("loads property closures through a narrow settings route", () => {
    const closuresSource = readFileSync(
      join(settingsDir, "components/property-closures-section.tsx"),
      "utf8",
    );

    expect(closuresSource).toContain("/api/admin/settings/property-closures");
    expect(closuresSource).not.toContain("propertyClosures, roomTypes");
  });
});
