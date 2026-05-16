import "server-only";

import type { Room } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_ROOMS_SELECT =
  "id, room_number, room_type_id, status, photos" as const;
export const ADMIN_ROOM_TYPE_SUMMARIES_SELECT =
  "id, name, main_photo_url" as const;

export type AdminRoomTypeSummary = {
  id: string;
  name: string;
  mainPhotoUrl?: string;
};

export type AdminRoomsData = {
  rooms: Room[];
  roomTypes: AdminRoomTypeSummary[];
};

type DbAdminRoom = {
  id: string;
  room_number: string;
  room_type_id: string;
  status: Room["status"];
  photos: string[] | null;
};

type DbAdminRoomTypeSummary = {
  id: string;
  name: string;
  main_photo_url: string | null;
};

const fromDbAdminRoom = (room: DbAdminRoom): Room => ({
  id: room.id,
  roomNumber: room.room_number,
  roomTypeId: room.room_type_id,
  status: room.status,
  photos: room.photos ?? undefined,
});

const fromDbAdminRoomTypeSummary = (
  roomType: DbAdminRoomTypeSummary,
): AdminRoomTypeSummary => ({
  id: roomType.id,
  name: roomType.name,
  mainPhotoUrl: roomType.main_photo_url ?? undefined,
});

export async function getAdminRoomsData(): Promise<AdminRoomsData> {
  const supabase = createServerSupabaseClient();

  const [roomsResult, roomTypesResult] = await Promise.all([
    supabase
      .from("rooms")
      .select(ADMIN_ROOMS_SELECT)
      .order("room_number", { ascending: true }),
    supabase
      .from("room_types")
      .select(ADMIN_ROOM_TYPE_SUMMARIES_SELECT)
      .order("name", { ascending: true }),
  ]);

  if (roomsResult.error) {
    throw new Error(roomsResult.error.message || "Failed to load rooms");
  }

  if (roomTypesResult.error) {
    throw new Error(
      roomTypesResult.error.message || "Failed to load room type summaries",
    );
  }

  return {
    rooms: ((roomsResult.data ?? []) as DbAdminRoom[]).map(fromDbAdminRoom),
    roomTypes: (
      (roomTypesResult.data ?? []) as DbAdminRoomTypeSummary[]
    ).map(fromDbAdminRoomTypeSummary),
  };
}
