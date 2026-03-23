"use client";

import * as React from "react";
import {
  areIntervalsOverlapping,
  parseISO,
  eachDayOfInterval,
  format,
} from "date-fns";
import type { DateRange } from "react-day-picker";

import { useDataContext } from "@/context/data-context";
import type {
  RoomType,
  BookingRestriction,
  PropertyClosure,
  RoomOccupancy,
  BookingValidation,
} from "@/data/types";
import { isBookableRoom } from "@/lib/rooms";
import { getBookingRestrictions, getPropertyClosures } from "@/lib/api";

// Booking restriction validation helper
const checkRestrictions = (
  checkIn: Date,
  checkOut: Date,
  roomTypeId: string,
  restrictions: BookingRestriction[]
): BookingValidation => {
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  const checkinDay = checkIn.getDay();

  // Check minimum stay restrictions
  const minStay = restrictions.find(r => 
    r.restrictionType === 'min_stay' && 
    (!r.roomTypeId || r.roomTypeId === roomTypeId) &&
    (!r.startDate || !r.endDate || (checkIn >= new Date(r.startDate!) && checkOut <= new Date(r.endDate!)))
  );
  
  if (minStay && nights < (minStay.value.minNights || 0)) {
    return { 
      isValid: false, 
      message: `Minimum ${minStay.value.minNights} nights required` 
    };
  }

  // Check check-in day restrictions
  const checkinDayRestriction = restrictions.find(r => 
    r.restrictionType === 'checkin_days' &&
    (!r.roomTypeId || r.roomTypeId === roomTypeId) &&
    (!r.startDate || !r.endDate || (checkIn >= new Date(r.startDate!) && checkOut <= new Date(r.endDate!)))
  );
  
  if (checkinDayRestriction && !checkinDayRestriction.value.allowedDays?.includes(checkinDay)) {
    return { 
      isValid: false, 
      message: 'Check-in not allowed on this day' 
    };
  }

  return { isValid: true };
};

// Property closure check helper
const isDateRangeBlocked = (
  checkIn: Date,
  checkOut: Date,
  roomTypeId: string,
  closures: PropertyClosure[]
): boolean => {
  return closures.some((closure) => {
    // If the closure is room-type-specific, only apply it to that room type
    if (closure.roomTypeId && closure.roomTypeId !== roomTypeId) return false;

    const closureStart = new Date(closure.startDate + "T00:00:00");
    const closureEnd = new Date(closure.endDate + "T00:00:00");

    // Overlaps if closure starts before check-out AND closure ends on or after check-in
    return closureStart < checkOut && closureEnd >= checkIn;
  });
};

export interface RoomTypeAvailabilitySummary {
  roomTypeId: string;
  availableRooms: number;
}

