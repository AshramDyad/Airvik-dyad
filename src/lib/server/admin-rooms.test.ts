import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_ROOM_TYPE_SUMMARIES_SELECT,
  ADMIN_ROOMS_SELECT,
  getAdminRoomsData,
} from "./admin-rooms";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminRoomsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only room table fields and compact room type summaries", async () => {
    const roomsQuery = createQuery([
      {
        id: "room-1",
        room_number: "101",
        room_type_id: "type-1",
        status: "Clean",
        photos: ["room.jpg"],
      },
    ]);
    const roomTypesQuery = createQuery([
      {
        id: "type-1",
        name: "Ganga View",
        main_photo_url: "type-main.jpg",
      },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getAdminRoomsData()).resolves.toEqual({
      rooms: [
        {
          id: "room-1",
          roomNumber: "101",
          roomTypeId: "type-1",
          status: "Clean",
          photos: ["room.jpg"],
        },
      ],
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          mainPhotoUrl: "type-main.jpg",
        },
      ],
    });

    expect(roomsQuery.select).toHaveBeenCalledWith(ADMIN_ROOMS_SELECT);
    expect(roomsQuery.order).toHaveBeenCalledWith("room_number", {
      ascending: true,
    });
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      ADMIN_ROOM_TYPE_SUMMARIES_SELECT,
    );
    expect(ADMIN_ROOM_TYPE_SUMMARIES_SELECT).not.toContain("photos");
    expect(roomTypesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });
});
