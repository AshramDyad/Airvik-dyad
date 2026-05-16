import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/events");

describe("events page code splitting", () => {
  it("keeps the events route and cards server-rendered", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const eventCardSource = readFileSync(
      join(process.cwd(), "src/components/marketing/events/EventCard.tsx"),
      "utf8",
    );

    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).toContain("Promise.all");
    expect(pageSource).toContain("getUpcomingEvents");
    expect(pageSource).toContain("EventCard");
    expect(eventCardSource).not.toContain('"use client"');
    expect(eventCardSource).not.toContain("useState");
    expect(eventCardSource).not.toContain("useEffect");
  });

  it("sizes responsive event images so Supabase-hosted image payloads stay bounded", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const eventCardSource = readFileSync(
      join(process.cwd(), "src/components/marketing/events/EventCard.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("fill");
    expect(pageSource).toContain('sizes="(max-width: 1024px) 100vw, 50vw"');
    expect(eventCardSource).toContain('sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"');
  });
});
