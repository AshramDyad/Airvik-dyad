"use client";

import * as React from "react";

import { authorizedFetch } from "@/lib/auth/client-session";
import type {
  GuestReservationSummary,
  GuestReservationsResponse,
} from "@/lib/guests/reservations";

type UseGuestReservationsResult = {
  reservations: GuestReservationSummary[];
  isLoading: boolean;
  error: Error | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useGuestReservations(
  guestId: string | null | undefined,
): UseGuestReservationsResult {
  const [reservations, setReservations] = React.useState<GuestReservationSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!guestId) {
      setReservations([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    authorizedFetch(`/api/admin/guests/${encodeURIComponent(guestId)}/reservations`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? "Failed to load guest reservations");
        }

        return (await response.json()) as GuestReservationsResponse;
      })
      .then((payload) => {
        setReservations(payload.data ?? []);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError)) {
          return;
        }

        setReservations([]);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load guest reservations"),
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
  }, [guestId]);

  return { reservations, isLoading, error };
}
