import "server-only";

import type {
  BookingRestriction,
  PropertyClosure,
  ReservationStatus,
  RoomStatus,
  RoomOccupancy,
  SeasonalPrice,
} from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import {
  computeAvailabilitySearchResult,
  type AvailabilityReservation,
  type AvailabilityRoom,
  type AvailabilityRoomType,
  type AvailabilitySearchResult,
} from "@/lib/availability/search";
import { BOOKABLE_ROOM_STATUSES } from "@/lib/rooms";

export const PUBLIC_AVAILABILITY_ROOM_TYPE_SELECT =
  "id, max_occupancy, min_occupancy, max_children, category_id" as const;
export const PUBLIC_AVAILABILITY_ROOM_SELECT =
  "id, room_type_id, status" as const;
export const PUBLIC_AVAILABILITY_RESERVATION_SELECT =
  "id, room_id, check_in_date, check_out_date, status" as const;
export const PUBLIC_AVAILABILITY_RESTRICTION_SELECT =
  "id, restriction_type, value, start_date, end_date, room_type_id" as const;
export const PUBLIC_AVAILABILITY_CLOSURE_SELECT =
  "id, property_id, room_type_id, start_date, end_date, reason" as const;
export const PUBLIC_AVAILABILITY_SEASONAL_PRICE_SELECT =
  "id, room_type_id, name, price, start_date, end_date" as const;

export type PublicAvailabilitySearchInput = {
  checkIn: string;
  checkOut: string;
  roomOccupancies: RoomOccupancy[];
  categoryIds?: string[];
  roomTypeIds?: string[];
};

type DbAvailabilityRoomType = {
  id: string;
  max_occupancy: number;
  min_occupancy: number | null;
  max_children: number | null;
  category_id: string | null;
};

type DbAvailabilityRoom = {
  id: string;
  room_type_id: string;
  status: RoomStatus;
};

type DbAvailabilityReservation = {
  id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
};

type DbAvailabilityRestriction = {
  id: string;
  restriction_type: BookingRestriction["restrictionType"];
  value: BookingRestriction["value"];
  start_date: string | null;
  end_date: string | null;
  room_type_id: string | null;
};

type DbAvailabilityClosure = {
  id: string;
  property_id: string;
  room_type_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type DbAvailabilitySeasonalPrice = {
  id: string;
  room_type_id: string;
  name: string | null;
  price: number;
  start_date: string;
  end_date: string;
};

const fromDbRoomType = (row: DbAvailabilityRoomType): AvailabilityRoomType => ({
  id: row.id,
  maxOccupancy: row.max_occupancy,
  minOccupancy: row.min_occupancy ?? undefined,
  maxChildren: row.max_children ?? undefined,
  categoryId: row.category_id ?? undefined,
  isVisible: true,
});

const fromDbRoom = (row: DbAvailabilityRoom): AvailabilityRoom => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  status: row.status,
});

const fromDbReservation = (
  row: DbAvailabilityReservation,
): AvailabilityReservation => ({
  id: row.id,
  roomId: row.room_id,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  status: row.status,
});

const fromDbRestriction = (
  row: DbAvailabilityRestriction,
): BookingRestriction => ({
  id: row.id,
  restrictionType: row.restriction_type,
  value: row.value,
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
  roomTypeId: row.room_type_id ?? undefined,
});

const fromDbClosure = (row: DbAvailabilityClosure): PropertyClosure => ({
  id: row.id,
  propertyId: row.property_id,
  roomTypeId: row.room_type_id ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason ?? undefined,
});

const fromDbSeasonalPrice = (
  row: DbAvailabilitySeasonalPrice,
): SeasonalPrice => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  name: row.name ?? "",
  price: row.price,
  startDate: row.start_date,
  endDate: row.end_date,
});

const throwIfQueryError = (table: string, error: unknown) => {
  if (error) {
    throw new Error(`Failed to load ${table} for availability search`);
  }
};

const normalizeRoomTypeScope = (roomTypeIds: string[] | undefined) =>
  Array.from(new Set((roomTypeIds ?? []).map((id) => id.trim()).filter(Boolean)));

