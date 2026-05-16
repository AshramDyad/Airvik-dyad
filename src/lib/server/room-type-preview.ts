import "server-only";

import { unstable_cache } from "next/cache";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type {
  RoomTypePreview,
  RoomTypePreviewAmenity,
} from "@/lib/room-types/preview";

export const PUBLIC_ROOM_TYPE_PREVIEW_SELECT_COLUMNS =
  "id, name, description, photos, main_photo_url" as const;
export const PUBLIC_ROOM_TYPE_PREVIEW_CANDIDATE_SELECT_COLUMNS =
  "id, name, is_visible" as const;
export const PUBLIC_ROOM_TYPE_AMENITY_PREVIEW_SELECT_COLUMNS =
  "room_type_id, amenity_id" as const;
export const PUBLIC_AMENITY_PREVIEW_SELECT_COLUMNS =
  "id, name, icon" as const;
export const ROOM_TYPE_PREVIEW_CACHE_TAG = "room-type-previews";
export const ROOM_TYPE_PREVIEW_REVALIDATE_SECONDS = 3600;

const FEATURED_ROOM_TYPE_NAMES = [
  "AnnaDaan",
  "Sant Bhojan Donation",
  "Brahmbhoj",
  "VidhyaDan",
] as const;
const ROOM_TYPE_PREVIEW_LIMIT = 4;
const PLACEHOLDER_IMAGE = "/room-placeholder.svg";
const FALLBACK_IMAGES: Record<string, string> = {
  annadaan: "/annakshetra.png",
  "sant bhojan donation": "/Dining Hall.png",
  brahmbhoj: "/Spiritual Spaces.png",
  vidhyadan: "/gallery-room-05-2-1.png",
};

type RoomTypePreviewRow = {
  id: string;
  name: string;
  description: string | null;
  photos: string[] | null;
  main_photo_url: string | null;
};

type RoomTypePreviewCandidateRow = {
  id: string;
  name: string;
  is_visible: boolean | null;
};

type RoomTypeAmenityPreviewRow = {
  room_type_id: string;
  amenity_id: string;
};

type AmenityPreviewRow = {
  id: string;
  name: string;
  icon: string | null;
};

const normalizeName = (value: string) =>
  value.split("[")[0]?.trim().toLowerCase() ?? "";

const selectPreviewRows = (
  rows: RoomTypePreviewCandidateRow[],
): RoomTypePreviewCandidateRow[] => {
  const visibleRows = rows.filter((row) => row.is_visible !== false);
  const byName = new Map(
    visibleRows.map((row) => [normalizeName(row.name), row] as const),
  );
  const featuredRows = FEATURED_ROOM_TYPE_NAMES.map((name) =>
    byName.get(normalizeName(name)),
  ).filter((row): row is RoomTypePreviewCandidateRow => Boolean(row));

  if (featuredRows.length > 0) {
    return featuredRows.slice(0, ROOM_TYPE_PREVIEW_LIMIT);
  }

  return visibleRows.slice(0, ROOM_TYPE_PREVIEW_LIMIT);
};

const getRoomImageUrl = (row: RoomTypePreviewRow): string => {
  const normalizedKey = normalizeName(row.name);
  return (
    row.main_photo_url ??
    row.photos?.find((photo) => photo.trim().length > 0) ??
    FALLBACK_IMAGES[normalizedKey] ??
    PLACEHOLDER_IMAGE
  );
};

const mapAmenity = (
  amenityId: string,
  amenitiesById: Map<string, AmenityPreviewRow>,
): RoomTypePreviewAmenity | null => {
  const amenity = amenitiesById.get(amenityId);
  if (!amenity) {
    return null;
  }

  return {
    id: amenity.id,
    name: amenity.name,
    icon: amenity.icon ?? "HelpCircle",
  };
};

