"use client";

import * as React from "react";

import type {
  PublicRoomTypeDetail,
  PublicRoomTypeDetailResponse,
} from "@/lib/room-types/detail";

type UseRoomTypeDetailResult = {
  detail: PublicRoomTypeDetail | null;
  isLoading: boolean;
  error: Error | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useRoomTypeDetail(
  roomTypeId: string | null | undefined,
): UseRoomTypeDetailResult {
  const normalizedRoomTypeId = roomTypeId?.trim() ?? "";
  const [detail, setDetail] = React.useState<PublicRoomTypeDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(Boolean(normalizedRoomTypeId));
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!normalizedRoomTypeId) {
      setDetail(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    fetch(`/api/room-types/${encodeURIComponent(normalizedRoomTypeId)}/detail`, {
      cache: "force-cache",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | PublicRoomTypeDetailResponse
          | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Failed to load room details");
        }

        return payload?.data ?? null;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetail(data);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError) || controller.signal.aborted) {
          return;
        }

        setDetail(null);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load room details"),
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
  }, [normalizedRoomTypeId]);

  return { detail, isLoading, error };
}
