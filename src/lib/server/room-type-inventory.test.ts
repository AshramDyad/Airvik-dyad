import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getPublicRoomTypeInventory,
  ROOM_TYPE_INVENTORY_SELECT_COLUMNS,
} from "./room-type-inventory";

const createInventoryQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(async () => response),
  };
  return query;
};

describe("room type inventory server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts only bookable rooms for one room type without returning room rows", async () => {
    const query = createInventoryQuery({
      data: null,
      count: 3,
      error: null,
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(getPublicRoomTypeInventory("room-type-1")).resolves.toEqual({
      roomTypeId: "room-type-1",
      totalBookableRooms: 3,
    });

    expect(query.from).toHaveBeenCalledWith("rooms");
    expect(query.select).toHaveBeenCalledWith(ROOM_TYPE_INVENTORY_SELECT_COLUMNS, {
      count: "exact",
      head: true,
    });
    expect(query.eq).toHaveBeenCalledWith("room_type_id", "room-type-1");
    expect(query.in).toHaveBeenCalledWith("status", [
      "Clean",
      "Dirty",
      "Inspected",
    ]);
  });
});
