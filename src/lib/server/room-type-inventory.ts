import "server-only";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { BOOKABLE_ROOM_STATUSES } from "@/lib/rooms";

export const ROOM_TYPE_INVENTORY_SELECT_COLUMNS = "id" as const;

export type PublicRoomTypeInventory = {
  roomTypeId: string;
  totalBookableRooms: number;
};

export async function getPublicRoomTypeInventory(
  roomTypeId: string,
): Promise<PublicRoomTypeInventory> {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from("rooms")
    .select(ROOM_TYPE_INVENTORY_SELECT_COLUMNS, {
      count: "exact",
      head: true,
    })
    .eq("room_type_id", roomTypeId)
    .in("status", BOOKABLE_ROOM_STATUSES);

  if (error) {
    throw new Error("Failed to load room type inventory");
  }

  return {
    roomTypeId,
    totalBookableRooms: count ?? 0,
  };
}
