import "server-only";

import type { RatePlan, Room, RoomType, SeasonalPrice } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type { AdminReservationFormData } from "@/lib/reservations/admin-form-data";

export const ADMIN_RESERVATION_FORM_ROOMS_SELECT =
  "id, room_number, room_type_id, status" as const;
export const ADMIN_RESERVATION_FORM_ROOM_TYPES_SELECT =
  "id, name, max_occupancy, bed_types, price" as const;
export const ADMIN_RESERVATION_FORM_RATE_PLANS_SELECT =
  "id, name, price, rules" as const;
export const ADMIN_RESERVATION_FORM_SEASONAL_PRICES_SELECT =
  "id, room_type_id, name, price, start_date, end_date" as const;

type DbReservationFormRoom = {
  id: string;
  room_number: string;
  room_type_id: string;
  status: Room["status"];
};

type DbReservationFormRoomType = {
  id: string;
  name: string;
  max_occupancy: number;
  bed_types: string[] | null;
  price: number | null;
};

type DbReservationFormRatePlan = {
  id: string;
  name: string;
  price: number | null;
  rules: RatePlan["rules"] | null;
};

type DbReservationFormSeasonalPrice = {
  id: string;
  room_type_id: string;
  name: string | null;
  price: number;
  start_date: string;
  end_date: string;
};

const fromDbRoom = (row: DbReservationFormRoom): Room => ({
  id: row.id,
  roomNumber: row.room_number,
  roomTypeId: row.room_type_id,
  status: row.status,
});

const fromDbRoomType = (row: DbReservationFormRoomType): RoomType => ({
  id: row.id,
  name: row.name,
  description: "",
  maxOccupancy: row.max_occupancy,
  bedTypes: row.bed_types ?? [],
  price: Number(row.price ?? 0),
  amenities: [],
  photos: [],
  isVisible: true,
});

const fromDbRatePlan = (row: DbReservationFormRatePlan): RatePlan => ({
  id: row.id,
  name: row.name,
  price: Number(row.price ?? 0),
  rules: row.rules ?? {
    minStay: 1,
    cancellationPolicy: "",
  },
});

const fromDbSeasonalPrice = (
  row: DbReservationFormSeasonalPrice,
): SeasonalPrice => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  name: row.name ?? "",
  price: Number(row.price),
  startDate: row.start_date,
  endDate: row.end_date,
});

export async function getAdminReservationFormData(): Promise<AdminReservationFormData> {
  const supabase = createServerSupabaseClient();

  const [roomsResult, roomTypesResult, ratePlansResult, seasonalPricesResult] =
    await Promise.all([
      supabase
        .from("rooms")
        .select(ADMIN_RESERVATION_FORM_ROOMS_SELECT)
        .order("room_number", { ascending: true }),
      supabase
        .from("room_types")
        .select(ADMIN_RESERVATION_FORM_ROOM_TYPES_SELECT)
        .order("name", { ascending: true }),
      supabase
        .from("rate_plans")
        .select(ADMIN_RESERVATION_FORM_RATE_PLANS_SELECT)
        .order("name", { ascending: true }),
      supabase
        .from("seasonal_prices")
        .select(ADMIN_RESERVATION_FORM_SEASONAL_PRICES_SELECT)
        .order("start_date", { ascending: true }),
    ]);

  if (roomsResult.error) {
    throw new Error(roomsResult.error.message || "Failed to load rooms");
  }

  if (roomTypesResult.error) {
    throw new Error(
      roomTypesResult.error.message || "Failed to load room types",
    );
  }

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

  return {
    rooms: ((roomsResult.data ?? []) as DbReservationFormRoom[]).map(
      fromDbRoom,
    ),
    roomTypes: (
      (roomTypesResult.data ?? []) as DbReservationFormRoomType[]
    ).map(fromDbRoomType),
    ratePlans: (
      (ratePlansResult.data ?? []) as DbReservationFormRatePlan[]
    ).map(fromDbRatePlan),
    seasonalPrices: (
      (seasonalPricesResult.data ?? []) as DbReservationFormSeasonalPrice[]
    ).map(fromDbSeasonalPrice),
  };
}
