import type { HousekeepingAssignment, Room, User } from "@/data/types";

export type AdminHousekeepingRoomType = {
  id: string;
  name: string;
};

export type HousekeepingRoomWithDetails = Room & {
  roomTypeName: string;
  assignment?: HousekeepingAssignment;
  housekeeperName?: string;
};

export type AdminHousekeepingData = {
  rooms: Room[];
  roomTypes: AdminHousekeepingRoomType[];
  assignments: HousekeepingAssignment[];
  housekeepers: User[];
};