export async function searchPublicAvailability(
  input: PublicAvailabilitySearchInput,
): Promise<AvailabilitySearchResult> {
  const supabase = createServerSupabaseClient();
  const scopedRoomTypeIds = normalizeRoomTypeScope(input.roomTypeIds);
  const hasRoomTypeScope = scopedRoomTypeIds.length > 0;

  let roomTypesQuery = supabase
    .from("room_types")
    .select(PUBLIC_AVAILABILITY_ROOM_TYPE_SELECT)
    .neq("is_visible", false);
  if (hasRoomTypeScope) {
    roomTypesQuery = roomTypesQuery.in("id", scopedRoomTypeIds);
  }

  let roomsQuery = supabase
    .from("rooms")
    .select(PUBLIC_AVAILABILITY_ROOM_SELECT)
    .in("status", [...BOOKABLE_ROOM_STATUSES]);
  if (hasRoomTypeScope) {
    roomsQuery = roomsQuery.in("room_type_id", scopedRoomTypeIds);
  }

  const restrictionsQuery = supabase
    .from("booking_restrictions")
    .select(PUBLIC_AVAILABILITY_RESTRICTION_SELECT);
  const closuresQuery = supabase
    .from("property_closures")
    .select(PUBLIC_AVAILABILITY_CLOSURE_SELECT)
    .lt("start_date", input.checkOut)
    .gte("end_date", input.checkIn);
  const reservationsQuery = supabase
    .from("reservations")
    .select(PUBLIC_AVAILABILITY_RESERVATION_SELECT)
    .neq("status", "Cancelled")
    .lt("check_in_date", input.checkOut)
    .gt("check_out_date", input.checkIn);

  const [
    roomTypesResponse,
    roomsResponse,
    restrictionsResponse,
    closuresResponse,
    unscopedReservationsResponse,
  ] = await Promise.all([
    roomTypesQuery,
    roomsQuery,
    restrictionsQuery,
    closuresQuery,
    hasRoomTypeScope ? Promise.resolve(null) : reservationsQuery,
  ]);

  throwIfQueryError("room types", roomTypesResponse.error);
  throwIfQueryError("rooms", roomsResponse.error);
  throwIfQueryError("booking restrictions", restrictionsResponse.error);
  throwIfQueryError("property closures", closuresResponse.error);

  const roomRows = (roomsResponse.data ?? []) as DbAvailabilityRoom[];
  let reservationRows =
    (unscopedReservationsResponse?.data ?? []) as DbAvailabilityReservation[];
  let reservationsError = unscopedReservationsResponse?.error ?? null;
  if (hasRoomTypeScope) {
    const scopedRoomIds = roomRows.map((row) => row.id).filter(Boolean);
    if (scopedRoomIds.length > 0) {
      const scopedReservationsResponse = await reservationsQuery.in(
        "room_id",
        scopedRoomIds,
      );
      reservationRows =
        (scopedReservationsResponse.data ?? []) as DbAvailabilityReservation[];
      reservationsError = scopedReservationsResponse.error;
    } else {
      reservationRows = [];
      reservationsError = null;
    }
  }

  throwIfQueryError("reservations", reservationsError);

  const result = computeAvailabilitySearchResult({
    checkIn: new Date(`${input.checkIn}T00:00:00`),
    checkOut: new Date(`${input.checkOut}T00:00:00`),
    roomOccupancies: input.roomOccupancies,
    categoryIds: input.categoryIds,
    roomTypes: ((roomTypesResponse.data ?? []) as DbAvailabilityRoomType[]).map(
      fromDbRoomType,
    ),
    rooms: roomRows.map(fromDbRoom),
    reservations: reservationRows.map(fromDbReservation),
    restrictions: (
      (restrictionsResponse.data ?? []) as DbAvailabilityRestriction[]
    ).map(fromDbRestriction),
    closures: ((closuresResponse.data ?? []) as DbAvailabilityClosure[]).map(
      fromDbClosure,
    ),
  });

  const seasonalRoomTypeIds = Array.from(
    new Set([
      ...result.availableRoomTypeIds,
      ...result.roomTypeAvailability.map((item) => item.roomTypeId),
    ]),
  ).sort();

  if (seasonalRoomTypeIds.length === 0) {
    return result;
  }

  const seasonalPricesResponse = await supabase
    .from("seasonal_prices")
    .select(PUBLIC_AVAILABILITY_SEASONAL_PRICE_SELECT)
    .in("room_type_id", seasonalRoomTypeIds)
    .lte("start_date", input.checkIn)
    .gte("end_date", input.checkIn);

  throwIfQueryError("seasonal prices", seasonalPricesResponse.error);

  return {
    ...result,
    seasonalPrices: (
      (seasonalPricesResponse.data ?? []) as DbAvailabilitySeasonalPrice[]
    ).map(fromDbSeasonalPrice),
  };
}
