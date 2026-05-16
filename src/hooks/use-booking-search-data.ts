"use client";

import * as React from "react";

import type {
  PublicBookingSearchData,
  PublicBookingSearchDataResponse,
} from "@/lib/booking/search";

type UseBookingSearchDataResult = {
  bookingSearchData: PublicBookingSearchData | null;
  isLoading: boolean;
  error: Error | null;
};

const emptySearchData: PublicBookingSearchData = {
  roomTypes: [],
  amenities: [],
  ratePlan: null,
  propertyClosures: [],
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useBookingSearchData(
  enabled = true,
): UseBookingSearchDataResult {
  const [bookingSearchData, setBookingSearchData] =
    React.useState<PublicBookingSearchData | null>(null);
  const [isLoading, setIsLoading] = React.useState(enabled);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setBookingSearchData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch("/api/bookings/search-data", {
      cache: "force-cache",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | PublicBookingSearchDataResponse
          | null;

        if (!response.ok) {
          throw new Error("Failed to load booking search data");
        }

        return payload?.data ?? emptySearchData;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setBookingSearchData(data);
        }
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError) || controller.signal.aborted) {
          return;
        }

        setBookingSearchData(emptySearchData);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load booking search data"),
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

  return { bookingSearchData, isLoading, error };
}
