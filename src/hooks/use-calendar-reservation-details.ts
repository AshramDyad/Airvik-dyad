"use client";

import * as React from "react";

import type {
  CalendarReservationDetail,
  CalendarReservationDetailsResponse,
} from "@/lib/calendar/reservation-details";
import { authorizedFetch } from "@/lib/auth/client-session";

type UseCalendarReservationDetailsResult = {
  details: CalendarReservationDetail[];
  detailsById: Map<string, CalendarReservationDetail>;
  isLoading: boolean;
  error: Error | null;
};

const normalizeReservationIds = (reservationIds: string[]) =>
  Array.from(
    new Set(reservationIds.map((id) => id.trim()).filter(Boolean)),
  ).sort();

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useCalendarReservationDetails(
  reservationIds: string[],
): UseCalendarReservationDetailsResult {
  const idsKey = React.useMemo(
    () => normalizeReservationIds(reservationIds).join(","),
    [reservationIds],
  );
  const [details, setDetails] = React.useState<CalendarReservationDetail[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!idsKey) {
      setDetails([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ ids: idsKey });

    setIsLoading(true);
    setError(null);

    authorizedFetch(`/api/admin/reservations/calendar-details?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(
            payload?.message ?? "Failed to load calendar reservation details",
          );
        }

        return (await response.json()) as CalendarReservationDetailsResponse;
      })
      .then((payload) => {
        setDetails(payload.data ?? []);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError)) {
          return;
        }

        setDetails([]);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load calendar reservation details"),
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
  }, [idsKey]);

  const detailsById = React.useMemo(() => {
    return new Map(details.map((detail) => [detail.id, detail]));
  }, [details]);

  return { details, detailsById, isLoading, error };
}
