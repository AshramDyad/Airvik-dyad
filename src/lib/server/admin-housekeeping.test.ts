import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { ROLE_NAMES } from "@/constants/roles";
import {
  ADMIN_HOUSEKEEPING_ASSIGNMENTS_SELECT,
  ADMIN_HOUSEKEEPING_HOUSEKEEPERS_SELECT,
  ADMIN_HOUSEKEEPING_ROOMS_SELECT,
  ADMIN_HOUSEKEEPING_ROOM_TYPES_SELECT,
  getAdminHousekeepingData,
} from "./admin-housekeeping";

function createQuery(data: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  return query;
}

describe("getAdminHousekeepingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads compact room, room type, assignment, and housekeeper fields", async () => {
    const roomsQuery = createQuery([
      {
        id: "room-1",
        room_number: "101",
        room_type_id: "type-1",
        status: "Dirty",
      },
    ]);
    const roomTypesQuery = createQuery([{ id: "type-1", name: "Ganga View" }]);
    const assignmentsQuery = createQuery([
      {
        roomId: "room-1",
        assignedTo: "user-1",
        date: "2026-05-13",
        status: "Pending",
      },
    ]);
    const housekeepersQuery = createQuery([
      { id: "user-1", name: "Anita", role_id: "role-housekeeper" },
    ]);

    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "rooms") return roomsQuery;
        if (table === "room_types") return roomTypesQuery;
        if (table === "housekeeping_assignments") return assignmentsQuery;
        if (table === "profiles") return housekeepersQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getAdminHousekeepingData("2026-05-13")).resolves.toEqual({
      rooms: [
        {
          id: "room-1",
          roomNumber: "101",
          roomTypeId: "type-1",
          status: "Dirty",
        },
      ],
      roomTypes: [{ id: "type-1", name: "Ganga View" }],
      assignments: [
        {
          roomId: "room-1",
          assignedTo: "user-1",
          date: "2026-05-13",
          status: "Pending",
        },
      ],
      housekeepers: [
        { id: "user-1", name: "Anita", email: "", roleId: "role-housekeeper" },
      ],
    });

    expect(roomsQuery.select).toHaveBeenCalledWith(ADMIN_HOUSEKEEPING_ROOMS_SELECT);
    expect(roomsQuery.order).toHaveBeenCalledWith("room_number", {
      ascending: true,
    });
    expect(roomTypesQuery.select).toHaveBeenCalledWith(
      ADMIN_HOUSEKEEPING_ROOM_TYPES_SELECT,
    );
    expect(assignmentsQuery.select).toHaveBeenCalledWith(
      ADMIN_HOUSEKEEPING_ASSIGNMENTS_SELECT,
    );
    expect(assignmentsQuery.eq).toHaveBeenCalledWith("date", "2026-05-13");
    expect(housekeepersQuery.select).toHaveBeenCalledWith(
      ADMIN_HOUSEKEEPING_HOUSEKEEPERS_SELECT,
    );
    expect(housekeepersQuery.eq).toHaveBeenCalledWith(
      "roles.name",
      ROLE_NAMES.HOUSEKEEPER,
    );
  });
});
