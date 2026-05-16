import "server-only";

import type { RoomType } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_ROOM_TYPES_SELECT =
  "id, name, description, max_occupancy, bed_types, price, photos, main_photo_url, is_visible" as const;
export const ADMIN_ROOM_TYPE_AMENITIES_SELECT =
  "room_type_id, amenity_id" as const;
export const ADMIN_ROOM_TYPE_AMENITY_OPTIONS_SELECT = "id, name" as const;

export type AdminRoomTypeAmenityOption = {
  id: string;
  name: string;
};

export type AdminRoomTypesData = {
  roomTypes: RoomType[];
  amenities: AdminRoomTypeAmenityOption[];
};

type DbAdminRoomType = {
  id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
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

const fromDbAdminRoomType = (
  roomType: DbAdminRoomType,
  amenityIds: string[],
): RoomType => ({
  id: roomType.id,
  name: roomType.name,
  description: roomType.description ?? "",
  maxOccupancy: roomType.max_occupancy,
  bedTypes: roomType.bed_types ?? [],
  price: roomType.price ?? 0,
  amenities: amenityIds,
  photos: roomType.photos ?? [],
  mainPhotoUrl: roomType.main_photo_url ?? undefined,
  isVisible: roomType.is_visible ?? true,
});

export async function getAdminRoomTypesData(): Promise<AdminRoomTypesData> {
  const supabase = createServerSupabaseClient();

  const [roomTypesResult, roomTypeAmenitiesResult, amenitiesResult] =
    await Promise.all([
      supabase
        .from("room_types")
        .select(ADMIN_ROOM_TYPES_SELECT)
        .order("name", { ascending: true }),
      supabase
        .from("room_type_amenities")
        .select(ADMIN_ROOM_TYPE_AMENITIES_SELECT)
        .order("room_type_id", { ascending: true }),
      supabase
        .from("amenities")
        .select(ADMIN_ROOM_TYPE_AMENITY_OPTIONS_SELECT)
        .order("name", { ascending: true }),
    ]);

  if (roomTypesResult.error) {
    throw new Error(
      roomTypesResult.error.message || "Failed to load room types",
    );
  }

  if (roomTypeAmenitiesResult.error) {
    throw new Error(
      roomTypeAmenitiesResult.error.message ||
        "Failed to load room type amenities",
    );
  }

  if (amenitiesResult.error) {
    throw new Error(
      amenitiesResult.error.message || "Failed to load amenity options",
    );
  }

  const amenityIdsByRoomType = new Map<string, string[]>();
  ((roomTypeAmenitiesResult.data ?? []) as DbRoomTypeAmenity[]).forEach(
    (row) => {
      const existing = amenityIdsByRoomType.get(row.room_type_id) ?? [];
      existing.push(row.amenity_id);
      amenityIdsByRoomType.set(row.room_type_id, existing);
    },
  );

  return {
    roomTypes: ((roomTypesResult.data ?? []) as DbAdminRoomType[]).map(
      (roomType) =>
        fromDbAdminRoomType(
          roomType,
          amenityIdsByRoomType.get(roomType.id) ?? [],
        ),
    ),
    amenities: (amenitiesResult.data ?? []) as AdminRoomTypeAmenityOption[],
  };
}
