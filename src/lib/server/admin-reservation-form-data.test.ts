import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_RESERVATION_FORM_RATE_PLANS_SELECT,
  ADMIN_RESERVATION_FORM_ROOMS_SELECT,
  ADMIN_RESERVATION_FORM_ROOM_TYPES_SELECT,
  ADMIN_RESERVATION_FORM_SEASONAL_PRICES_SELECT,
  getAdminReservationFormData,
} from "./admin-reservation-form-data";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminReservationFormData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads compact room, room type, rate plan, and seasonal price reference data", async () => {
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
        max_occupancy: 3,
        bed_types: ["Queen"],
        price: 2400,
      },
    ]);
    const ratePlansQuery = createQuery([
      {
        id: "rate-plan-1",
        name: "Standard Rate",
        price: 2400,
        rules: { minStay: 1, cancellationPolicy: "" },
      },
    ]);
    const seasonalPricesQuery = createQuery([
      {
        id: "seasonal-1",
        room_type_id: "type-1",
        name: "Diwali",
        price: 3200,
        start_date: "2026-11-01",
        end_date: "2026-11-07",
      },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        if (table === "rate_plans") return ratePlansQuery;
        if (table === "seasonal_prices") return seasonalPricesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getAdminReservationFormData()).resolves.toEqual({
      rooms: [
        {
          id: "room-1",
          roomNumber: "101",
          roomTypeId: "type-1",
          status: "Clean",
        },
      ],
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          description: "",
          maxOccupancy: 3,
          bedTypes: ["Queen"],
          price: 2400,
          amenities: [],
          photos: [],
          isVisible: true,
        },
      ],
      ratePlans: [
        {
          id: "rate-plan-1",
          name: "Standard Rate",
          price: 2400,
          rules: { minStay: 1, cancellationPolicy: "" },
        },
      ],
      seasonalPrices: [
        {
          id: "seasonal-1",
          roomTypeId: "type-1",
          name: "Diwali",
          price: 3200,
          startDate: "2026-11-01",
          endDate: "2026-11-07",
        },
      ],
    });

    expect(roomsQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_FORM_ROOMS_SELECT,
    );
    expect(roomsQuery.order).toHaveBeenCalledWith("room_number", {
      ascending: true,
    });
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_FORM_ROOM_TYPES_SELECT,
    );
    expect(ADMIN_RESERVATION_FORM_ROOM_TYPES_SELECT).not.toContain("photos");
    expect(roomTypesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
    expect(ratePlansQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_FORM_RATE_PLANS_SELECT,
    );
    expect(ratePlansQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
    expect(seasonalPricesQuery.select).toHaveBeenCalledWith(
      ADMIN_RESERVATION_FORM_SEASONAL_PRICES_SELECT,
    );
    expect(seasonalPricesQuery.order).toHaveBeenCalledWith("start_date", {
      ascending: true,
    });
  });
});
