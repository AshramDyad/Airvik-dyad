import "server-only";

import { unstable_cache } from "next/cache";

import type {
  Amenity,
  PropertyClosure,
  RatePlan,
  RoomType,
  SeasonalPrice,
} from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type { PublicRoomTypeDetail } from "@/lib/room-types/detail";

export const PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_SELECT =
  "id, name, description, max_occupancy, min_occupancy, max_children, category_id, bed_types, price, photos, main_photo_url, is_visible" as const;
export const PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_AMENITY_SELECT =
  "room_type_id, amenity_id" as const;
export const PUBLIC_ROOM_TYPE_DETAIL_AMENITY_SELECT =
  "id, name, icon" as const;
export const PUBLIC_ROOM_TYPE_DETAIL_RATE_PLAN_SELECT =
  "id, name, price, rules" as const;
export const PUBLIC_ROOM_TYPE_DETAIL_SEASONAL_PRICE_SELECT =
  "id, room_type_id, name, price, start_date, end_date" as const;
export const PUBLIC_ROOM_TYPE_DETAIL_CLOSURE_SELECT =
  "id, property_id, room_type_id, start_date, end_date, reason" as const;
export const PUBLIC_ROOM_TYPE_DETAIL_CACHE_TAG = "public-room-type-detail";
export const PUBLIC_ROOM_TYPE_DETAIL_REVALIDATE_SECONDS = 3600;

type DbRoomTypeDetail = {
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

type DbRoomTypeAmenity = {
  room_type_id: string;
  amenity_id: string;
};

type DbAmenity = {
  id: string;
  name: string;
  icon: string | null;
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

const fromDbAmenity = (row: DbAmenity): Amenity => ({
  id: row.id,
  name: row.name,
  icon: row.icon ?? "HelpCircle",
});

const buildRoomTypeMapper =
  (amenityIdsByRoomTypeId: Map<string, string[]>) =>
  (row: DbRoomTypeDetail): RoomType => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    maxOccupancy: row.max_occupancy,
    minOccupancy: row.min_occupancy ?? undefined,
    maxChildren: row.max_children ?? undefined,
    categoryId: row.category_id ?? undefined,
    bedTypes: row.bed_types ?? [],
    price: row.price ?? 0,
    amenities: amenityIdsByRoomTypeId.get(row.id) ?? [],
    photos: row.photos ?? [],
    mainPhotoUrl: row.main_photo_url ?? undefined,
    isVisible: row.is_visible ?? true,
  });

const throwIfError = (error: unknown, message: string) => {
  if (!error) {
    return;
  }
  throw new Error(message);
};

const getFallbackRatePlan = async (): Promise<RatePlan | null> => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("rate_plans")
    .select(PUBLIC_ROOM_TYPE_DETAIL_RATE_PLAN_SELECT)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  throwIfError(error, "Failed to load fallback room rate plan");
  return data ? fromDbRatePlan(data as DbRatePlan) : null;
};