export async function getRoomTypePreviews(): Promise<RoomTypePreview[]> {
  const supabase = createServerSupabaseClient();
  const { data: candidateRows, error: roomTypesError } = await supabase
    .from("room_types")
    .select(PUBLIC_ROOM_TYPE_PREVIEW_CANDIDATE_SELECT_COLUMNS)
    .neq("is_visible", false)
    .order("name", { ascending: true });

  if (roomTypesError) {
    console.error("Error fetching public room type previews", roomTypesError);
    throw new Error("Failed to fetch room type previews");
  }

  const selectedCandidates = selectPreviewRows(
    ((candidateRows ?? []) as RoomTypePreviewCandidateRow[]).filter(
      (row) => Boolean(row.id && row.name),
    ),
  );
  const selectedCandidateIds = selectedCandidates.map((row) => row.id);

  if (selectedCandidateIds.length === 0) {
    return [];
  }

  const { data: roomTypeRows, error: roomTypeDetailsError } = await supabase
    .from("room_types")
    .select(PUBLIC_ROOM_TYPE_PREVIEW_SELECT_COLUMNS)
    .in("id", selectedCandidateIds);

  if (roomTypeDetailsError) {
    console.error(
      "Error fetching selected public room type preview details",
      roomTypeDetailsError,
    );
    throw new Error("Failed to fetch selected room type preview details");
  }

  const roomTypesById = new Map(
    ((roomTypeRows ?? []) as RoomTypePreviewRow[])
      .filter((row) => Boolean(row.id && row.name))
      .map((row) => [row.id, row] as const),
  );
  const selectedRows = selectedCandidateIds
    .map((id) => roomTypesById.get(id))
    .filter((row): row is RoomTypePreviewRow => Boolean(row));
  const selectedRoomTypeIds = selectedRows.map((row) => row.id);

  if (selectedRoomTypeIds.length === 0) {
    return [];
  }

  const { data: roomTypeAmenityRows, error: roomTypeAmenitiesError } =
    await supabase
      .from("room_type_amenities")
      .select(PUBLIC_ROOM_TYPE_AMENITY_PREVIEW_SELECT_COLUMNS)
      .in("room_type_id", selectedRoomTypeIds);

  if (roomTypeAmenitiesError) {
    console.error(
      "Error fetching public room type preview amenities",
      roomTypeAmenitiesError,
    );
    throw new Error("Failed to fetch room type preview amenities");
  }

  const roomTypeAmenities =
    (roomTypeAmenityRows ?? []) as RoomTypeAmenityPreviewRow[];
  const amenityIds = Array.from(
    new Set(roomTypeAmenities.map((row) => row.amenity_id).filter(Boolean)),
  ).sort();

  let amenitiesById = new Map<string, AmenityPreviewRow>();
  if (amenityIds.length > 0) {
    const { data: amenityRows, error: amenitiesError } = await supabase
      .from("amenities")
      .select(PUBLIC_AMENITY_PREVIEW_SELECT_COLUMNS)
      .in("id", amenityIds);

    if (amenitiesError) {
      console.error(
        "Error fetching public room type preview amenity labels",
        amenitiesError,
      );
      throw new Error("Failed to fetch room type preview amenity labels");
    }

    amenitiesById = new Map(
      ((amenityRows ?? []) as AmenityPreviewRow[]).map((amenity) => [
        amenity.id,
        amenity,
      ]),
    );
  }

  const amenitiesByRoomTypeId = new Map<string, RoomTypePreviewAmenity[]>();
  roomTypeAmenities.forEach((row) => {
    const mappedAmenity = mapAmenity(row.amenity_id, amenitiesById);
    if (!mappedAmenity) {
      return;
    }

    const current = amenitiesByRoomTypeId.get(row.room_type_id) ?? [];
    if (current.length >= 3) {
      return;
    }
    amenitiesByRoomTypeId.set(row.room_type_id, [...current, mappedAmenity]);
  });

  return selectedRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    imageUrl: getRoomImageUrl(row),
    amenities: amenitiesByRoomTypeId.get(row.id) ?? [],
  }));
}

export const getCachedRoomTypePreviews = unstable_cache(
  getRoomTypePreviews,
  ["room-type-previews"],
  {
    revalidate: ROOM_TYPE_PREVIEW_REVALIDATE_SECONDS,
    tags: [ROOM_TYPE_PREVIEW_CACHE_TAG],
  },
);
