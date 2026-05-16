import "server-only";

import { unstable_cache } from "next/cache";

import type {
  PropertyClosure,
  RatePlan,
  RoomType,
  SeasonalPrice,
} from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type { PublicBookingReviewData } from "@/lib/booking/review";

export const PUBLIC_BOOKING_REVIEW_ROOM_TYPE_SELECT =
  "id, name, description, max_occupancy, min_occupancy, max_children, category_id, bed_types, price, photos, main_photo_url, is_visible" as const;
export const PUBLIC_BOOKING_REVIEW_RATE_PLAN_SELECT =
  "id, name, price, rules" as const;
export const PUBLIC_BOOKING_REVIEW_SEASONAL_PRICE_SELECT =
  "id, room_type_id, name, price, start_date, end_date" as const;
export const PUBLIC_BOOKING_REVIEW_CLOSURE_SELECT =
  "id, property_id, room_type_id, start_date, end_date, reason" as const;
export const PUBLIC_BOOKING_REVIEW_CACHE_TAG = "public-booking-review-data";
export const PUBLIC_BOOKING_REVIEW_REVALIDATE_SECONDS = 3600;

export type PublicBookingReviewInput = {
  roomTypeIds: string[];
  checkIn: string;
  checkOut: string;
};

type DbRoomType = {
  id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
  min_occupancy: number | null;
  max_children: number | null;
  category_id: string | null;
  bed_types: string[] | null;
  price: number | null;
  photos: string[] | null;
  main_photo_url: string | null;
  is_visible: boolean | null;
};

type DbRatePlan = {
  id: string;
  name: string;
  price: number | null;
  rules: RatePlan["rules"] | null;
};

type DbSeasonalPrice = {
  id: string;
  room_type_id: string;
  name: string;
  price: number;
  start_date: string;
  end_date: string;
};

type DbPropertyClosure = {
  id: string;
  property_id: string;
  room_type_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
};

const defaultRateRules: RatePlan["rules"] = {
  minStay: 1,
  cancellationPolicy: "",
};

const fromDbRoomType = (row: DbRoomType): RoomType => ({
  id: row.id,
  name: row.name,
  description: row.description ?? "",
  maxOccupancy: row.max_occupancy,
  minOccupancy: row.min_occupancy ?? undefined,
  maxChildren: row.max_children ?? undefined,
  categoryId: row.category_id ?? undefined,
  bedTypes: row.bed_types ?? [],
  price: row.price ?? 0,
  amenities: [],
  photos: row.photos ?? [],
  mainPhotoUrl: row.main_photo_url ?? undefined,
  isVisible: row.is_visible ?? true,
});

const fromDbRatePlan = (row: DbRatePlan): RatePlan => ({
  id: row.id,
  name: row.name,
  price: row.price ?? 0,
  rules: row.rules ?? defaultRateRules,
});

const fromDbSeasonalPrice = (row: DbSeasonalPrice): SeasonalPrice => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  name: row.name,
  price: row.price,
  startDate: row.start_date,
  endDate: row.end_date,
});

const fromDbClosure = (row: DbPropertyClosure): PropertyClosure => ({
  id: row.id,
  propertyId: row.property_id,
  roomTypeId: row.room_type_id ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason ?? undefined,
});

const throwIfError = (error: unknown, message: string) => {
  if (!error) {
    return;
  }
  throw new Error(message);
};

const normalizeRoomTypeIds = (roomTypeIds: string[]) =>
  Array.from(new Set(roomTypeIds.map((id) => id.trim()).filter(Boolean)));

const getFallbackRatePlan = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<RatePlan | null> => {
  const { data, error } = await supabase
    .from("rate_plans")
    .select(PUBLIC_BOOKING_REVIEW_RATE_PLAN_SELECT)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  throwIfError(error, "Failed to load fallback booking rate plan");
  return data ? fromDbRatePlan(data as DbRatePlan) : null;
};

