import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_ROOM_CATEGORIES_SELECT,
  getAdminRoomCategories,
} from "./admin-room-categories";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminRoomCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only category table fields in stable name order", async () => {
    const query = createQuery([
      { id: "category-1", name: "Standard", description: null },
      { id: "category-2", name: "Suite", description: "Large rooms" },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("room_categories");
        return query;
      }),
    });

    await expect(getAdminRoomCategories()).resolves.toEqual([
      { id: "category-1", name: "Standard", description: "" },
      { id: "category-2", name: "Suite", description: "Large rooms" },
    ]);

    expect(query.select).toHaveBeenCalledWith(ADMIN_ROOM_CATEGORIES_SELECT);
    expect(query.order).toHaveBeenCalledWith("name", { ascending: true });
  });
});
