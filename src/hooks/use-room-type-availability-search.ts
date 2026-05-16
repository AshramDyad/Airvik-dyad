import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import type { AvailabilitySearchResult } from "@/lib/availability/search";

type AvailabilitySearchResponse = {
  data: AvailabilitySearchResult;
};

type UseRoomTypeAvailabilitySearchArgs = {
  roomTypeId: string | null | undefined;
  dateRange: DateRange | undefined;
  adults: number;
  children: number;
  enabled?: boolean;
};

type RoomTypeAvailabilitySearchState = {
  availableRoomsForStay: number | undefined;
  isCheckingAvailability: boolean;
  isDatesBlocked: boolean;
  availabilityError: string | null;
};

const normalizeCount = (value: number, fallback: number, minimum: number) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.floor(value));
};

export function useRoomTypeAvailabilitySearch({
  roomTypeId,
  dateRange,
  adults,
  children,
  enabled = true,
}: UseRoomTypeAvailabilitySearchArgs): RoomTypeAvailabilitySearchState {
  const checkIn = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : null;
  const checkOut = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

  const [state, setState] = React.useState<RoomTypeAvailabilitySearchState>({
    availableRoomsForStay: undefined,
    isCheckingAvailability: false,
    isDatesBlocked: false,
    availabilityError: null,
  });

  React.useEffect(() => {
    if (!enabled || !roomTypeId || !checkIn || !checkOut) {
      setState({
        availableRoomsForStay: undefined,
        isCheckingAvailability: false,
        isDatesBlocked: false,
        availabilityError: null,
      });
      return;
    }

    let isActive = true;
    setState({
      availableRoomsForStay: undefined,
      isCheckingAvailability: true,
      isDatesBlocked: false,
      availabilityError: null,
    });

    fetch("/api/availability/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        checkIn,
        checkOut,
        roomTypeIds: [roomTypeId],
        roomOccupancies: [
          {
            adults: normalizeCount(adults, 1, 1),
            children: normalizeCount(children, 0, 0),
          },
        ],
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Availability search failed with ${response.status}`);
        }
        return (await response.json()) as AvailabilitySearchResponse;
      })
      .then(({ data }) => {
        if (!isActive) return;
        const summary = data.roomTypeAvailability.find(
          (item) => item.roomTypeId === roomTypeId,
        );
        setState({
          availableRoomsForStay: data.hasNoInventory
            ? undefined
            : summary?.availableRooms ?? 0,
          isCheckingAvailability: false,
          isDatesBlocked: data.isDatesBlocked,
          availabilityError: null,
        });
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Failed to check room type availability:", error);
        setState({
          availableRoomsForStay: undefined,
          isCheckingAvailability: false,
          isDatesBlocked: false,
          availabilityError:
            error instanceof Error ? error.message : "Availability search failed",
        });
      });

    return () => {
      isActive = false;
    };
  }, [adults, checkIn, checkOut, children, enabled, roomTypeId]);

  return state;
}
