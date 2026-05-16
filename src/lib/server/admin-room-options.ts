import "server-only";

import type { Room } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_ROOM_OPTIONS_SELECT = "id, room_number" as const;

export type AdminRoomOption = Pick<Room, "id" | "roomNumber">;

type DbRoomOption = {
  id: string;
  room_number: string;
};

export async function getAdminRoomOptions(): Promise<AdminRoomOption[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(ADMIN_ROOM_OPTIONS_SELECT)
    .order("room_number", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load room options");
  }

  return ((data ?? []) as DbRoomOption[]).map((room) => ({
    id: room.id,
    roomNumber: room.room_number,
  }));
}
