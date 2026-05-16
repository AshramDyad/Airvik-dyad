"use client";

import * as React from "react";

type RoomTypeInventoryPayload = {
  data?: {
    roomTypeId: string;
    totalBookableRooms: number;
  };
  message?: string;
};

type RoomTypeInventoryState = {
  totalBookableRooms: number | undefined;
  isLoading: boolean;
  error: Error | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useRoomTypeInventory(
  roomTypeId: string | null | undefined,
): RoomTypeInventoryState {
  const [state, setState] = React.useState<RoomTypeInventoryState>(() => ({
    totalBookableRooms: undefined,
    isLoading: Boolean(roomTypeId),
    error: null,
  }));

  React.useEffect(() => {
    if (!roomTypeId) {
      setState({
        totalBookableRooms: undefined,
        isLoading: false,
        error: null,
      });
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    setState({
      totalBookableRooms: undefined,
      isLoading: true,
      error: null,
    });

    fetch(`/api/room-types/${encodeURIComponent(roomTypeId)}/inventory`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | RoomTypeInventoryPayload
          | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Failed to load room inventory");
        }

        return payload?.data;
      })
      .then((data) => {
        if (!isActive) return;
        setState({
          totalBookableRooms: data?.totalBookableRooms ?? 0,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!isActive || isAbortError(error)) return;
        setState({
          totalBookableRooms: undefined,
          isLoading: false,
          error:
            error instanceof Error
              ? error
              : new Error("Failed to load room inventory"),
        });
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [roomTypeId]);

  return state;
}
