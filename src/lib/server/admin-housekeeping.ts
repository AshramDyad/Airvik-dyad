import "server-only";

import { ROLE_NAMES } from "@/constants/roles";
import type { HousekeepingAssignment, Room, User } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const ADMIN_HOUSEKEEPING_ROOMS_SELECT =
  "id, room_number, room_type_id, status" as const;
export const ADMIN_HOUSEKEEPING_ROOM_TYPES_SELECT = "id, name" as const;
export const ADMIN_HOUSEKEEPING_ASSIGNMENTS_SELECT =
  "roomId:room_id, assignedTo:assigned_to, date, status" as const;
export const ADMIN_HOUSEKEEPING_HOUSEKEEPERS_SELECT =
  "id, name, role_id, roles!inner(name)" as const;

export type AdminHousekeepingRoomType = {
  id: string;
  name: string;
};

export type AdminHousekeepingData = {
  rooms: Room[];
  roomTypes: AdminHousekeepingRoomType[];
  assignments: HousekeepingAssignment[];
  housekeepers: User[];
};

type DbHousekeepingRoom = {
  id: string;
  room_number: string;
  room_type_id: string;
  status: Room["status"];
};

type DbHousekeeperProfile = {
  id: string;
  name: string | null;
  role_id: string | null;
};

const fromDbHousekeepingRoom = (room: DbHousekeepingRoom): Room => ({
  id: room.id,
  roomNumber: room.room_number,
  roomTypeId: room.room_type_id,
  status: room.status,
});

const fromDbHousekeeper = (housekeeper: DbHousekeeperProfile): User => ({
  id: housekeeper.id,
  name: housekeeper.name ?? "Housekeeper",
  email: "",
  roleId: housekeeper.role_id ?? "",
});

export async function getAdminHousekeepingData(
  date: string,
): Promise<AdminHousekeepingData> {
  const supabase = createServerSupabaseClient();

  const [roomsResult, roomTypesResult, assignmentsResult, housekeepersResult] =
    await Promise.all([
      supabase
        .from("rooms")
        .select(ADMIN_HOUSEKEEPING_ROOMS_SELECT)
        .order("room_number", { ascending: true }),
      supabase
        .from("room_types")
        .select(ADMIN_HOUSEKEEPING_ROOM_TYPES_SELECT)
        .order("name", { ascending: true }),
      supabase
        .from("housekeeping_assignments")
        .select(ADMIN_HOUSEKEEPING_ASSIGNMENTS_SELECT)
        .eq("date", date)
        .order("room_id", { ascending: true }),
      supabase
        .from("profiles")
        .select(ADMIN_HOUSEKEEPING_HOUSEKEEPERS_SELECT)
        .eq("roles.name", ROLE_NAMES.HOUSEKEEPER)
        .order("name", { ascending: true }),
    ]);

  if (roomsResult.error) {
    throw new Error(roomsResult.error.message || "Failed to load rooms");
  }

  if (roomTypesResult.error) {
    throw new Error(
      roomTypesResult.error.message || "Failed to load room type labels",
    );
  }

  if (assignmentsResult.error) {
    throw new Error(
      assignmentsResult.error.message ||
        "Failed to load housekeeping assignments",
    );
  }

  if (housekeepersResult.error) {
    throw new Error(
      housekeepersResult.error.message || "Failed to load housekeepers",
    );
  }

  return {
    rooms: ((roomsResult.data ?? []) as DbHousekeepingRoom[]).map(
      fromDbHousekeepingRoom,
    ),
    roomTypes: (roomTypesResult.data ?? []) as AdminHousekeepingRoomType[],
    assignments: (assignmentsResult.data ?? []) as HousekeepingAssignment[],
    housekeepers: (
      (housekeepersResult.data ?? []) as DbHousekeeperProfile[]
    ).map(fromDbHousekeeper),
  };
}
