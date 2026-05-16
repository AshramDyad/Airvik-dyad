import "server-only";

import type { PropertyClosure, RoomType } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_SETTINGS_PROPERTY_CLOSURES_SELECT =
  "id, property_id, room_type_id, start_date, end_date, reason" as const;
export const ADMIN_SETTINGS_ROOM_TYPE_OPTIONS_SELECT = "id, name" as const;

type DbPropertyClosure = {
  id: string;
  property_id: string;
  room_type_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type RoomTypeOption = Pick<RoomType, "id" | "name">;

export type AdminSettingsPropertyClosuresData = {
  propertyClosures: PropertyClosure[];
  roomTypes: RoomTypeOption[];
};

const mapPropertyClosure = (row: DbPropertyClosure): PropertyClosure => ({
  id: row.id,
  propertyId: row.property_id,
  roomTypeId: row.room_type_id ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason ?? undefined,
});

export async function getAdminSettingsPropertyClosuresData(): Promise<AdminSettingsPropertyClosuresData> {
  const supabase = createServerSupabaseClient();
  const [closuresResult, roomTypesResult] = await Promise.all([
    supabase
      .from("property_closures")
      .select(ADMIN_SETTINGS_PROPERTY_CLOSURES_SELECT)
      .order("start_date", { ascending: true }),
    supabase
      .from("room_types")
      .select(ADMIN_SETTINGS_ROOM_TYPE_OPTIONS_SELECT)
      .order("name", { ascending: true }),
  ]);

  if (closuresResult.error) {
    throw new Error(
      closuresResult.error.message || "Failed to load property closures",
    );
  }
  if (roomTypesResult.error) {
    throw new Error(
      roomTypesResult.error.message || "Failed to load room type options",
    );
  }

  return {
    propertyClosures: ((closuresResult.data ?? []) as DbPropertyClosure[]).map(
      mapPropertyClosure,
    ),
    roomTypes: ((roomTypesResult.data ?? []) as RoomTypeOption[]).map(
      (roomType) => ({
        id: roomType.id,
        name: roomType.name,
      }),
    ),
  };
}
