import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useAdminRoomConflicts } from "./use-admin-room-conflicts";

describe("useAdminRoomConflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { roomIds: ["room-2", "room-1"] } }), {
        status: 200,
      }),
    );
  });

  it("loads date-scoped conflicting room ids through the admin API", async () => {
    const { result } = renderHook(() =>
      useAdminRoomConflicts({
        checkIn: "2026-06-10",
        checkOut: "2026-06-12",
        excludeBookingId: "booking-1",
      }),
    );

    await waitFor(() =>
      expect(result.current.conflictingRoomIds).toEqual(
        new Set(["room-2", "room-1"]),
      ),
    );

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/availability/conflicts?checkIn=2026-06-10&checkOut=2026-06-12&excludeBookingId=booking-1",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("skips the API while dates are incomplete", () => {
    const { result } = renderHook(() =>
      useAdminRoomConflicts({
        checkIn: "2026-06-10",
        checkOut: undefined,
      }),
    );

    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(result.current.conflictingRoomIds).toEqual(new Set());
    expect(result.current.isLoading).toBe(false);
  });
});
