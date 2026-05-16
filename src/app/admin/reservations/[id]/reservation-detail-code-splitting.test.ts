import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/admin/reservations/[id]/page.tsx");
const loaderPath = join(
  process.cwd(),
  "src/app/admin/reservations/[id]/reservation-details-client-loader.tsx",
);
const clientPath = join(
  process.cwd(),
  "src/app/admin/reservations/[id]/reservation-details-client.tsx",
);
const detailDir = join(process.cwd(), "src/app/admin/reservations/[id]");

describe("admin reservation detail code splitting", () => {
  it("keeps the route page as a server shell around the client detail workflow", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("ReservationDetailsClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("@/context/data-context");
    expect(pageSource).not.toContain("useParams");
    expect(loaderSource).toContain("const DynamicReservationDetailsClient = dynamic");
    expect(loaderSource).toContain("./reservation-details-client");
  });

  it("defers the detail presentation panels out of the initial detail page chunk", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("./components/ReservationHeader");
    expect(pageSource).toContain("./components/GuestDetailsCard");
    expect(pageSource).toContain("./components/StayDetailsCard");
    expect(pageSource).toContain("./components/LinkedReservationsCard");
    expect(pageSource).toContain("./components/BillingCard");
    expect(pageSource).toContain("./components/ReservationActivityTimeline");
    expect(pageSource).not.toContain('import { ReservationHeader } from "./components/ReservationHeader"');
    expect(pageSource).not.toContain('import { GuestDetailsCard } from "./components/GuestDetailsCard"');
    expect(pageSource).not.toContain('import { StayDetailsCard } from "./components/StayDetailsCard"');
    expect(pageSource).not.toContain(
      'import { LinkedReservationsCard } from "./components/LinkedReservationsCard"',
    );
    expect(pageSource).not.toContain('import { BillingCard } from "./components/BillingCard"');
    expect(pageSource).not.toContain(
      'import { ReservationActivityTimeline } from "./components/ReservationActivityTimeline"',
    );
  });

  it("uses route-backed lookup rows for the selected booking instead of global lookup datasets", () => {
    const clientSource = readFileSync(clientPath, "utf8");
    const stayDetailsSource = readFileSync(
      join(detailDir, "components/StayDetailsCard.tsx"),
      "utf8",
    );
    const linkedReservationsSource = readFileSync(
      join(detailDir, "components/LinkedReservationsCard.tsx"),
      "utf8",
    );
    const headerSource = readFileSync(
      join(detailDir, "components/ReservationHeader.tsx"),
      "utf8",
    );

    expect(clientSource).toContain("activeBookingRooms");
    expect(clientSource).toContain("activeBookingRoomTypes");
    expect(clientSource).toContain("activeBookingRatePlans");
    expect(clientSource).not.toContain("rooms,\n    property");
    expect(stayDetailsSource).not.toContain("ratePlans } = useDataContext");
    expect(linkedReservationsSource).not.toContain("rooms, roomTypes");
    expect(headerSource).toContain("bookingReservations");
    expect(headerSource).toContain("bookingRooms");
    expect(headerSource).toContain("bookingRoomTypes");
  });
});
