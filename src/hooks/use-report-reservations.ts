"use client";

import * as React from "react";
import { format } from "date-fns";

import { authorizedFetch } from "@/lib/auth/client-session";
import type {
  ReportReservation,
  ReportReservationsResponse,
} from "@/lib/reports/report-reservations";

type UseReportReservationsArgs = {
  from?: Date;
  to?: Date;
};

type UseReportReservationsResult = {
  reservations: ReportReservation[];
  roomsForSaleCount: number;
  isLoading: boolean;
  error: Error | null;
};

const toDateParam = (date: Date) => format(date, "yyyy-MM-dd");

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useReportReservations({
  from,
  to,
}: UseReportReservationsArgs): UseReportReservationsResult {
  const [reservations, setReservations] = React.useState<ReportReservation[]>([]);
  const [roomsForSaleCount, setRoomsForSaleCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const fromParam = React.useMemo(() => (from ? toDateParam(from) : null), [from]);
  const toParam = React.useMemo(() => (to ? toDateParam(to) : null), [to]);

  React.useEffect(() => {
    if (!fromParam || !toParam) {
      setReservations([]);
      setRoomsForSaleCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      from: fromParam,
      to: toParam,
    });

    setIsLoading(true);
    setError(null);

    authorizedFetch(`/api/admin/reports/reservations?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? "Failed to load report reservations");
        }

        return (await response.json()) as ReportReservationsResponse;
      })
      .then((payload) => {
        setReservations(payload.data ?? []);
        setRoomsForSaleCount(payload.roomsForSaleCount ?? 0);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError)) {
          return;
        }

        setReservations([]);
        setRoomsForSaleCount(0);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load report reservations"),
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
  }, [fromParam, toParam]);

  return { reservations, roomsForSaleCount, isLoading, error };
}
