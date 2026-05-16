"use client";

import * as React from "react";

import type {
  RoomTypePreview,
  RoomTypePreviewResponse,
} from "@/lib/room-types/preview";

type UseRoomTypePreviewResult = {
  roomTypes: RoomTypePreview[];
  isLoading: boolean;
  error: Error | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useRoomTypePreview(enabled = true): UseRoomTypePreviewResult {
  const [roomTypes, setRoomTypes] = React.useState<RoomTypePreview[]>([]);
  const [isLoading, setIsLoading] = React.useState(enabled);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setRoomTypes([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    fetch("/api/room-types/preview", {
      cache: "force-cache",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | (Partial<RoomTypePreviewResponse> & { message?: string })
          | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Failed to load room previews");
        }

        return payload?.data ?? [];
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        setRoomTypes(data);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError) || controller.signal.aborted) {
          return;
        }

        setRoomTypes([]);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load room previews"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [enabled]);

  return { roomTypes, isLoading, error };
}
