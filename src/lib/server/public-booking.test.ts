import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  createPublicBooking,
  PUBLIC_BOOKING_CONFLICT_SELECT,
  PUBLIC_BOOKING_ROOM_SELECT,
} from "./public-booking";

type QueryRecorder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  result: Promise<{ data: unknown[]; error: null }>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};

function createQuery(data: unknown[]): QueryRecorder {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    lt: vi.fn(),
    gt: vi.fn(),
    lte: vi.fn(),
    gte: vi.fn(),
    limit: vi.fn(),
    result: Promise.resolve({ data, error: null }),
  } as QueryRecorder;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.then = query.result.then.bind(query.result);

  return query;
}

describe("createPublicBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses narrow room/conflict queries and booking RPCs to create public reservations", async () => {
    const roomTypeOneId = "room-type-1";
    const roomTypeTwoId = "room-type-2";
    const roomOneId = "room-1";
    const roomTwoId = "room-2";

    const propertyQuery = createQuery([
      { tax_enabled: true, tax_percentage: 0.12 },
    ]);
    const roomTypesQuery = createQuery([
      {
        id: roomTypeOneId,
        name: "Deluxe",
        description: "",
        max_occupancy: 2,
        min_occupancy: 1,
        max_children: 1,
        category_id: null,
        bed_types: ["Queen"],
        price: 1000,
        photos: [],
        main_photo_url: null,
        is_visible: true,
      },
      {
        id: roomTypeTwoId,
        name: "Suite",
        description: "",
        max_occupancy: 3,
        min_occupancy: 1,
        max_children: 2,
        category_id: null,
        bed_types: ["King"],
        price: 2000,
        photos: [],
        main_photo_url: null,
        is_visible: true,
      },
    ]);
    const ratePlansQuery = createQuery([
      { id: "rate-plan-1", name: "Standard Rate", price: 900, rules: {} },
    ]);
    const seasonalPricesQuery = createQuery([]);
    const closuresQuery = createQuery([]);
    const roomsQuery = createQuery([
      { id: roomOneId, room_type_id: roomTypeOneId, status: "Clean" },
      { id: roomTwoId, room_type_id: roomTypeTwoId, status: "Inspected" },
    ]);
    const conflictsQuery = createQuery([]);

    const rpc = vi.fn(async (fn: string) => {
      if (fn === "validate_booking_request") {
        return { data: { isValid: true }, error: null };
      }
      if (fn === "get_or_create_booking_guest") {
        return { data: { id: "guest-1" }, error: null };
      }
      if (fn === "create_reservations_with_total") {
        return {
          data: [
            {
              id: "reservation-1",
              booking_id: "A1001",
              guest_id: "guest-1",
              room_id: roomOneId,
              rate_plan_id: "rate-plan-1",
              check_in_date: "2026-06-10",
              check_out_date: "2026-06-12",
              number_of_guests: 3,
              status: "Confirmed",
              notes: "Near the lift",
              total_amount: 2000,
              booking_date: "2026-05-13T00:00:00.000Z",
              source: "website",
              payment_method: "UPI",
              adult_count: 2,
              child_count: 1,
              tax_enabled_snapshot: true,
              tax_rate_snapshot: 0.12,
              external_source: null,
              external_id: null,
              external_metadata: null,
            },
          ],
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "properties") return propertyQuery;
        if (table === "room_types") return roomTypesQuery;
        if (table === "rate_plans") return ratePlansQuery;
        if (table === "seasonal_prices") return seasonalPricesQuery;
        if (table === "property_closures") return closuresQuery;
        if (table === "rooms") return roomsQuery;
        if (table === "reservations") return conflictsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const result = await createPublicBooking({
      roomTypeIds: [roomTypeOneId, roomTypeTwoId],
      checkIn: "2026-06-10",
      checkOut: "2026-06-12",
      adults: 2,
      children: 1,
      specialRequests: "Near the lift",
      guest: {
        firstName: "Nirav",
        lastName: "Patel",
        email: "nirav@example.com",
        phone: "+91 9999999999",
        address: "123 Test Street",
        pincode: "380001",
        city: "Ahmedabad",
        state: "Gujarat",
        country: "IN",
      },
    });

    expect(result.confirmationReservationId).toBe("reservation-1");

    expect(roomsQuery.select).toHaveBeenCalledWith(PUBLIC_BOOKING_ROOM_SELECT);
    expect(roomsQuery.in).toHaveBeenCalledWith("room_type_id", [
      roomTypeOneId,
      roomTypeTwoId,
    ]);
    expect(roomsQuery.in).toHaveBeenCalledWith("status", [
      "Clean",
      "Dirty",
      "Inspected",
    ]);

    expect(conflictsQuery.select).toHaveBeenCalledWith(PUBLIC_BOOKING_CONFLICT_SELECT);
    expect(conflictsQuery.in).toHaveBeenCalledWith("room_id", [
      roomOneId,
      roomTwoId,
    ]);
    expect(conflictsQuery.neq).toHaveBeenCalledWith("status", "Cancelled");
    expect(conflictsQuery.neq).toHaveBeenCalledWith("status", "No-show");
    expect(conflictsQuery.lt).toHaveBeenCalledWith("check_in_date", "2026-06-12");
    expect(conflictsQuery.gt).toHaveBeenCalledWith("check_out_date", "2026-06-10");

    expect(rpc).toHaveBeenCalledWith("validate_booking_request", {
      p_check_in: "2026-06-10",
      p_check_out: "2026-06-12",
      p_room_id: roomOneId,
      p_adults: 1,
      p_children: 1,
    });
    expect(rpc).toHaveBeenCalledWith("get_or_create_booking_guest", {
      p_first_name: "Nirav",
      p_last_name: "Patel",
      p_email: "nirav@example.com",
      p_phone: "+91 9999999999",
      p_address: "123 Test Street",
      p_pincode: "380001",
      p_city: "Ahmedabad",
      p_state: "Gujarat",
      p_country: "IN",
    });
    expect(rpc).toHaveBeenCalledWith(
      "create_reservations_with_total",
      expect.objectContaining({
        p_guest_id: "guest-1",
        p_room_ids: [roomOneId, roomTwoId],
        p_rate_plan_id: "rate-plan-1",
        p_check_in_date: "2026-06-10",
        p_check_out_date: "2026-06-12",
        p_number_of_guests: 3,
        p_status: "Confirmed",
        p_notes: "Near the lift",
        p_source: "website",
        p_payment_method: "UPI",
        p_adult_count: 2,
        p_child_count: 1,
        p_tax_enabled_snapshot: true,
        p_tax_rate_snapshot: 0.12,
        p_custom_totals: [2000, 4000],
      }),
    );
  });
});
