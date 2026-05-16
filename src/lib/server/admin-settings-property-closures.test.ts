import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  ADMIN_SETTINGS_PROPERTY_CLOSURES_SELECT,
  ADMIN_SETTINGS_ROOM_TYPE_OPTIONS_SELECT,
  getAdminSettingsPropertyClosuresData,
} from "./admin-settings-property-closures";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminSettingsPropertyClosuresData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads closures and room type labels with narrow ordered selects", async () => {
    const closuresQuery = createQuery([
      {
        id: "closure-1",
        property_id: "property-1",
        room_type_id: "room-type-1",
        start_date: "2026-06-01",
        end_date: "2026-06-03",
        reason: "Maintenance",
      },
    ]);
    const roomTypesQuery = createQuery([
      { id: "room-type-1", name: "Ganga View" },
    ]);
    const fromMock = vi.fn((table: string) => {
      if (table === "property_closures") return closuresQuery;
      if (table === "room_types") return roomTypesQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    createServerSupabaseClientMock.mockReturnValue({ from: fromMock });

    await expect(getAdminSettingsPropertyClosuresData()).resolves.toEqual({
      propertyClosures: [
        {
          id: "closure-1",
          propertyId: "property-1",
          roomTypeId: "room-type-1",
          startDate: "2026-06-01",
          endDate: "2026-06-03",
          reason: "Maintenance",
        },
      ],
      roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
    });

    expect(closuresQuery.select).toHaveBeenCalledWith(
      ADMIN_SETTINGS_PROPERTY_CLOSURES_SELECT,
    );
    expect(closuresQuery.order).toHaveBeenCalledWith("start_date", {
      ascending: true,
    });
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      ADMIN_SETTINGS_ROOM_TYPE_OPTIONS_SELECT,
    );
    expect(roomTypesQuery.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });
});
