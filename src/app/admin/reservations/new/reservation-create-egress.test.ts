import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const formPath = join(
  process.cwd(),
  "src/app/admin/reservations/new/create-reservation-form.tsx",
);

describe("admin reservation creation egress", () => {
  it("uses route-backed date conflicts instead of scanning global reservations", () => {
    const pageSource = readFileSync(formPath, "utf8");

    expect(pageSource).toContain("useAdminRoomConflicts");
    expect(pageSource).not.toContain("reservations,");
    expect(pageSource).not.toContain("reservations.some");
    expect(pageSource).not.toContain("areIntervalsOverlapping");
    expect(pageSource).not.toContain("parseISO");
  });

  it("uses route-backed guest search instead of hydrating every guest", () => {
    const pageSource = readFileSync(formPath, "utf8");

    expect(pageSource).toContain("useGuestsPage");
    expect(pageSource).toContain("useGuestProfile");
    expect(pageSource).not.toContain("const {\n    guests,");
    expect(pageSource).not.toContain("guests.map");
  });

  it("uses route-backed form reference data instead of startup room and rate hydration", () => {
    const pageSource = readFileSync(formPath, "utf8");

    expect(pageSource).toContain("useAdminReservationFormData");
    expect(pageSource).not.toContain("seasonalPrices,\n    addReservation,");
    expect(pageSource).not.toContain(
      "const {\n    rooms,\n    roomTypes,\n    ratePlans,\n    seasonalPrices,\n    addReservation,",
    );
  });
});
