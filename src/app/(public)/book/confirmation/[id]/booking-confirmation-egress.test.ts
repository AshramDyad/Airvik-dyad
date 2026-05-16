import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const confirmationDir = join(
  process.cwd(),
  "src/app/(public)/book/confirmation/[id]",
);
const pagePath = join(confirmationDir, "page.tsx");
const clientPath = join(confirmationDir, "booking-confirmation-client.tsx");
const loaderPath = join(
  confirmationDir,
  "booking-confirmation-client-loader.tsx",
);

describe("booking confirmation egress", () => {
  it("keeps the route page as a server shell around the confirmation workflow", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("BookingConfirmationClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("useParams");
    expect(pageSource).not.toContain("date-fns");
    expect(pageSource).not.toContain("lucide-react");
    expect(pageSource).not.toContain("@/context/data-context");
    expect(loaderSource).toContain(
      "const DynamicBookingConfirmationClient = dynamic",
    );
    expect(loaderSource).toContain("./booking-confirmation-client");
  });

  it("loads one route-backed confirmation payload instead of browser Supabase helpers", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain('fetch(`/api/bookings/confirmation/');
    expect(pageSource).not.toContain("@/lib/api");
    expect(pageSource).not.toContain("getReservationById");
    expect(pageSource).not.toContain("getReservationsByBookingId");
    expect(pageSource).not.toContain("getGuestById");
    expect(pageSource).not.toContain("resolveBookingReservations");
    expect(pageSource).not.toContain("reservations, guests, rooms, roomTypes");
  });
});
