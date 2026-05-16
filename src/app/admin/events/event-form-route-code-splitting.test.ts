import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const eventsDir = join(process.cwd(), "src/app/admin/events");
const loaderPath = join(
  process.cwd(),
  "src/components/admin/events/event-form-loader.tsx",
);

describe("admin event form route code splitting", () => {
  it("loads the event form through a dynamic client loader", () => {
    const createSource = readFileSync(join(eventsDir, "create/page.tsx"), "utf8");
    const editSource = readFileSync(join(eventsDir, "[id]/page.tsx"), "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(createSource).toContain("EventFormLoader");
    expect(editSource).toContain("EventFormLoader");
    expect(createSource).not.toContain(
      'import { EventForm } from "@/components/admin/events/event-form"',
    );
    expect(editSource).not.toContain(
      'import { EventForm } from "@/components/admin/events/event-form"',
    );
    expect(loaderSource).toContain("const DynamicEventForm = dynamic");
    expect(loaderSource).toContain("@/components/admin/events/event-form");
    expect(loaderSource).not.toContain("@/components/ui/card");
    expect(loaderSource).not.toContain("<Card");
  });
});
