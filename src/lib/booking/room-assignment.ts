import type { Room, RoomType } from "@/data/types";
import { isBookableRoom } from "@/lib/rooms";

type AssignmentRoom = Pick<Room, "id" | "roomTypeId" | "status">;
type AssignmentRoomType = Pick<RoomType, "id">;

export type RoomValidationContext = {
  room: AssignmentRoom;
  roomType: AssignmentRoomType;
  index: number;
};

export type AssignAvailableRoomsArgs = {
  rooms: AssignmentRoom[];
  selectedRoomTypes: AssignmentRoomType[];
  validateRoom: (context: RoomValidationContext) => Promise<boolean>;
};

export type AssignAvailableRoomsResult = {
  assignedRoomIds: string[];
  allRoomsFound: boolean;
};

export async function assignAvailableRoomsForRoomTypes({
  rooms,
  selectedRoomTypes,
  validateRoom,
}: AssignAvailableRoomsArgs): Promise<AssignAvailableRoomsResult> {
  const assignedRoomIds: string[] = [];

  for (const [index, roomType] of selectedRoomTypes.entries()) {
    const candidates = rooms.filter(
      (room) =>
        room.roomTypeId === roomType.id &&
        isBookableRoom(room) &&
        !assignedRoomIds.includes(room.id),
    );

    let assignedRoomId: string | null = null;

    for (const room of candidates) {
      const isAvailable = await validateRoom({ room, roomType, index });
      if (isAvailable) {
        assignedRoomId = room.id;
        break;
      }
    }

    if (!assignedRoomId) {
      return {
        assignedRoomIds,
        allRoomsFound: false,
      };
    }

    assignedRoomIds.push(assignedRoomId);
  }

  return {
    assignedRoomIds,
    allRoomsFound: true,
  };
}
