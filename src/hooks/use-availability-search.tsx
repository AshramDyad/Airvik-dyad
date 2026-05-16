"use client";

import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import type {
  PropertyClosure,
  RoomOccupancy,
  RoomType,
  SeasonalPrice,
} from "@/data/types";
import type {
  AvailabilitySearchResult,
  RoomTypeAvailabilitySummary,
} from "@/lib/availability/search";

type AvailabilitySearchResponse = {
  data: AvailabilitySearchResult;
};

export type { RoomTypeAvailabilitySummary };

type UseAvailabilitySearchOptions = {
  roomTypes?: RoomType[];
  propertyClosures?: AvailabilitySearchClosure[];
};

export type AvailabilitySearchClosure = Pick<
  PropertyClosure,
  "roomTypeId" | "startDate" | "endDate"
>;

const EMPTY_ROOM_TYPES: RoomType[] = [];
const EMPTY_PROPERTY_CLOSURES: AvailabilitySearchClosure[] = [];

export function useAvailabilitySearch({
  roomTypes = EMPTY_ROOM_TYPES,
  propertyClosures = EMPTY_PROPERTY_CLOSURES,
}: UseAvailabilitySearchOptions = {}) {
  const visibleRoomTypes = React.useMemo(
    () => (roomTypes ?? []).filter((roomType) => roomType.isVisible !== false),
    [roomTypes],
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [availableRoomTypes, setAvailableRoomTypes] = React.useState<
    RoomType[] | null
  >(null);
  const [hasNoInventory, setHasNoInventory] = React.useState(false);
  const [isDatesBlocked, setIsDatesBlocked] = React.useState(false);
  const [closures, setClosures] = React.useState<AvailabilitySearchClosure[]>(
    propertyClosures ?? [],
  );
  const [roomTypeAvailability, setRoomTypeAvailability] = React.useState<
    RoomTypeAvailabilitySummary[] | null
  >(null);
  const [seasonalPrices, setSeasonalPrices] = React.useState<SeasonalPrice[]>(
    [],
  );

  React.useEffect(() => {
    setClosures(propertyClosures ?? []);
  }, [propertyClosures]);

  const search = React.useCallback(
    (dateRange: DateRange, roomOccupancies: RoomOccupancy[], categoryIds?: string[]) => {
      setIsLoading(true);
      setAvailableRoomTypes(null);
      setHasNoInventory(false);
      setIsDatesBlocked(false);
      setRoomTypeAvailability(null);
      setSeasonalPrices([]);

      setTimeout(async () => {
        if (!dateRange.from || !dateRange.to) {
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch("/api/availability/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              checkIn: format(dateRange.from, "yyyy-MM-dd"),
              checkOut: format(dateRange.to, "yyyy-MM-dd"),
              roomOccupancies,
              categoryIds,
            }),
          });

          if (!response.ok) {
            throw new Error(`Availability search failed with ${response.status}`);
          }

          const { data } = (await response.json()) as AvailabilitySearchResponse;
          const visibleRoomTypeById = new Map(
            visibleRoomTypes.map((roomType) => [roomType.id, roomType] as const),
          );
          const matchingRoomTypes = data.availableRoomTypeIds
            .map((roomTypeId) => visibleRoomTypeById.get(roomTypeId))
            .filter((roomType): roomType is RoomType => Boolean(roomType));

          setAvailableRoomTypes(matchingRoomTypes);
          setRoomTypeAvailability(
            data.hasNoInventory ? null : data.roomTypeAvailability,
          );
          setSeasonalPrices(data.seasonalPrices ?? []);
          setHasNoInventory(data.hasNoInventory);
          setIsDatesBlocked(data.isDatesBlocked);
        } catch (error) {
          console.error("Failed to search availability:", error);
          setAvailableRoomTypes([]);
          setRoomTypeAvailability([]);
          setSeasonalPrices([]);
          setHasNoInventory(false);
          setIsDatesBlocked(false);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    },
    [visibleRoomTypes],
  );

  return {
    search,
    availableRoomTypes,
    roomTypeAvailability,
    isLoading,
    setAvailableRoomTypes,
    setRoomTypeAvailability,
    hasNoInventory,
    isDatesBlocked,
    closures,
    seasonalPrices,
  };
}
