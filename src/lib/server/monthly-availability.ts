import "server-only";

import { unstable_cache } from "next/cache";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import {
  mapMonthlyAvailabilityRow,
  type MonthlyAvailabilityRow,
} from "@/lib/availability";
import type { RoomTypeAvailability } from "@/data/types";
import { RESERVATIONS_CACHE_TAG } from "@/server/reservations/cache";

export const MONTHLY_AVAILABILITY_REVALIDATE_SECONDS = 60;

const normalizeRoomTypeKey = (roomTypeIds?: string[]) => {
  if (!roomTypeIds?.length) return "all";
  const normalized = Array.from(
    new Set(roomTypeIds.map((id) => id.trim()).filter(Boolean)),
  ).sort();
  return normalized.length > 0 ? normalized.join(",") : "all";
};

const parseRoomTypeKey = (roomTypeKey: string) =>
  roomTypeKey === "all"
    ? null
    : roomTypeKey
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

const fetchMonthlyAvailability = async (
  monthStart: string,
  roomTypeKey: string,
): Promise<RoomTypeAvailability[]> => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_monthly_availability", {
    p_month_start: monthStart,
    p_room_type_ids: parseRoomTypeKey(roomTypeKey),
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MonthlyAvailabilityRow[]).map(mapMonthlyAvailabilityRow);
};

const cachedMonthlyAvailability = unstable_cache(
  fetchMonthlyAvailability,
  ["monthly-availability"],
  {
    revalidate: MONTHLY_AVAILABILITY_REVALIDATE_SECONDS,
    tags: [RESERVATIONS_CACHE_TAG],
  },
);

export function getCachedMonthlyAvailability(
  monthStart: string,
  roomTypeIds?: string[],
): Promise<RoomTypeAvailability[]> {
  return cachedMonthlyAvailability(monthStart, normalizeRoomTypeKey(roomTypeIds));
}
