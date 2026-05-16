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
  getPublicRoomTypeDetail,
  PUBLIC_ROOM_TYPE_DETAIL_AMENITY_SELECT,
  PUBLIC_ROOM_TYPE_DETAIL_CLOSURE_SELECT,
  PUBLIC_ROOM_TYPE_DETAIL_RATE_PLAN_SELECT,
  PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_AMENITY_SELECT,
  PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_SELECT,
  PUBLIC_ROOM_TYPE_DETAIL_SEASONAL_PRICE_SELECT,
} from "./room-type-detail";

const createSelectedRoomTypeQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

const createRelatedRoomTypesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => response),
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

const createRatePlanQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

const createScopedListQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(async () => response),
  };
  return query;
};

describe("public room type detail server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns selected room detail data without loading all public booking datasets", async () => {
    const selectedRoomTypeQuery = createSelectedRoomTypeQuery({
      data: {
        id: "room-type-1",
        name: "Ganga View",
        description: "River view room",
        max_occupancy: 3,
        min_occupancy: 1,
        max_children: 1,
        category_id: "cat-1",
        bed_types: ["Queen"],
        price: 4200,
        photos: ["/room.jpg"],
        main_photo_url: "/main.jpg",
        is_visible: true,
      },
      error: null,
    });
    const relatedRoomTypesQuery = createRelatedRoomTypesQuery({
      data: [
        {
          id: "room-type-2",
          name: "Ashram View",
          description: "Quiet room",
          max_occupancy: 2,
          min_occupancy: null,
          max_children: null,
          category_id: null,
          bed_types: ["Twin"],
          price: 3200,
          photos: [],
          main_photo_url: null,
          is_visible: true,
        },
      ],
      error: null,
    });
    const roomTypeAmenitiesQuery = createRoomTypeAmenitiesQuery({
      data: [
        { room_type_id: "room-type-1", amenity_id: "wifi" },
        { room_type_id: "room-type-2", amenity_id: "bath" },
      ],
      error: null,
    });
    const amenitiesQuery = createAmenitiesQuery({
      data: [
        { id: "bath", name: "Bath", icon: "Bath" },
        { id: "wifi", name: "Wifi", icon: "Wifi" },
      ],
      error: null,
    });
    const ratePlanQuery = createRatePlanQuery({
      data: { id: "standard", name: "Standard Rate", price: 4000, rules: null },
      error: null,
    });
    const seasonalPricesQuery = createScopedListQuery({
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
    const closuresQuery = createScopedListQuery({
      data: [
        {
          id: "closure-1",
          property_id: "property-1",
          room_type_id: null,
          start_date: "2026-09-01",
          end_date: "2026-09-05",
          reason: "Maintenance",
        },
      ],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(selectedRoomTypeQuery)
      .mockReturnValueOnce(relatedRoomTypesQuery)
      .mockReturnValueOnce(ratePlanQuery)
      .mockReturnValueOnce(seasonalPricesQuery)
      .mockReturnValueOnce(closuresQuery)
      .mockReturnValueOnce(roomTypeAmenitiesQuery)
      .mockReturnValueOnce(amenitiesQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(getPublicRoomTypeDetail("room-type-1")).resolves.toMatchObject({
      roomType: {
        id: "room-type-1",
        name: "Ganga View",
        amenities: ["wifi"],
        mainPhotoUrl: "/main.jpg",
      },
      relatedRoomTypes: [{ id: "room-type-2", amenities: ["bath"] }],
      amenities: [
        { id: "bath", name: "Bath", icon: "Bath" },
        { id: "wifi", name: "Wifi", icon: "Wifi" },
      ],
      standardRatePlan: { id: "standard", name: "Standard Rate", price: 4000 },
      seasonalPrices: [{ id: "season-1", roomTypeId: "room-type-1" }],
      propertyClosures: [{ id: "closure-1", roomTypeId: undefined }],
    });

    expect(from).toHaveBeenNthCalledWith(1, "room_types");
    expect(selectedRoomTypeQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_SELECT,
    );
    expect(selectedRoomTypeQuery.eq).toHaveBeenCalledWith("id", "room-type-1");
    expect(selectedRoomTypeQuery.neq).toHaveBeenCalledWith("is_visible", false);

    expect(from).toHaveBeenNthCalledWith(2, "room_types");
    expect(relatedRoomTypesQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_SELECT,
    );
    expect(relatedRoomTypesQuery.neq).toHaveBeenCalledWith("id", "room-type-1");
    expect(relatedRoomTypesQuery.neq).toHaveBeenCalledWith("is_visible", false);
    expect(relatedRoomTypesQuery.limit).toHaveBeenCalledWith(3);

    expect(from).toHaveBeenNthCalledWith(3, "rate_plans");
    expect(ratePlanQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_RATE_PLAN_SELECT,
    );
    expect(ratePlanQuery.eq).toHaveBeenCalledWith("name", "Standard Rate");

    expect(from).toHaveBeenNthCalledWith(4, "seasonal_prices");
    expect(seasonalPricesQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_SEASONAL_PRICE_SELECT,
    );
    expect(seasonalPricesQuery.eq).toHaveBeenCalledWith(
      "room_type_id",
      "room-type-1",
    );

    expect(from).toHaveBeenNthCalledWith(5, "property_closures");
    expect(closuresQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_CLOSURE_SELECT,
    );
    expect(closuresQuery.or).toHaveBeenCalledWith(
      "room_type_id.is.null,room_type_id.eq.room-type-1",
    );

    expect(from).toHaveBeenNthCalledWith(6, "room_type_amenities");
    expect(roomTypeAmenitiesQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_AMENITY_SELECT,
    );
    expect(roomTypeAmenitiesQuery.in).toHaveBeenCalledWith("room_type_id", [
      "room-type-1",
      "room-type-2",
    ]);

    expect(from).toHaveBeenNthCalledWith(7, "amenities");
    expect(amenitiesQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_DETAIL_AMENITY_SELECT,
    );
    expect(amenitiesQuery.in).toHaveBeenCalledWith("id", ["bath", "wifi"]);
  });
});
