import { describe, expect, it, vi } from "vitest";

import { assignAvailableRoomsForRoomTypes } from "./room-assignment";
import type { Room, RoomType } from "@/data/types";

const rooms = [
  { id: "room-1", roomTypeId: "type-1", status: "Clean" },
  { id: "room-2", roomTypeId: "type-1", status: "Dirty" },
  { id: "room-3", roomTypeId: "type-1", status: "Maintenance" },
] satisfies Array<Pick<Room, "id" | "roomTypeId" | "status">>;

const roomType = { id: "type-1" } satisfies Pick<RoomType, "id">;

describe("assignAvailableRoomsForRoomTypes", () => {
  it("skips unavailable candidate rooms and assigns the next valid room", async () => {
    const validateRoom = vi.fn(async ({ room }: { room: Pick<Room, "id"> }) => {
      return room.id !== "room-1";
    });

    const result = await assignAvailableRoomsForRoomTypes({
      rooms,
      selectedRoomTypes: [roomType],
      validateRoom,
    });

    expect(result).toEqual({
      allRoomsFound: true,
      assignedRoomIds: ["room-2"],
    });
    expect(validateRoom).toHaveBeenCalledTimes(2);
  });

  it("does not assign the same physical room twice for duplicate room types", async () => {
    const validateRoom = vi.fn(async () => true);

    const result = await assignAvailableRoomsForRoomTypes({
      rooms,
      selectedRoomTypes: [roomType, roomType],
      validateRoom,
    });

    expect(result).toEqual({
      allRoomsFound: true,
      assignedRoomIds: ["room-1", "room-2"],
    });
    expect(validateRoom).toHaveBeenCalledTimes(2);
  });

  it("reports failure when no bookable candidate can satisfy a requested room type", async () => {
    const validateRoom = vi.fn(async () => false);

    const result = await assignAvailableRoomsForRoomTypes({
      rooms,
      selectedRoomTypes: [roomType],
      validateRoom,
    });

    expect(result).toEqual({
      allRoomsFound: false,
      assignedRoomIds: [],
    });
  });
});
