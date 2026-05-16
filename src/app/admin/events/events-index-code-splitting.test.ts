import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const eventsDir = join(process.cwd(), "src/app/admin/events");
const componentsDir = join(process.cwd(), "src/components/admin/events");

describe("admin events index code splitting", () => {
  it("keeps the events table behind a dynamic client loader", () => {
    const pageSource = readFileSync(join(eventsDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(componentsDir, "events-table-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("EventsTableLoader");
    expect(pageSource).not.toContain(
      'import { EventsTable } from "@/components/admin/events/events-table"',
    );
    expect(pageSource).not.toContain("next/link");
    expect(pageSource).toContain('href="/admin/events/create"');
    expect(loaderSource).toContain("const DynamicEventsTable = dynamic");
    expect(loaderSource).toContain("./events-table");
  });
});
