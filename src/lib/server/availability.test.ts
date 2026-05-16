import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  PUBLIC_AVAILABILITY_CLOSURE_SELECT,
  PUBLIC_AVAILABILITY_RESERVATION_SELECT,
  PUBLIC_AVAILABILITY_RESTRICTION_SELECT,
  PUBLIC_AVAILABILITY_ROOM_SELECT,
  PUBLIC_AVAILABILITY_ROOM_TYPE_SELECT,
  PUBLIC_AVAILABILITY_SEASONAL_PRICE_SELECT,
  searchPublicAvailability,
} from "./availability";

type QueryRecorder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  result: Promise<{ data: unknown[]; error: null }>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};

function createQuery(data: unknown[]): QueryRecorder {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    result: Promise.resolve({ data, error: null }),
  } as QueryRecorder;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.then = query.result.then.bind(query.result);

  return query;
}

describe("searchPublicAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses narrow public availability selects and date-overlap reservation filters", async () => {
    const roomsQuery = createQuery([
      { id: "room-1", room_number: "101", room_type_id: "type-1", status: "Clean" },
    ]);
    const roomTypesQuery = createQuery([
      {
        id: "type-1",
        name: "Deluxe",
        description: "",
        max_occupancy: 2,
        min_occupancy: 1,
        max_children: null,
        category_id: null,
        bed_types: ["Queen"],
        price: 100,
        amenities: [],
        photos: [],
        main_photo_url: null,
        is_visible: true,
      },
    ]);
    const reservationsQuery = createQuery([]);
    const restrictionsQuery = createQuery([]);
    const closuresQuery = createQuery([]);
    const seasonalPricesQuery = createQuery([
      {
        id: "season-1",
        room_type_id: "type-1",
        name: "Festival",
        price: 150,
        start_date: "2026-06-10",
        end_date: "2026-06-12",
      },
    ]);
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        if (table === "reservations") return reservationsQuery;
        if (table === "booking_restrictions") return restrictionsQuery;
        if (table === "property_closures") return closuresQuery;
        if (table === "seasonal_prices") return seasonalPricesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const result = await searchPublicAvailability({
      checkIn: "2026-06-10",
      checkOut: "2026-06-12",
      roomOccupancies: [{ adults: 2, children: 0 }],
      roomTypeIds: ["type-1"],
    });

    expect(result.availableRoomTypeIds).toEqual(["type-1"]);
    expect(result.seasonalPrices).toEqual([
      {
        id: "season-1",
        roomTypeId: "type-1",
        name: "Festival",
        price: 150,
        startDate: "2026-06-10",
        endDate: "2026-06-12",
      },
    ]);
    expect(roomsQuery.select).toHaveBeenCalledWith(PUBLIC_AVAILABILITY_ROOM_SELECT);
    expect(roomsQuery.in).toHaveBeenCalledWith("status", [
      "Clean",
      "Dirty",
      "Inspected",
    ]);
    expect(roomsQuery.in).toHaveBeenCalledWith("room_type_id", ["type-1"]);
    expect(roomTypesQuery.select).toHaveBeenCalledWith(PUBLIC_AVAILABILITY_ROOM_TYPE_SELECT);
    expect(PUBLIC_AVAILABILITY_ROOM_TYPE_SELECT).toBe(
      "id, max_occupancy, min_occupancy, max_children, category_id",
    );
    expect(roomTypesQuery.neq).toHaveBeenCalledWith("is_visible", false);
    expect(roomTypesQuery.in).toHaveBeenCalledWith("id", ["type-1"]);
    expect(reservationsQuery.select).toHaveBeenCalledWith(PUBLIC_AVAILABILITY_RESERVATION_SELECT);
    expect(reservationsQuery.in).toHaveBeenCalledWith("room_id", ["room-1"]);
    expect(restrictionsQuery.select).toHaveBeenCalledWith(PUBLIC_AVAILABILITY_RESTRICTION_SELECT);
    expect(closuresQuery.select).toHaveBeenCalledWith(PUBLIC_AVAILABILITY_CLOSURE_SELECT);
    expect(seasonalPricesQuery.select).toHaveBeenCalledWith(
      PUBLIC_AVAILABILITY_SEASONAL_PRICE_SELECT,
    );
    expect(seasonalPricesQuery.in).toHaveBeenCalledWith("room_type_id", [
      "type-1",
    ]);
    expect(seasonalPricesQuery.lte).toHaveBeenCalledWith(
      "start_date",
      "2026-06-10",
    );
    expect(seasonalPricesQuery.gte).toHaveBeenCalledWith(
      "end_date",
      "2026-06-10",
    );

    expect(reservationsQuery.neq).toHaveBeenCalledWith("status", "Cancelled");
    expect(reservationsQuery.lt).toHaveBeenCalledWith("check_in_date", "2026-06-12");
    expect(reservationsQuery.gt).toHaveBeenCalledWith("check_out_date", "2026-06-10");
  });
});
