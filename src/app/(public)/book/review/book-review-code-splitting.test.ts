import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reviewDir = join(process.cwd(), "src/app/(public)/book/review");
const pagePath = join(reviewDir, "page.tsx");
const clientPath = join(reviewDir, "booking-review-client.tsx");
const loaderPath = join(reviewDir, "booking-review-client-loader.tsx");
const skeletonPath = join(
  process.cwd(),
  "src/components/public/booking-review-skeleton.tsx",
);
const validatorPath = join(
  process.cwd(),
  "src/lib/validators/country-validation.ts",
);

describe("booking review code splitting", () => {
  it("keeps the route page as a server shell around the client review workflow", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("BookingReviewClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("react-hook-form");
    expect(pageSource).not.toContain("@hookform/resolvers/zod");
    expect(pageSource).not.toContain("@/context/data-context");
    expect(pageSource).not.toContain("@/lib/pricing-calculator");
    expect(loaderSource).toContain("const DynamicBookingReviewClient = dynamic");
    expect(loaderSource).toContain("./booking-review-client");
  });

  it("keeps the heavy country list out of the initial review page chunk", () => {
    const pageSource = readFileSync(clientPath, "utf8");
    const validatorSource = readFileSync(validatorPath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain("@/components/ui/country-combobox");
    expect(pageSource).not.toContain(
      'import { CountryCombobox } from "@/components/ui/country-combobox"',
    );
    expect(pageSource).not.toContain("@/lib/countries");
    expect(validatorSource).not.toContain("../countries");
  });

  it("submits bookings through the public server API without browser-side room assignment", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain('fetch("/api/bookings/public"');
    expect(pageSource).not.toContain("getOrCreateGuestByEmail");
    expect(pageSource).not.toContain("assignAvailableRoomsForRoomTypes");
    expect(pageSource).not.toContain("distributeGuestsAcrossRooms");
    expect(pageSource).not.toContain("validateBookingRequest");
    expect(pageSource).not.toContain("addReservation,");
    expect(pageSource).not.toContain("rooms,");
  });

  it("uses selected-room review data instead of global public booking data", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("useBookingReviewData");
    expect(pageSource).not.toContain("roomTypes,");
    expect(pageSource).not.toContain("ratePlans,");
    expect(pageSource).not.toContain("seasonalPrices,");
    expect(pageSource).not.toContain("propertyClosures,");
  });

  it("keeps the booking review loader skeleton free of shared card utilities", () => {
    const skeletonSource = readFileSync(skeletonPath, "utf8");

    expect(skeletonSource).not.toContain("@/components/ui/card");
    expect(skeletonSource).not.toContain("<Card");
    expect(skeletonSource).toContain("BookingReviewSkeleton");
  });

  it("sizes booking review room images for transformed Supabase variants", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("activeHeroRoomType?.mainPhotoUrl");
    expect(pageSource).toContain('sizes="(max-width: 768px) 100vw, 40vw"');
    expect(pageSource).toContain("roomType.mainPhotoUrl");
    expect(pageSource).toContain('sizes="140px"');
  });
});
