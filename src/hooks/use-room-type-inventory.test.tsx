import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRoomTypeInventory } from "./use-room-type-inventory";

describe("useRoomTypeInventory", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              roomTypeId: "room-type-1",
              totalBookableRooms: 3,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches only the selected room type inventory", async () => {
    const { result } = renderHook(() => useRoomTypeInventory("room-type-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith("/api/room-types/room-type-1/inventory", {
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(result.current.totalBookableRooms).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch inventory until a room type id exists", () => {
    const { result } = renderHook(() => useRoomTypeInventory(undefined));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.totalBookableRooms).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});
