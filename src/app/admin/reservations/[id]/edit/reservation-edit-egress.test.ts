import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clientPath = join(
  process.cwd(),
  "src/app/admin/reservations/[id]/edit/reservation-edit-client.tsx",
);
const formPath = join(
  process.cwd(),
  "src/app/admin/reservations/components/reservation-edit-form.tsx",
);

describe("admin reservation edit egress", () => {
  it("uses booking lookup room rows for edit header details", () => {
    const clientSource = readFileSync(clientPath, "utf8");

    expect(clientSource).toContain("activeBookingRooms");
    expect(clientSource).not.toContain("rooms,\n    isLoading,");
  });

  it("uses route-backed form reference data instead of startup room and rate hydration", () => {
    const formSource = readFileSync(formPath, "utf8");

    expect(formSource).toContain("useAdminReservationFormData");
    expect(formSource).not.toContain("rooms,\n    roomTypes,\n    guests,\n    ratePlans,\n    seasonalPrices,");
  });
});
