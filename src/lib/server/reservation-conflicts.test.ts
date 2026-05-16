import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  getAdminReservationConflictingRoomIds,
  RESERVATION_CONFLICT_ROOM_SELECT,
} from "./reservation-conflicts";

type QueryRecorder = {
  select: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  result: Promise<{ data: unknown[]; error: null }>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};

function createQuery(data: unknown[]): QueryRecorder {
  const query = {
    select: vi.fn(),
    neq: vi.fn(),
    lt: vi.fn(),
    gt: vi.fn(),
    result: Promise.resolve({ data, error: null }),
  } as QueryRecorder;

  query.select.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.then = query.result.then.bind(query.result);

  return query;
}

describe("getAdminReservationConflictingRoomIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects only room ids for overlapping non-cancelled reservations", async () => {
    const query = createQuery([
      { room_id: "room-2" },
      { room_id: "room-1" },
      { room_id: "room-2" },
    ]);
    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => query),
    });

    await expect(
      getAdminReservationConflictingRoomIds({
        checkIn: "2026-06-10",
        checkOut: "2026-06-12",
      }),
    ).resolves.toEqual(["room-2", "room-1"]);

    expect(query.select).toHaveBeenCalledWith(RESERVATION_CONFLICT_ROOM_SELECT);
    expect(query.neq).toHaveBeenCalledWith("status", "Cancelled");
    expect(query.neq).toHaveBeenCalledWith("status", "No-show");
    expect(query.lt).toHaveBeenCalledWith("check_in_date", "2026-06-12");
    expect(query.gt).toHaveBeenCalledWith("check_out_date", "2026-06-10");
  });
});