export async function getPublicBookingReviewData({
  roomTypeIds,
  checkIn,
  checkOut,
}: PublicBookingReviewInput): Promise<PublicBookingReviewData> {
  const uniqueRoomTypeIds = normalizeRoomTypeIds(roomTypeIds);
  if (!uniqueRoomTypeIds.length || !checkIn || !checkOut) {
    return {
      roomTypes: [],
      ratePlan: null,
      seasonalPrices: [],
      propertyClosures: [],
    };
  }

  const supabase = createServerSupabaseClient();
  const [
    roomTypesResponse,
    standardRatePlanResponse,
    seasonalPricesResponse,
    closuresResponse,
  ] = await Promise.all([
    supabase
      .from("room_types")
      .select(PUBLIC_BOOKING_REVIEW_ROOM_TYPE_SELECT)
      .in("id", uniqueRoomTypeIds)
      .neq("is_visible", false),
    supabase
      .from("rate_plans")
      .select(PUBLIC_BOOKING_REVIEW_RATE_PLAN_SELECT)
      .eq("name", "Standard Rate")
      .maybeSingle(),
    supabase
      .from("seasonal_prices")
      .select(PUBLIC_BOOKING_REVIEW_SEASONAL_PRICE_SELECT)
      .in("room_type_id", uniqueRoomTypeIds)
      .lte("start_date", checkIn)
      .gte("end_date", checkIn),
    supabase
      .from("property_closures")
      .select(PUBLIC_BOOKING_REVIEW_CLOSURE_SELECT)
      .lt("start_date", checkOut)
      .gte("end_date", checkIn),
  ]);

  throwIfError(roomTypesResponse.error, "Failed to load selected room types");
  throwIfError(
    standardRatePlanResponse.error,
    "Failed to load standard booking rate plan",
  );
  throwIfError(
    seasonalPricesResponse.error,
    "Failed to load selected room seasonal prices",
  );
  throwIfError(closuresResponse.error, "Failed to load selected room closures");

  const selectedRoomTypeIdSet = new Set(uniqueRoomTypeIds);
  const propertyClosures = ((closuresResponse.data ?? []) as DbPropertyClosure[])
    .filter(
      (closure) =>
        !closure.room_type_id || selectedRoomTypeIdSet.has(closure.room_type_id),
    )
    .map(fromDbClosure);
  const ratePlan = standardRatePlanResponse.data
    ? fromDbRatePlan(standardRatePlanResponse.data as DbRatePlan)
    : await getFallbackRatePlan(supabase);

  return {
    roomTypes: ((roomTypesResponse.data ?? []) as DbRoomType[]).map(fromDbRoomType),
    ratePlan,
    seasonalPrices: ((seasonalPricesResponse.data ?? []) as DbSeasonalPrice[]).map(
      fromDbSeasonalPrice,
    ),
    propertyClosures,
  };
}

const normalizeCacheKeyInput = (
  roomTypeIdsKey: string,
  checkIn: string,
  checkOut: string,
): PublicBookingReviewInput => ({
  roomTypeIds: roomTypeIdsKey.split(",").filter(Boolean),
  checkIn,
  checkOut,
});

const cachedPublicBookingReviewData = unstable_cache(
  async (roomTypeIdsKey: string, checkIn: string, checkOut: string) =>
    getPublicBookingReviewData(
      normalizeCacheKeyInput(roomTypeIdsKey, checkIn, checkOut),
    ),
  ["public-booking-review-data"],
  {
    revalidate: PUBLIC_BOOKING_REVIEW_REVALIDATE_SECONDS,
    tags: [PUBLIC_BOOKING_REVIEW_CACHE_TAG],
  },
);

export function getCachedPublicBookingReviewData(
  input: PublicBookingReviewInput,
): Promise<PublicBookingReviewData> {
  return cachedPublicBookingReviewData(
    normalizeRoomTypeIds(input.roomTypeIds).join(","),
    input.checkIn,
    input.checkOut,
  );
}