export function useAvailabilitySearch() {
  const { reservations, rooms, roomTypes } = useDataContext();
  const visibleRoomTypes = React.useMemo(
    () => (roomTypes ?? []).filter((roomType) => roomType.isVisible !== false),
    [roomTypes]
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [availableRoomTypes, setAvailableRoomTypes] = React.useState<
    RoomType[] | null
  >(null);
  const [hasNoInventory, setHasNoInventory] = React.useState(false);
  const [isDatesBlocked, setIsDatesBlocked] = React.useState(false);
  const [restrictions, setRestrictions] = React.useState<BookingRestriction[]>([]);
  const [closures, setClosures] = React.useState<PropertyClosure[]>([]);
  const [roomTypeAvailability, setRoomTypeAvailability] = React.useState<
    RoomTypeAvailabilitySummary[] | null
  >(null);

  // Load booking restrictions and property closures from API
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [restrictionsData, closuresData] = await Promise.all([
          getBookingRestrictions(),
          getPropertyClosures(),
        ]);
        setRestrictions(restrictionsData);
        setClosures(closuresData);
      } catch (error) {
        console.error('Failed to load booking restrictions/closures:', error);
        setRestrictions([]);
        setClosures([]);
      }
    };

    loadData();
  }, []);

  const search = React.useCallback(
    (dateRange: DateRange, roomOccupancies: RoomOccupancy[], categoryIds?: string[]) => {
      setIsLoading(true);
      setAvailableRoomTypes(null);
      setHasNoInventory(false);
      setIsDatesBlocked(false);
      setRoomTypeAvailability(null);

      // Simulate network delay for a better user experience
      setTimeout(() => {
        if (!dateRange.from || !dateRange.to) {
          setIsLoading(false);
          return;
        }

        // If no rooms are configured, show all room types that meet occupancy requirements
        // with a warning message (to be displayed by the consuming component)
        if (!rooms || rooms.length === 0) {
          const availableByOccupancy = visibleRoomTypes.filter((rt) => {
            // Check each room occupancy configuration against room type
            return roomOccupancies.every(occ => {
              const totalGuests = occ.adults + occ.children;
              const minTotal = (rt.minOccupancy || 1);
              const maxTotal = rt.maxOccupancy + (rt.maxChildren || 0);
              return totalGuests >= minTotal && totalGuests <= maxTotal;
            });
          });
          setAvailableRoomTypes(availableByOccupancy);
          setHasNoInventory(true);
          setRoomTypeAvailability(null);
          setIsLoading(false);
          return;
        }

        const availabilitySummaries: RoomTypeAvailabilitySummary[] = [];
        const availableMatchingOccupancy: RoomType[] = [];
        let closureBlockedCount = 0;

          visibleRoomTypes.forEach((rt) => {
          // Check if room type has valid category filter
          if (categoryIds && categoryIds.length > 0 && rt.categoryId) {
            if (!categoryIds.includes(rt.categoryId)) {
              return;
            }
          }

          // Check booking restrictions
          const restrictionCheck = checkRestrictions(
            dateRange.from!,
            dateRange.to!,
            rt.id,
            restrictions,
          );
          if (!restrictionCheck.isValid) {
            return;
          }

          // Check property closures (blocked date ranges)
          if (isDateRangeBlocked(dateRange.from!, dateRange.to!, rt.id, closures)) {
            closureBlockedCount += 1;
            return;
          }

          const roomsOfType = rooms.filter(
            (room) => room.roomTypeId === rt.id && isBookableRoom(room)
          );
          const totalRoomsOfType = roomsOfType.length;
          if (totalRoomsOfType === 0) {
            return;
          }

          const bookingsCountByDate: Record<string, number> = {};
          const relevantReservations = reservations.filter(
            (res) =>
              roomsOfType.some((r) => r.id === res.roomId) &&
              res.status !== "Cancelled" &&
              areIntervalsOverlapping(
                { start: dateRange.from!, end: dateRange.to! },
                {
                  start: parseISO(res.checkInDate),
                  end: parseISO(res.checkOutDate),
                },
              ),
          );

          relevantReservations.forEach((res) => {
            const interval = {
              start: parseISO(res.checkInDate),
              end: parseISO(res.checkOutDate),
            };
            const bookingDays = eachDayOfInterval(interval);
            if (bookingDays.length > 0) bookingDays.pop(); // Don't count checkout day
            bookingDays.forEach((day) => {
              const dayString = format(day, "yyyy-MM-dd");
              bookingsCountByDate[dayString] =
                (bookingsCountByDate[dayString] || 0) + 1;
            });
          });

          const searchInterval = eachDayOfInterval({
            start: dateRange.from!,
            end: dateRange.to!,
          });
          if (searchInterval.length > 0) searchInterval.pop(); // Don't count checkout day

          let minAvailableRoomsForStay = totalRoomsOfType;

          const hasAnyAvailabilityForAllNights = searchInterval.every((day) => {
            const dayString = format(day, "yyyy-MM-dd");
            const bookedCount = bookingsCountByDate[dayString] || 0;
            const availableRoomsCount = totalRoomsOfType - bookedCount;

            if (availableRoomsCount < minAvailableRoomsForStay) {
              minAvailableRoomsForStay = availableRoomsCount;
            }

            // For general availability we only require at least 1 free room
            return availableRoomsCount > 0;
          });

          if (!hasAnyAvailabilityForAllNights || minAvailableRoomsForStay <= 0) {
            return;
          }

          availabilitySummaries.push({
            roomTypeId: rt.id,
            availableRooms: minAvailableRoomsForStay,
          });

          // Now check if this room type can fully satisfy the requested occupancy
          const canAccommodateAllRooms = roomOccupancies.every((occ) => {
            const totalGuests = occ.adults + occ.children;
            const minTotal = rt.minOccupancy || 1;
            const maxTotal = rt.maxOccupancy + (rt.maxChildren || 0);
            return totalGuests >= minTotal && totalGuests <= maxTotal;
          });

          const hasEnoughRoomsForRequestedCount =
            minAvailableRoomsForStay >= roomOccupancies.length;

          if (canAccommodateAllRooms && hasEnoughRoomsForRequestedCount) {
            availableMatchingOccupancy.push(rt);
          }
        });

        setAvailableRoomTypes(availableMatchingOccupancy);
        setRoomTypeAvailability(availabilitySummaries);
        // Mark as blocked if closures accounted for all filtered-out room types
        if (closureBlockedCount > 0 && availableMatchingOccupancy.length === 0) {
          setIsDatesBlocked(true);
        }
        setIsLoading(false);
      }, 500);
    },
    [reservations, visibleRoomTypes, rooms, restrictions, closures]
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
  };
}