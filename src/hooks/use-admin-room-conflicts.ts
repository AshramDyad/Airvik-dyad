"use client";

import * as React from "react";

import { authorizedFetch } from "@/lib/auth/client-session";

type UseAdminRoomConflictsArgs = {
  checkIn?: string;
  checkOut?: string;
  excludeBookingId?: string;
};

type ConflictState = {
  key: string | null;
  roomIds: Set<string>;
};

export function useAdminRoomConflicts({
  checkIn,
  checkOut,
  excludeBookingId,
}: UseAdminRoomConflictsArgs) {
  const [state, setState] = React.useState<ConflictState>({
    key: null,
    roomIds: new Set(),
  });
  const [isFetching, setIsFetching] = React.useState(false);
  const requestKey =
    checkIn && checkOut
      ? `${checkIn}:${checkOut}:${excludeBookingId ?? ""}`
      : null;

  React.useEffect(() => {
    if (!checkIn || !checkOut || !requestKey) {
      setState({ key: null, roomIds: new Set() });
      setIsFetching(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ checkIn, checkOut });
    if (excludeBookingId) {
      params.set("excludeBookingId", excludeBookingId);
    }

    setIsFetching(true);

    authorizedFetch(`/api/admin/availability/conflicts?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response
          .json()
          .catch(() => null) as {
            data?: { roomIds?: string[] };
            message?: string;
          } | null;

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load room conflicts");
        }

        setState({
          key: requestKey,
          roomIds: new Set(payload?.data?.roomIds ?? []),
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load room conflicts:", error);
        setState({ key: requestKey, roomIds: new Set() });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFetching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [checkIn, checkOut, excludeBookingId, requestKey]);

  const isStale = Boolean(requestKey && state.key !== requestKey);

  return {
    conflictingRoomIds: state.roomIds,
    isLoading: Boolean(requestKey && (isFetching || isStale)),
  };
}
