import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reservationsDir = join(process.cwd(), "src/app/admin/reservations");

describe("admin reservations index egress", () => {
  it("loads invoice lookup rows on demand instead of using global room lookups", () => {
    const columnsSource = readFileSync(
      join(reservationsDir, "components/columns.tsx"),
      "utf8",
    );

    expect(columnsSource).toContain("authorizedFetch");
    expect(columnsSource).toContain("fetchBookingInvoiceData");
    expect(columnsSource).toContain("/api/admin/reservations/");
    expect(columnsSource).not.toContain(
      "guests, property, rooms, roomTypes",
    );
    expect(columnsSource).not.toContain(
      "buildReservationInvoiceData(\n        row.original,\n        guests,",
    );
  });
});
