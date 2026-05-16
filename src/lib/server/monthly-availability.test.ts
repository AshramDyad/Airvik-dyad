import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cacheMocks = vi.hoisted(() => ({
  unstable_cache: vi.fn((fn) => fn),
}));
const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("next/cache", () => cacheMocks);
vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getCachedMonthlyAvailability,
  MONTHLY_AVAILABILITY_REVALIDATE_SECONDS,
} from "./monthly-availability";
import { RESERVATIONS_CACHE_TAG } from "@/server/reservations/cache";

describe("monthly availability server data access", () => {
  beforeEach(() => {
    supabaseMocks.createServerSupabaseClient.mockReset();
  });

  it("caches monthly availability RPC reads under the reservations cache tag", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          room_type_id: "room-type-1",
          room_type: {
            id: "room-type-1",
            name: "Deluxe",
            description: "",
            rooms: [],
            units: 0,
            sharedInventory: false,
          },
          availability: [],
        },
      ],
      error: null,
    }));
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ rpc });

    await expect(
      getCachedMonthlyAvailability("2026-05-01", ["rt-2", "rt-1"]),
    ).resolves.toEqual([
      {
        roomType: {
          id: "room-type-1",
          name: "Deluxe",
          description: "",
          rooms: [],
          units: 0,
          sharedInventory: false,
        },
        availability: [],
      },
    ]);

    expect(cacheMocks.unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      ["monthly-availability"],
      {
        revalidate: MONTHLY_AVAILABILITY_REVALIDATE_SECONDS,
        tags: [RESERVATIONS_CACHE_TAG],
      },
    );
    expect(rpc).toHaveBeenCalledWith("get_monthly_availability", {
      p_month_start: "2026-05-01",
      p_room_type_ids: ["rt-1", "rt-2"],
    });
  });
});
