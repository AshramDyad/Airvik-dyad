import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const calendarDir = join(process.cwd(), "src/app/admin/calendar");

describe("admin calendar code splitting", () => {
  it("keeps the route page as a server shell around a dynamic calendar loader", () => {
    const pageSource = readFileSync(join(calendarDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(calendarDir, "calendar-panel-loader.tsx"),
      "utf8",
    );
    const panelSource = readFileSync(join(calendarDir, "calendar-panel.tsx"), "utf8");

    expect(pageSource).toContain("CalendarPanelLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("dynamic(");
    expect(pageSource).not.toContain("@/components/admin/permission-gate");
    expect(loaderSource).toContain("const DynamicCalendarPanel = dynamic");
    expect(loaderSource).toContain("./calendar-panel");
    expect(panelSource).toContain("PermissionGate");
    expect(panelSource).toContain('feature="calendar"');
  });

  it("defers the availability calendar out of the initial route chunk", () => {
    const pageSource = readFileSync(join(calendarDir, "calendar-panel.tsx"), "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("@/components/shared/availability-calendar");
    expect(pageSource).not.toContain(
      'import { AvailabilityCalendar } from "@/components/shared/availability-calendar"',
    );
  });

  it("uses bounded hover details instead of the global reservations context", () => {
    const availabilitySource = readFileSync(
      join(process.cwd(), "src/components/shared/availability-calendar.tsx"),
      "utf8",
    );
    const roomTypeRowSource = readFileSync(
      join(process.cwd(), "src/components/shared/room-type-row.tsx"),
      "utf8",
    );
    const hoverCardSource = readFileSync(
      join(process.cwd(), "src/components/shared/reservation-hover-card.tsx"),
      "utf8",
    );

    expect(availabilitySource).toContain("useCalendarReservationDetails");
    expect(roomTypeRowSource).toContain("reservationDetailsById");
    expect(roomTypeRowSource).not.toContain("@/context/data-context");
    expect(hoverCardSource).toContain("reservationDetailsById");
    expect(hoverCardSource).not.toContain("@/context/data-context");
  });
});
