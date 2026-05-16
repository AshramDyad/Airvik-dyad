import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_ROOM_OPTIONS_SELECT,
  getAdminRoomOptions,
} from "./admin-room-options";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminRoomOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only room ids and numbers in stable room-number order", async () => {
    const query = createQuery([
      { id: "room-2", room_number: "102" },
      { id: "room-1", room_number: "101" },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("rooms");
        return query;
      }),
    });

    await expect(getAdminRoomOptions()).resolves.toEqual([
      { id: "room-2", roomNumber: "102" },
      { id: "room-1", roomNumber: "101" },
    ]);

    expect(query.select).toHaveBeenCalledWith(ADMIN_ROOM_OPTIONS_SELECT);
    expect(query.order).toHaveBeenCalledWith("room_number", {
      ascending: true,
    });
  });
});
