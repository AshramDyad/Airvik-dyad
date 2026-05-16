import "server-only";

import { unstable_cache } from "next/cache";

import type { Amenity, RatePlan, RoomType } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type {
  PublicBookingClosure,
  PublicBookingSearchData,
} from "@/lib/booking/search";

export const PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT =
  "id, name, description, max_occupancy, bed_types, price, photos, main_photo_url" as const;
export const PUBLIC_BOOKING_SEARCH_ROOM_TYPE_AMENITY_SELECT =
  "room_type_id, amenity_id" as const;
export const PUBLIC_BOOKING_SEARCH_AMENITY_SELECT = "id, name, icon" as const;
export const PUBLIC_BOOKING_SEARCH_RATE_PLAN_SELECT =
  "id, name, price, rules" as const;
export const PUBLIC_BOOKING_SEARCH_CLOSURE_SELECT =
  "start_date, end_date" as const;
export const PUBLIC_BOOKING_SEARCH_CACHE_TAG = "public-booking-search-data";
export const PUBLIC_BOOKING_SEARCH_REVALIDATE_SECONDS = 3600;

type DbBookingSearchRoomType = {
  id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
  bed_types: string[] | null;
  price: number | null;
  photos: string[] | null;
  main_photo_url: string | null;
};

type DbBookingSearchRoomTypeAmenity = {
  room_type_id: string;
  amenity_id: string;
};

type DbBookingSearchAmenity = {
  id: string;
  name: string;
  icon: string | null;
};

type DbBookingSearchRatePlan = {
  id: string;
  name: string;
  price: number | null;
  rules: RatePlan["rules"] | null;
};

type DbBookingSearchClosure = {
  start_date: string;
  end_date: string;
};

const defaultRateRules: RatePlan["rules"] = {
  minStay: 1,
  cancellationPolicy: "",
};

const fromDbAmenity = (row: DbBookingSearchAmenity): Amenity => ({
  id: row.id,
  name: row.name,
  icon: row.icon ?? "HelpCircle",
});

const fromDbRatePlan = (row: DbBookingSearchRatePlan): RatePlan => ({
  id: row.id,
  name: row.name,
  price: row.price ?? 0,
  rules: row.rules ?? defaultRateRules,
});

const fromDbClosure = (row: DbBookingSearchClosure): PublicBookingClosure => ({
  startDate: row.start_date,
  endDate: row.end_date,
});

const mapRoomType =
  (amenityIdsByRoomTypeId: Map<string, string[]>) =>
  (row: DbBookingSearchRoomType): RoomType => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    maxOccupancy: row.max_occupancy,
    bedTypes: row.bed_types ?? [],
    price: row.price ?? 0,
    amenities: amenityIdsByRoomTypeId.get(row.id) ?? [],
    photos: row.photos ?? [],
    mainPhotoUrl: row.main_photo_url ?? undefined,
    isVisible: true,
  });

const throwIfError = (error: unknown, message: string) => {
  if (error) {
    throw new Error(message);
  }
};

const getFallbackRatePlan = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<RatePlan | null> => {
  const { data, error } = await supabase
    .from("rate_plans")
    .select(PUBLIC_BOOKING_SEARCH_RATE_PLAN_SELECT)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  throwIfError(error, "Failed to load fallback booking rate plan");
  return data ? fromDbRatePlan(data as DbBookingSearchRatePlan) : null;
};

export async function getPublicBookingSearchData(
  todayDate: string,
): Promise<PublicBookingSearchData> {
  const supabase = createServerSupabaseClient();

  const [roomTypesResponse, closuresResponse, standardRatePlanResponse] =
    await Promise.all([
      supabase
        .from("room_types")
        .select(PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT)
        .neq("is_visible", false)
        .order("name", { ascending: true }),
      supabase
        .from("property_closures")
        .select(PUBLIC_BOOKING_SEARCH_CLOSURE_SELECT)
        .is("room_type_id", null)
        .gte("end_date", todayDate)
        .order("start_date", { ascending: true }),
      supabase
        .from("rate_plans")
        .select(PUBLIC_BOOKING_SEARCH_RATE_PLAN_SELECT)
        .eq("name", "Standard Rate")
        .maybeSingle(),
    ]);

  throwIfError(roomTypesResponse.error, "Failed to load booking room types");
  throwIfError(closuresResponse.error, "Failed to load booking closures");
  throwIfError(
    standardRatePlanResponse.error,
    "Failed to load booking rate plan",
  );

  const roomTypeRows =
    (roomTypesResponse.data ?? []) as DbBookingSearchRoomType[];
  const roomTypeIds = roomTypeRows.map((row) => row.id).filter(Boolean);

  let roomTypeAmenityRows: DbBookingSearchRoomTypeAmenity[] = [];
  if (roomTypeIds.length > 0) {
    const { data, error } = await supabase
      .from("room_type_amenities")
      .select(PUBLIC_BOOKING_SEARCH_ROOM_TYPE_AMENITY_SELECT)
      .in("room_type_id", roomTypeIds);

    throwIfError(error, "Failed to load booking room type amenities");
    roomTypeAmenityRows = (data ?? []) as DbBookingSearchRoomTypeAmenity[];
  }

  const amenityIds = Array.from(
    new Set(roomTypeAmenityRows.map((row) => row.amenity_id).filter(Boolean)),
  ).sort();

  let amenities: Amenity[] = [];
  if (amenityIds.length > 0) {
    const { data, error } = await supabase
      .from("amenities")
      .select(PUBLIC_BOOKING_SEARCH_AMENITY_SELECT)
      .in("id", amenityIds);

    throwIfError(error, "Failed to load booking amenity labels");
    amenities = ((data ?? []) as DbBookingSearchAmenity[]).map(fromDbAmenity);
  }

  const amenityIdsByRoomTypeId = new Map<string, string[]>();
  roomTypeAmenityRows.forEach((row) => {
    const current = amenityIdsByRoomTypeId.get(row.room_type_id) ?? [];
    amenityIdsByRoomTypeId.set(row.room_type_id, [...current, row.amenity_id]);
  });

  return {
    roomTypes: roomTypeRows.map(mapRoomType(amenityIdsByRoomTypeId)),
    amenities,
    ratePlan: standardRatePlanResponse.data
      ? fromDbRatePlan(standardRatePlanResponse.data as DbBookingSearchRatePlan)
      : await getFallbackRatePlan(supabase),
    propertyClosures: (
      (closuresResponse.data ?? []) as DbBookingSearchClosure[]
    ).map(fromDbClosure),
  };
}

export const getCachedPublicBookingSearchData = unstable_cache(
  getPublicBookingSearchData,
  ["public-booking-search-data"],
  {
    revalidate: PUBLIC_BOOKING_SEARCH_REVALIDATE_SECONDS,
    tags: [PUBLIC_BOOKING_SEARCH_CACHE_TAG],
  },
);
