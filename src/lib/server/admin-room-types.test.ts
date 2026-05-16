import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_ROOM_TYPE_AMENITIES_SELECT,
  ADMIN_ROOM_TYPE_AMENITY_OPTIONS_SELECT,
  ADMIN_ROOM_TYPES_SELECT,
  getAdminRoomTypesData,
} from "./admin-room-types";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminRoomTypesData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads room types with amenity ids and compact amenity options", async () => {
    const roomTypesQuery = createQuery([
      {
        id: "type-1",
        name: "Ganga View",
        description: "River-facing room",
        max_occupancy: 2,
        bed_types: ["King"],
        price: 2400,
        photos: ["room-type.jpg"],
        main_photo_url: "main.jpg",
        is_visible: true,
      },
    ]);
    const roomTypeAmenitiesQuery = createQuery([
      { room_type_id: "type-1", amenity_id: "amenity-1" },
    ]);
    const amenitiesQuery = createQuery([
      { id: "amenity-1", name: "Wifi" },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "room_types") return roomTypesQuery;
        if (table === "room_type_amenities") return roomTypeAmenitiesQuery;
        if (table === "amenities") return amenitiesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getAdminRoomTypesData()).resolves.toEqual({
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          description: "River-facing room",
          maxOccupancy: 2,
          bedTypes: ["King"],
          price: 2400,
          amenities: ["amenity-1"],
          photos: ["room-type.jpg"],
          mainPhotoUrl: "main.jpg",
          isVisible: true,
        },
      ],
      amenities: [{ id: "amenity-1", name: "Wifi" }],
    });

    expect(roomTypesQuery.select).toHaveBeenCalledWith(ADMIN_ROOM_TYPES_SELECT);
    expect(roomTypesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
    expect(roomTypeAmenitiesQuery.select).toHaveBeenCalledWith(
      ADMIN_ROOM_TYPE_AMENITIES_SELECT,
    );
    expect(roomTypeAmenitiesQuery.order).toHaveBeenCalledWith("room_type_id", {
      ascending: true,
    });
    expect(amenitiesQuery.select).toHaveBeenCalledWith(
      ADMIN_ROOM_TYPE_AMENITY_OPTIONS_SELECT,
    );
    expect(ADMIN_ROOM_TYPE_AMENITY_OPTIONS_SELECT).toBe("id, name");
    expect(amenitiesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });
});
