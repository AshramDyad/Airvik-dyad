"use client";

import * as React from "react";

import type {
  PublicBookingReviewData,
  PublicBookingReviewDataResponse,
} from "@/lib/booking/review";

type UseBookingReviewDataInput = {
  roomTypeIds: string[];
  checkIn: string | null;
  checkOut: string | null;
};

type UseBookingReviewDataResult = {
  reviewData: PublicBookingReviewData | null;
  isLoading: boolean;
  error: Error | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const buildReviewDataUrl = ({
  roomTypeIds,
  checkIn,
  checkOut,
}: {
  roomTypeIds: string[];
  checkIn: string;
  checkOut: string;
}) => {
  const params = new URLSearchParams();
  roomTypeIds.forEach((roomTypeId) => params.append("roomTypeId", roomTypeId));
  params.set("from", checkIn);
  params.set("to", checkOut);
  return `/api/bookings/review-data?${params.toString()}`;
};

export function useBookingReviewData({
  roomTypeIds,
  checkIn,
  checkOut,
}: UseBookingReviewDataInput): UseBookingReviewDataResult {
  const roomTypeIdsKey = roomTypeIds
    .map((id) => id.trim())
    .filter(Boolean)
    .join(",");
  const normalizedRoomTypeIds = React.useMemo(
    () => (roomTypeIdsKey ? roomTypeIdsKey.split(",") : []),
    [roomTypeIdsKey],
  );
  const normalizedCheckIn = checkIn?.trim() ?? "";
  const normalizedCheckOut = checkOut?.trim() ?? "";
  const shouldFetch =
    normalizedRoomTypeIds.length > 0 &&
    normalizedCheckIn.length > 0 &&
    normalizedCheckOut.length > 0;
  const [reviewData, setReviewData] =
    React.useState<PublicBookingReviewData | null>(null);
  const [isLoading, setIsLoading] = React.useState(shouldFetch);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!shouldFetch) {
      setReviewData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const url = buildReviewDataUrl({
      roomTypeIds: normalizedRoomTypeIds,
      checkIn: normalizedCheckIn,
      checkOut: normalizedCheckOut,
    });

    setIsLoading(true);
    setError(null);

    fetch(url, {
      cache: "force-cache",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | PublicBookingReviewDataResponse
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.message ?? "Failed to load booking review data",
          );
        }

        return payload?.data ?? null;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        setReviewData(data);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError) || controller.signal.aborted) {
          return;
        }

        setReviewData(null);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load booking review data"),
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
  }, [normalizedCheckIn, normalizedCheckOut, roomTypeIdsKey, shouldFetch]);

  return { reviewData, isLoading, error };
}
