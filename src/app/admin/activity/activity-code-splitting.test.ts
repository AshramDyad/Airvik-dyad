import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const activityDir = join(process.cwd(), "src/app/admin/activity");

describe("admin activity code splitting", () => {
  it("keeps the activity log workflow behind a dynamic client loader", () => {
    const pageSource = readFileSync(join(activityDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(activityDir, "activity-panel-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("ActivityPanelLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("@/hooks/use-admin-activity-logs");
    expect(pageSource).not.toContain("@/components/ui/table");
    expect(pageSource).not.toContain("@/components/ui/pagination");
    expect(loaderSource).toContain("const DynamicActivityPanel = dynamic");
    expect(loaderSource).toContain("./activity-panel");
    expect(loaderSource).not.toContain("@/components/ui/card");
    expect(loaderSource).not.toContain("<Card");
  });
});
