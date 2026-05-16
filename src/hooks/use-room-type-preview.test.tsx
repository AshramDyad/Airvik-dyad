import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRoomTypePreview } from "./use-room-type-preview";

describe("useRoomTypePreview", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "annadaan",
              name: "AnnaDaan",
              description: "Featured stay",
              imageUrl: "/anna.jpg",
              amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches compact room previews through the public API", async () => {
    const { result } = renderHook(() => useRoomTypePreview());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/room-types/preview",
      expect.objectContaining({
        cache: "force-cache",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.roomTypes).toEqual([
      {
        id: "annadaan",
        name: "AnnaDaan",
        description: "Featured stay",
        imageUrl: "/anna.jpg",
        amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
      },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("can defer the preview request until the UI is opened", () => {
    const { result } = renderHook(() => useRoomTypePreview(false));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.roomTypes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
