import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_RESERVATION_BOOKING_GUEST_SELECT,
  ADMIN_RESERVATION_BOOKING_RATE_PLAN_SELECT,
  ADMIN_RESERVATION_BOOKING_RESERVATION_SELECT,
  ADMIN_RESERVATION_BOOKING_ROOM_SELECT,
  ADMIN_RESERVATION_BOOKING_ROOM_TYPE_SELECT,
  getAdminReservationBookingDetails,
} from "./admin-reservation-booking";

type QueryRecorder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  result: Promise<{ data: unknown[]; error: null }>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};

function createQuery(data: unknown[]): QueryRecorder {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    result: Promise.resolve({ data, error: null }),
  } as QueryRecorder;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.then = query.result.then.bind(query.result);

  return query;
}

const reservationRow = {
  id: "11111111-1111-4111-8111-111111111111",
  booking_id: "A1001",
  guest_id: "guest-1",
  room_id: "room-1",
  rate_plan_id: "rate-plan-1",
  check_in_date: "2026-06-10",
  check_out_date: "2026-06-12",
  number_of_guests: 2,
  status: "Confirmed",
  notes: null,
  folio: [],
  total_amount: 2000,
  booking_date: "2026-05-13T00:00:00.000Z",
  source: "reception",
  payment_method: "UPI",
  adult_count: 2,
  child_count: 0,
  tax_enabled_snapshot: true,
  tax_rate_snapshot: 0.12,
  external_source: null,
  external_id: null,
  external_metadata: null,
};

describe("getAdminReservationBookingDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a reservation id to its booking group and guest with narrow selects", async () => {
    const reservationQuery = createQuery([reservationRow]);
    const siblingsQuery = createQuery([reservationRow]);
    const roomsQuery = createQuery([
      {
        id: "room-1",
        room_number: "101",
        room_type_id: "type-1",
        status: "Clean",
      },
    ]);
    const roomTypesQuery = createQuery([
      {
        id: "type-1",
        name: "Ganga View",
        description: "",
        max_occupancy: 2,
        min_occupancy: 1,
        max_children: 0,
        category_id: null,
        bed_types: ["Queen"],
        price: 1000,
        photos: [],
        main_photo_url: null,
        is_visible: true,
      },
    ]);
    const ratePlansQuery = createQuery([
      {
        id: "rate-plan-1",
        name: "Standard Rate",
        price: 1000,
        rules: null,
      },
    ]);
    const guestQuery = createQuery([
      {
        id: "guest-1",
        first_name: "Nirav",
        last_name: "Patel",
        email: "nirav@example.com",
        phone: "+91 9999999999",
        address: "123 Test Street",
        pincode: "380001",
        city: "Ahmedabad",
        state: "Gujarat",
        country: "IN",
      },
    ]);

    let reservationCallCount = 0;
    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "reservations") {
          reservationCallCount += 1;
          return reservationCallCount === 1 ? reservationQuery : siblingsQuery;
        }
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        if (table === "rate_plans") return ratePlansQuery;
        if (table === "guests") return guestQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const result = await getAdminReservationBookingDetails("11111111-1111-4111-8111-111111111111");

    expect(result.reservations.map((reservation) => reservation.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(result.guest?.id).toBe("guest-1");
    expect(result.rooms.map((room) => room.id)).toEqual(["room-1"]);
    expect(result.roomTypes.map((roomType) => roomType.id)).toEqual(["type-1"]);
    expect(result.ratePlans.map((ratePlan) => ratePlan.id)).toEqual([
      "rate-plan-1",
    ]);

    expect(reservationQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_BOOKING_RESERVATION_SELECT,
    );
    expect(reservationQuery.eq).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");
    expect(reservationQuery.limit).toHaveBeenCalledWith(1);
    expect(siblingsQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_BOOKING_RESERVATION_SELECT,
    );
    expect(siblingsQuery.eq).toHaveBeenCalledWith("booking_id", "A1001");
    expect(guestQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_BOOKING_GUEST_SELECT,
    );
    expect(guestQuery.eq).toHaveBeenCalledWith("id", "guest-1");
    expect(guestQuery.limit).toHaveBeenCalledWith(1);
    expect(roomsQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_BOOKING_ROOM_SELECT,
    );
    expect(roomsQuery.in).toHaveBeenCalledWith("id", ["room-1"]);
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_BOOKING_ROOM_TYPE_SELECT,
    );
    expect(roomTypesQuery.in).toHaveBeenCalledWith("id", ["type-1"]);
    expect(ratePlansQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_BOOKING_RATE_PLAN_SELECT,
    );
    expect(ratePlansQuery.in).toHaveBeenCalledWith("id", ["rate-plan-1"]);
  });

  it("accepts a booking code directly without the reservation id lookup", async () => {
    const siblingsQuery = createQuery([reservationRow]);
    const roomsQuery = createQuery([]);
    const roomTypesQuery = createQuery([]);
    const ratePlansQuery = createQuery([]);
    const guestQuery = createQuery([]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "reservations") return siblingsQuery;
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        if (table === "rate_plans") return ratePlansQuery;
        if (table === "guests") return guestQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getAdminReservationBookingDetails("A1001")).resolves.toMatchObject({
      reservations: [{ id: "11111111-1111-4111-8111-111111111111" }],
      guest: null,
    });

    expect(siblingsQuery.eq).toHaveBeenCalledWith("booking_id", "A1001");
  });
});
