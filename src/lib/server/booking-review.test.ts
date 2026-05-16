import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn) => fn),
}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getPublicBookingReviewData,
  PUBLIC_BOOKING_REVIEW_CLOSURE_SELECT,
  PUBLIC_BOOKING_REVIEW_RATE_PLAN_SELECT,
  PUBLIC_BOOKING_REVIEW_ROOM_TYPE_SELECT,
  PUBLIC_BOOKING_REVIEW_SEASONAL_PRICE_SELECT,
} from "./booking-review";

const createRoomTypesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    neq: vi.fn(async () => response),
  };
  return query;
};

const createRatePlanQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

const createSeasonalPricesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    lte: vi.fn(() => query),
    gte: vi.fn(async () => response),
  };
  return query;
};

const createClosuresQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    lt: vi.fn(() => query),
    gte: vi.fn(async () => response),
  };
  return query;
};

describe("public booking review server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only selected-room review data for requested dates", async () => {
    const roomTypesQuery = createRoomTypesQuery({
      data: [
        {
          id: "room-type-1",
          name: "Ganga View",
          description: "River view room",
          max_occupancy: 3,
          min_occupancy: 1,
          max_children: 1,
          category_id: null,
          bed_types: ["Queen"],
          price: 4200,
          photos: ["/room.jpg"],
          main_photo_url: "/main.jpg",
          is_visible: true,
        },
      ],
      error: null,
    });
    const ratePlanQuery = createRatePlanQuery({
      data: { id: "standard", name: "Standard Rate", price: 4000, rules: null },
      error: null,
    });
    const seasonalPricesQuery = createSeasonalPricesQuery({
      data: [
        {
          id: "season-1",
          room_type_id: "room-type-1",
          name: "Festival",
          price: 5000,
          start_date: "2026-10-01",
          end_date: "2026-10-15",
        },
      ],
      error: null,
    });
    const closuresQuery = createClosuresQuery({
      data: [
        {
          id: "closure-selected",
          property_id: "property-1",
          room_type_id: "room-type-1",
          start_date: "2026-10-04",
          end_date: "2026-10-05",
          reason: "Selected room maintenance",
        },
        {
          id: "closure-other",
          property_id: "property-1",
          room_type_id: "room-type-2",
          start_date: "2026-10-04",
          end_date: "2026-10-05",
          reason: "Other room maintenance",
        },
      ],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(roomTypesQuery)
      .mockReturnValueOnce(ratePlanQuery)
      .mockReturnValueOnce(seasonalPricesQuery)
      .mockReturnValueOnce(closuresQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(
      getPublicBookingReviewData({
        roomTypeIds: ["room-type-1", "room-type-1"],
        checkIn: "2026-10-04",
        checkOut: "2026-10-06",
      }),
    ).resolves.toMatchObject({
      roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
      ratePlan: { id: "standard", name: "Standard Rate" },
      seasonalPrices: [{ id: "season-1", roomTypeId: "room-type-1" }],
      propertyClosures: [{ id: "closure-selected", roomTypeId: "room-type-1" }],
    });

    expect(from).toHaveBeenNthCalledWith(1, "room_types");
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_REVIEW_ROOM_TYPE_SELECT,
    );
    expect(roomTypesQuery.in).toHaveBeenCalledWith("id", ["room-type-1"]);
    expect(roomTypesQuery.neq).toHaveBeenCalledWith("is_visible", false);

    expect(from).toHaveBeenNthCalledWith(2, "rate_plans");
    expect(ratePlanQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_REVIEW_RATE_PLAN_SELECT,
    );
    expect(ratePlanQuery.eq).toHaveBeenCalledWith("name", "Standard Rate");

    expect(from).toHaveBeenNthCalledWith(3, "seasonal_prices");
    expect(seasonalPricesQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_REVIEW_SEASONAL_PRICE_SELECT,
    );
    expect(seasonalPricesQuery.in).toHaveBeenCalledWith("room_type_id", [
      "room-type-1",
    ]);
    expect(seasonalPricesQuery.lte).toHaveBeenCalledWith(
      "start_date",
      "2026-10-04",
    );
    expect(seasonalPricesQuery.gte).toHaveBeenCalledWith(
      "end_date",
      "2026-10-04",
    );

    expect(from).toHaveBeenNthCalledWith(4, "property_closures");
    expect(closuresQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_REVIEW_CLOSURE_SELECT,
    );
    expect(closuresQuery.lt).toHaveBeenCalledWith("start_date", "2026-10-06");
    expect(closuresQuery.gte).toHaveBeenCalledWith("end_date", "2026-10-04");
  });
});
