import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsDir = join(process.cwd(), "src/app/admin/settings");

describe("admin settings code splitting", () => {
  it("keeps the route page as a server shell around the client settings workflow", () => {
    const pageSource = readFileSync(join(settingsDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(settingsDir, "settings-client-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("SettingsClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("@/components/admin/permission-gate");
    expect(pageSource).not.toContain("./settings-tabs");
    expect(loaderSource).toContain("const DynamicSettingsClient = dynamic");
    expect(loaderSource).toContain("./settings-client");
  });

  it("keeps tab panels behind dynamic imports", () => {
    const pageSource = readFileSync(join(settingsDir, "settings-client.tsx"), "utf8");
    const tabsSource = readFileSync(join(settingsDir, "settings-tabs.tsx"), "utf8");

    expect(pageSource).not.toContain("./components/roles-permissions");
    expect(pageSource).not.toContain("./components/users-management");
    expect(pageSource).not.toContain("./components/property-settings-form");
    expect(pageSource).not.toContain("./components/amenities-management");
    expect(pageSource).not.toContain("./components/data-tools/csv-import-panel");
    expect(pageSource).not.toContain("./components/property-closures-section");
    expect(tabsSource).toContain("dynamic(");
    expect(tabsSource).toContain("./components/roles-permissions");
    expect(tabsSource).toContain("./components/users-management");
    expect(tabsSource).toContain("./components/property-settings-form");
    expect(tabsSource).toContain("./components/amenities-management");
    expect(tabsSource).toContain("./components/data-tools/csv-import-panel");
    expect(tabsSource).toContain("./components/property-closures-section");
  });
});