export async function getPublicRoomTypeDetail(
  roomTypeId: string,
): Promise<PublicRoomTypeDetail | null> {
  const normalizedRoomTypeId = roomTypeId.trim();
  if (!normalizedRoomTypeId) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data: selectedRoomType, error: selectedRoomTypeError } =
    await supabase
      .from("room_types")
      .select(PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_SELECT)
      .eq("id", normalizedRoomTypeId)
      .neq("is_visible", false)
      .maybeSingle();

  throwIfError(selectedRoomTypeError, "Failed to load selected room type");

  if (!selectedRoomType) {
    return null;
  }

  const [
    relatedRoomTypesResponse,
    standardRatePlanResponse,
    seasonalPricesResponse,
    closuresResponse,
  ] = await Promise.all([
    supabase
      .from("room_types")
      .select(PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_SELECT)
      .neq("id", normalizedRoomTypeId)
      .neq("is_visible", false)
      .order("name", { ascending: true })
      .limit(3),
    supabase
      .from("rate_plans")
      .select(PUBLIC_ROOM_TYPE_DETAIL_RATE_PLAN_SELECT)
      .eq("name", "Standard Rate")
      .maybeSingle(),
    supabase
      .from("seasonal_prices")
      .select(PUBLIC_ROOM_TYPE_DETAIL_SEASONAL_PRICE_SELECT)
      .eq("room_type_id", normalizedRoomTypeId)
      .order("start_date", { ascending: true }),
    supabase
      .from("property_closures")
      .select(PUBLIC_ROOM_TYPE_DETAIL_CLOSURE_SELECT)
      .or(`room_type_id.is.null,room_type_id.eq.${normalizedRoomTypeId}`)
      .order("start_date", { ascending: true }),
  ]);

  throwIfError(relatedRoomTypesResponse.error, "Failed to load related room types");
  throwIfError(
    standardRatePlanResponse.error,
    "Failed to load standard room rate plan",
  );
  throwIfError(seasonalPricesResponse.error, "Failed to load room seasonal prices");
  throwIfError(closuresResponse.error, "Failed to load room property closures");

  const selectedRow = selectedRoomType as DbRoomTypeDetail;
  const relatedRows = (relatedRoomTypesResponse.data ?? []) as DbRoomTypeDetail[];
  const roomTypeRows = [selectedRow, ...relatedRows];
  const roomTypeIds = roomTypeRows.map((row) => row.id);

  const { data: roomTypeAmenityRows, error: roomTypeAmenitiesError } =
    await supabase
      .from("room_type_amenities")
      .select(PUBLIC_ROOM_TYPE_DETAIL_ROOM_TYPE_AMENITY_SELECT)
      .in("room_type_id", roomTypeIds);

  throwIfError(
    roomTypeAmenitiesError,
    "Failed to load room type amenity links",
  );

  const roomTypeAmenities = (roomTypeAmenityRows ?? []) as DbRoomTypeAmenity[];
  const amenityIds = Array.from(
    new Set(roomTypeAmenities.map((row) => row.amenity_id).filter(Boolean)),
  ).sort();
  const amenityIdsByRoomTypeId = new Map<string, string[]>();

  roomTypeAmenities.forEach((row) => {
    const current = amenityIdsByRoomTypeId.get(row.room_type_id) ?? [];
    amenityIdsByRoomTypeId.set(row.room_type_id, [...current, row.amenity_id]);
  });

  let amenities: Amenity[] = [];
  if (amenityIds.length > 0) {
    const { data: amenityRows, error: amenitiesError } = await supabase
      .from("amenities")
      .select(PUBLIC_ROOM_TYPE_DETAIL_AMENITY_SELECT)
      .in("id", amenityIds);

    throwIfError(amenitiesError, "Failed to load room amenity labels");
    amenities = ((amenityRows ?? []) as DbAmenity[]).map(fromDbAmenity);
  }

  const mapRoomType = buildRoomTypeMapper(amenityIdsByRoomTypeId);
  const standardRatePlan = standardRatePlanResponse.data
    ? fromDbRatePlan(standardRatePlanResponse.data as DbRatePlan)
    : await getFallbackRatePlan();

  return {
    roomType: mapRoomType(selectedRow),
    relatedRoomTypes: relatedRows.map(mapRoomType),
    amenities,
    standardRatePlan,
    seasonalPrices: ((seasonalPricesResponse.data ?? []) as DbSeasonalPrice[]).map(
      fromDbSeasonalPrice,
    ),
    propertyClosures: ((closuresResponse.data ?? []) as DbPropertyClosure[]).map(
      fromDbClosure,
    ),
  };
}

export const getCachedPublicRoomTypeDetail = unstable_cache(
  getPublicRoomTypeDetail,
  ["public-room-type-detail"],
  {
    revalidate: PUBLIC_ROOM_TYPE_DETAIL_REVALIDATE_SECONDS,
    tags: [PUBLIC_ROOM_TYPE_DETAIL_CACHE_TAG],
  },
);
