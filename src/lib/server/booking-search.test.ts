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
  getPublicBookingSearchData,
  PUBLIC_BOOKING_SEARCH_AMENITY_SELECT,
  PUBLIC_BOOKING_SEARCH_CLOSURE_SELECT,
  PUBLIC_BOOKING_SEARCH_RATE_PLAN_SELECT,
  PUBLIC_BOOKING_SEARCH_ROOM_TYPE_AMENITY_SELECT,
  PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT,
} from "./booking-search";

const createRoomTypesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(async () => response),
  };
  return query;
};

const createRoomTypeAmenitiesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(async () => response),
  };
  return query;
};

const createAmenitiesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(async () => response),
  };
  return query;
};

const createClosuresQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    is: vi.fn(() => query),
    gte: vi.fn(() => query),
    order: vi.fn(async () => response),
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

describe("public booking search server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads compact visible-room search metadata without broad seasonal prices", async () => {
    const roomTypesQuery = createRoomTypesQuery({
      data: [
        {
          id: "type-1",
          name: "Ganga View",
          description: "River view room",
          max_occupancy: 3,
          bed_types: ["Queen"],
          price: 4200,
          photos: ["/room.jpg"],
          main_photo_url: "/main.jpg",
        },
      ],
      error: null,
    });
    const closuresQuery = createClosuresQuery({
      data: [
        {
          start_date: "2026-05-20",
          end_date: "2026-05-22",
        },
      ],
      error: null,
    });
    const roomTypeAmenitiesQuery = createRoomTypeAmenitiesQuery({
      data: [{ room_type_id: "type-1", amenity_id: "wifi" }],
      error: null,
    });
    const amenitiesQuery = createAmenitiesQuery({
      data: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
      error: null,
    });
    const ratePlanQuery = createRatePlanQuery({
      data: {
        id: "standard",
        name: "Standard Rate",
        price: 4000,
        rules: null,
      },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "room_types") return roomTypesQuery;
      if (table === "property_closures") return closuresQuery;
      if (table === "room_type_amenities") return roomTypeAmenitiesQuery;
      if (table === "amenities") return amenitiesQuery;
      if (table === "rate_plans") return ratePlanQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(getPublicBookingSearchData("2026-05-13")).resolves.toEqual({
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          description: "River view room",
          maxOccupancy: 3,
          bedTypes: ["Queen"],
          price: 4200,
          amenities: ["wifi"],
          photos: ["/room.jpg"],
          mainPhotoUrl: "/main.jpg",
          isVisible: true,
        },
      ],
      amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
      ratePlan: {
        id: "standard",
        name: "Standard Rate",
        price: 4000,
        rules: {
          minStay: 1,
          cancellationPolicy: "",
        },
      },
      propertyClosures: [
        {
          startDate: "2026-05-20",
          endDate: "2026-05-22",
        },
      ],
    });

    expect(from).not.toHaveBeenCalledWith("seasonal_prices");
    expect(ratePlanQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_SEARCH_RATE_PLAN_SELECT,
    );
    expect(ratePlanQuery.eq).toHaveBeenCalledWith("name", "Standard Rate");
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT,
    );
    expect(PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT).toBe(
      "id, name, description, max_occupancy, bed_types, price, photos, main_photo_url",
    );
    expect(roomTypesQuery.neq).toHaveBeenCalledWith("is_visible", false);
    expect(roomTypesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
    expect(closuresQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_SEARCH_CLOSURE_SELECT,
    );
    expect(PUBLIC_BOOKING_SEARCH_CLOSURE_SELECT).toBe("start_date, end_date");
    expect(closuresQuery.is).toHaveBeenCalledWith("room_type_id", null);
    expect(closuresQuery.gte).toHaveBeenCalledWith("end_date", "2026-05-13");
    expect(roomTypeAmenitiesQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_SEARCH_ROOM_TYPE_AMENITY_SELECT,
    );
    expect(roomTypeAmenitiesQuery.in).toHaveBeenCalledWith("room_type_id", [
      "type-1",
    ]);
    expect(amenitiesQuery.select).toHaveBeenCalledWith(
      PUBLIC_BOOKING_SEARCH_AMENITY_SELECT,
    );
    expect(amenitiesQuery.in).toHaveBeenCalledWith("id", ["wifi"]);
  });
});
