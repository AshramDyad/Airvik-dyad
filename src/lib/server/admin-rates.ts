import "server-only";

import type { RatePlan, SeasonalPrice } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_RATE_PLANS_SELECT = "id, name, price, rules" as const;
export const ADMIN_SEASONAL_PRICES_SELECT =
  "id, room_type_id, name, price, start_date, end_date" as const;
export const ADMIN_RATE_ROOM_TYPE_OPTIONS_SELECT = "id, name" as const;

export type AdminRateRoomTypeOption = {
  id: string;
  name: string;
};

export type AdminRatesData = {
  ratePlans: RatePlan[];
  seasonalPrices: SeasonalPrice[];
  roomTypes: AdminRateRoomTypeOption[];
};

type DbSeasonalPrice = {
  id: string;
  room_type_id: string;
  name: string | null;
  price: number;
  start_date: string;
  end_date: string;
};

const fromDbSeasonalPrice = (seasonalPrice: DbSeasonalPrice): SeasonalPrice => ({
  id: seasonalPrice.id,
  roomTypeId: seasonalPrice.room_type_id,
  name: seasonalPrice.name ?? "",
  price: Number(seasonalPrice.price),
  startDate: seasonalPrice.start_date,
  endDate: seasonalPrice.end_date,
});

export async function getAdminRatesData(): Promise<AdminRatesData> {
  const supabase = createServerSupabaseClient();

  const [ratePlansResult, seasonalPricesResult, roomTypesResult] =
    await Promise.all([
      supabase
        .from("rate_plans")
        .select(ADMIN_RATE_PLANS_SELECT)
        .order("name", { ascending: true }),
      supabase
        .from("seasonal_prices")
        .select(ADMIN_SEASONAL_PRICES_SELECT)
        .order("start_date", { ascending: true }),
      supabase
        .from("room_types")
        .select(ADMIN_RATE_ROOM_TYPE_OPTIONS_SELECT)
        .order("name", { ascending: true }),
    ]);

  if (ratePlansResult.error) {
    throw new Error(
      ratePlansResult.error.message || "Failed to load rate plans",
    );
  }

  if (seasonalPricesResult.error) {
    throw new Error(
      seasonalPricesResult.error.message || "Failed to load seasonal prices",
    );
  }

  if (roomTypesResult.error) {
    throw new Error(
      roomTypesResult.error.message || "Failed to load room type options",
    );
  }

  return {
    ratePlans: (ratePlansResult.data ?? []) as RatePlan[],
    seasonalPrices: (
      (seasonalPricesResult.data ?? []) as DbSeasonalPrice[]
    ).map(fromDbSeasonalPrice),
    roomTypes: (roomTypesResult.data ?? []) as AdminRateRoomTypeOption[],
  };
}
