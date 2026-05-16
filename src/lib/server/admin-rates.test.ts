import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_RATE_PLANS_SELECT,
  ADMIN_RATE_ROOM_TYPE_OPTIONS_SELECT,
  ADMIN_SEASONAL_PRICES_SELECT,
  getAdminRatesData,
} from "./admin-rates";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminRatesData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads narrow rate, seasonal price, and room type option fields", async () => {
    const ratePlansQuery = createQuery([
      {
        id: "rate-1",
        name: "Standard",
        price: 1200,
        rules: { minStay: 1, cancellationPolicy: "Flexible" },
      },
    ]);
    const seasonalPricesQuery = createQuery([
      {
        id: "season-1",
        room_type_id: "type-1",
        name: "Peak",
        price: 1500,
        start_date: "2026-10-01",
        end_date: "2026-10-31",
      },
    ]);
    const roomTypesQuery = createQuery([
      { id: "type-1", name: "Ganga View" },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "rate_plans") return ratePlansQuery;
        if (table === "seasonal_prices") return seasonalPricesQuery;
        if (table === "room_types") return roomTypesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getAdminRatesData()).resolves.toEqual({
      ratePlans: [
        {
          id: "rate-1",
          name: "Standard",
          price: 1200,
          rules: { minStay: 1, cancellationPolicy: "Flexible" },
        },
      ],
      seasonalPrices: [
        {
          id: "season-1",
          roomTypeId: "type-1",
          name: "Peak",
          price: 1500,
          startDate: "2026-10-01",
          endDate: "2026-10-31",
        },
      ],
      roomTypes: [{ id: "type-1", name: "Ganga View" }],
    });

    expect(ratePlansQuery.select).toHaveBeenCalledWith(ADMIN_RATE_PLANS_SELECT);
    expect(ratePlansQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
    expect(seasonalPricesQuery.select).toHaveBeenCalledWith(
      ADMIN_SEASONAL_PRICES_SELECT,
    );
    expect(seasonalPricesQuery.order).toHaveBeenCalledWith("start_date", {
      ascending: true,
    });
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      ADMIN_RATE_ROOM_TYPE_OPTIONS_SELECT,
    );
    expect(ADMIN_RATE_ROOM_TYPE_OPTIONS_SELECT).toBe("id, name");
    expect(roomTypesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });
});
