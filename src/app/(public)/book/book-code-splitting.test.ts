import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/(public)/book/page.tsx");
const clientPath = join(process.cwd(), "src/app/(public)/book/booking-client.tsx");
const loaderPath = join(
  process.cwd(),
  "src/app/(public)/book/booking-client-loader.tsx",
);
const summaryPath = join(
  process.cwd(),
  "src/components/public/booking-summary.tsx",
);
const availabilityHookPath = join(
  process.cwd(),
  "src/hooks/use-availability-search.tsx",
);

describe("booking page code splitting", () => {
  it("keeps the route page as a server shell around the client booking workflow", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("BookingClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("@/components/public/booking-widget");
    expect(pageSource).not.toContain("@/hooks/use-availability-search");
    expect(pageSource).not.toContain("@/context/data-context");
    expect(loaderSource).toContain("const DynamicBookingClient = dynamic");
    expect(loaderSource).toContain("./booking-client");
  });

  it("keeps below-the-fold and post-selection UI behind dynamic imports", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).not.toContain(
      'import { RoomTypeCard } from "@/components/public/room-type-card"',
    );
    expect(pageSource).not.toContain(
      'import { BookingSummary } from "@/components/public/booking-summary"',
    );
  });

  it("loads booking search lookup data through compact route-backed hooks", () => {
    const clientSource = readFileSync(clientPath, "utf8");
    const summarySource = readFileSync(summaryPath, "utf8");
    const availabilityHookSource = readFileSync(availabilityHookPath, "utf8");

    expect(clientSource).toContain("useBookingSearchData");
    expect(clientSource).toContain("amenities={bookingSearchData?.amenities");
    expect(clientSource).toContain("ratePlan={bookingSearchData?.ratePlan ?? null}");
    expect(clientSource).toContain("seasonalPrices={seasonalPrices}");
    expect(clientSource).not.toContain("roomTypes,\n    seasonalPrices");
    expect(summarySource).not.toContain("ratePlans, seasonalPrices");
    expect(availabilityHookSource).not.toContain("@/context/data-context");
    expect(availabilityHookSource).toContain("seasonalPrices");
  });
});
