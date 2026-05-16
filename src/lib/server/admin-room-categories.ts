import "server-only";

import type { RoomCategory } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_ROOM_CATEGORIES_SELECT = "id, name, description" as const;

type DbRoomCategory = {
  id: string;
  name: string;
  description: string | null;
};

export async function getAdminRoomCategories(): Promise<RoomCategory[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("room_categories")
    .select(ADMIN_ROOM_CATEGORIES_SELECT)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load room categories");
  }

  return ((data ?? []) as DbRoomCategory[]).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description ?? "",
  }));
}
