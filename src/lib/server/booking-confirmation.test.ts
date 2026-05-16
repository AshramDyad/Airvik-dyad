import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  getPublicBookingConfirmation,
  PUBLIC_CONFIRMATION_GUEST_SELECT,
  PUBLIC_CONFIRMATION_RESERVATION_SELECT,
  PUBLIC_CONFIRMATION_ROOM_SELECT,
  PUBLIC_CONFIRMATION_ROOM_TYPE_SELECT,
} from "./booking-confirmation";

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

describe("getPublicBookingConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only the requested reservation group, guest, rooms, and room types", async () => {
    const reservationQuery = createQuery([
      {
        id: "reservation-1",
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
        source: "website",
        payment_method: "UPI",
        adult_count: 2,
        child_count: 0,
        tax_enabled_snapshot: true,
        tax_rate_snapshot: 0.12,
        external_source: null,
        external_id: null,
        external_metadata: null,
      },
    ]);
    const bookingReservationsQuery = createQuery([
      {
        id: "reservation-1",
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
        source: "website",
        payment_method: "UPI",
        adult_count: 2,
        child_count: 0,
        tax_enabled_snapshot: true,
        tax_rate_snapshot: 0.12,
        external_source: null,
        external_id: null,
        external_metadata: null,
      },
      {
        id: "reservation-2",
        booking_id: "A1001",
        guest_id: "guest-1",
        room_id: "room-2",
        rate_plan_id: "rate-plan-1",
        check_in_date: "2026-06-10",
        check_out_date: "2026-06-12",
        number_of_guests: 1,
        status: "Confirmed",
        notes: null,
        folio: [],
        total_amount: 1500,
        booking_date: "2026-05-13T00:00:00.000Z",
        source: "website",
        payment_method: "UPI",
        adult_count: 1,
        child_count: 0,
        tax_enabled_snapshot: true,
        tax_rate_snapshot: 0.12,
        external_source: null,
        external_id: null,
        external_metadata: null,
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
    const roomsQuery = createQuery([
      {
        id: "room-1",
        room_number: "101",
        room_type_id: "room-type-1",
        status: "Clean",
        photos: [],
      },
      {
        id: "room-2",
        room_number: "102",
        room_type_id: "room-type-2",
        status: "Inspected",
        photos: [],
      },
    ]);
    const roomTypesQuery = createQuery([
      {
        id: "room-type-1",
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
        id: "room-type-2",
        name: "Suite",
        description: "",
        max_occupancy: 3,
        min_occupancy: 1,
        max_children: 2,
        category_id: null,
        bed_types: ["King"],
        price: 1500,
        photos: [],
        main_photo_url: null,
        is_visible: true,
      },
    ]);

    let reservationCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "reservations") {
          reservationCallCount += 1;
          return reservationCallCount === 1
            ? reservationQuery
            : bookingReservationsQuery;
        }
        if (table === "guests") return guestQuery;
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const result = await getPublicBookingConfirmation("reservation-1");

    expect(result.reservation.id).toBe("reservation-1");
    expect(result.bookingReservations).toHaveLength(2);
    expect(result.guest?.id).toBe("guest-1");
    expect(result.rooms.map((room) => room.id)).toEqual(["room-1", "room-2"]);
    expect(result.roomTypes.map((roomType) => roomType.id)).toEqual([
      "room-type-1",
      "room-type-2",
    ]);

    expect(reservationQuery.select).toHaveBeenCalledWith(
      PUBLIC_CONFIRMATION_RESERVATION_SELECT,
    );
    expect(reservationQuery.eq).toHaveBeenCalledWith("id", "reservation-1");
    expect(reservationQuery.limit).toHaveBeenCalledWith(1);

    expect(bookingReservationsQuery.select).toHaveBeenCalledWith(
      PUBLIC_CONFIRMATION_RESERVATION_SELECT,
    );
    expect(bookingReservationsQuery.eq).toHaveBeenCalledWith(
      "booking_id",
      "A1001",
    );
    expect(guestQuery.select).toHaveBeenCalledWith(PUBLIC_CONFIRMATION_GUEST_SELECT);
    expect(guestQuery.eq).toHaveBeenCalledWith("id", "guest-1");
    expect(roomsQuery.select).toHaveBeenCalledWith(PUBLIC_CONFIRMATION_ROOM_SELECT);
    expect(roomsQuery.in).toHaveBeenCalledWith("id", ["room-1", "room-2"]);
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      PUBLIC_CONFIRMATION_ROOM_TYPE_SELECT,
    );
    expect(roomTypesQuery.in).toHaveBeenCalledWith("id", [
      "room-type-1",
      "room-type-2",
    ]);
  });
});
