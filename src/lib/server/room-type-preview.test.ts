import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getRoomTypePreviews,
  PUBLIC_AMENITY_PREVIEW_SELECT_COLUMNS,
  PUBLIC_ROOM_TYPE_AMENITY_PREVIEW_SELECT_COLUMNS,
  PUBLIC_ROOM_TYPE_PREVIEW_CANDIDATE_SELECT_COLUMNS,
  PUBLIC_ROOM_TYPE_PREVIEW_SELECT_COLUMNS,
} from "./room-type-preview";

const createRoomTypeCandidatesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(async () => response),
  };
  return query;
};

const createRoomTypeDetailsQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(async () => response),
  };
  return query;
};

const createRoomTypeAmenitiesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(async () => response),
  };
  return query;
};

const createAmenitiesQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(async () => response),
  };
  return query;
};

describe("room type preview server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns four compact visible room previews with targeted amenity lookups", async () => {
    const roomTypeCandidatesQuery = createRoomTypeCandidatesQuery({
      data: [
        {
          id: "other",
          name: "Other Room",
          is_visible: true,
        },
        {
          id: "brahmbhoj",
          name: "Brahmbhoj",
          is_visible: true,
        },
        {
          id: "annadaan",
          name: "AnnaDaan",
          is_visible: true,
        },
      ],
      error: null,
    });
    const roomTypeDetailsQuery = createRoomTypeDetailsQuery({
      data: [
        {
          id: "brahmbhoj",
          name: "Brahmbhoj",
          description: "Featured room",
          photos: [],
          main_photo_url: "/brahm.jpg",
        },
        {
          id: "annadaan",
          name: "AnnaDaan",
          description: "Featured stay",
          photos: ["/anna-fallback.jpg"],
          main_photo_url: "/anna.jpg",
        },
      ],
      error: null,
    });
    const roomTypeAmenitiesQuery = createRoomTypeAmenitiesQuery({
      data: [
        { room_type_id: "annadaan", amenity_id: "wifi" },
        { room_type_id: "annadaan", amenity_id: "bath" },
        { room_type_id: "brahmbhoj", amenity_id: "wifi" },
      ],
      error: null,
    });
    const amenitiesQuery = createAmenitiesQuery({
      data: [
        { id: "wifi", name: "Wifi", icon: "Wifi" },
        { id: "bath", name: "Bath", icon: "Bath" },
      ],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(roomTypeCandidatesQuery)
      .mockReturnValueOnce(roomTypeDetailsQuery)
      .mockReturnValueOnce(roomTypeAmenitiesQuery)
      .mockReturnValueOnce(amenitiesQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(getRoomTypePreviews()).resolves.toEqual([
      {
        id: "annadaan",
        name: "AnnaDaan",
        description: "Featured stay",
        imageUrl: "/anna.jpg",
        amenities: [
          { id: "wifi", name: "Wifi", icon: "Wifi" },
          { id: "bath", name: "Bath", icon: "Bath" },
        ],
      },
      {
        id: "brahmbhoj",
        name: "Brahmbhoj",
        description: "Featured room",
        imageUrl: "/brahm.jpg",
        amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
      },
    ]);

    expect(from).toHaveBeenNthCalledWith(1, "room_types");
    expect(roomTypeCandidatesQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_PREVIEW_CANDIDATE_SELECT_COLUMNS,
    );
    expect(roomTypeCandidatesQuery.neq).toHaveBeenCalledWith("is_visible", false);
    expect(roomTypeCandidatesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });

    expect(from).toHaveBeenNthCalledWith(2, "room_types");
    expect(roomTypeDetailsQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_PREVIEW_SELECT_COLUMNS,
    );
    expect(roomTypeDetailsQuery.in).toHaveBeenCalledWith("id", [
      "annadaan",
      "brahmbhoj",
    ]);

    expect(from).toHaveBeenNthCalledWith(3, "room_type_amenities");
    expect(roomTypeAmenitiesQuery.select).toHaveBeenCalledWith(
      PUBLIC_ROOM_TYPE_AMENITY_PREVIEW_SELECT_COLUMNS,
    );
    expect(roomTypeAmenitiesQuery.in).toHaveBeenCalledWith("room_type_id", [
      "annadaan",
      "brahmbhoj",
    ]);

    expect(from).toHaveBeenNthCalledWith(4, "amenities");
    expect(amenitiesQuery.select).toHaveBeenCalledWith(
      PUBLIC_AMENITY_PREVIEW_SELECT_COLUMNS,
    );
    expect(amenitiesQuery.in).toHaveBeenCalledWith("id", ["bath", "wifi"]);
  });
});
