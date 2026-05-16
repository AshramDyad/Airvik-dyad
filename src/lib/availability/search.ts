import { eachDayOfInterval, format } from "date-fns";

import type {
  BookingRestriction,
  PropertyClosure,
  Reservation,
  Room,
  RoomOccupancy,
  RoomType,
  SeasonalPrice,
} from "@/data/types";
import { isBookableRoom } from "@/lib/rooms";

export type AvailabilityRoomType = Pick<
  RoomType,
  "id" | "maxOccupancy" | "minOccupancy" | "maxChildren" | "categoryId" | "isVisible"
>;

export type AvailabilityRoom = Pick<Room, "id" | "roomTypeId" | "status">;

export type AvailabilityReservation = Pick<
  Reservation,
  "id" | "roomId" | "checkInDate" | "checkOutDate" | "status"
>;

export type RoomTypeAvailabilitySummary = {
  roomTypeId: string;
  availableRooms: number;
};

export type AvailabilitySearchInput = {
  checkIn: Date;
  checkOut: Date;
  roomOccupancies: RoomOccupancy[];
  rooms: AvailabilityRoom[];
  roomTypes: AvailabilityRoomType[];
  reservations: AvailabilityReservation[];
  restrictions: BookingRestriction[];
  closures: PropertyClosure[];
  categoryIds?: string[];
};

export type AvailabilitySearchResult = {
  availableRoomTypeIds: string[];
  roomTypeAvailability: RoomTypeAvailabilitySummary[];
  seasonalPrices: SeasonalPrice[];
  hasNoInventory: boolean;
  isDatesBlocked: boolean;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const countNights = (checkIn: Date, checkOut: Date) =>
  Math.ceil((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);

const dateString = (date: Date) => format(date, "yyyy-MM-dd");

const getStayDateStrings = (checkIn: Date, checkOut: Date) => {
  const days = eachDayOfInterval({ start: checkIn, end: checkOut });
  if (days.length > 0) days.pop();
  return days.map(dateString);
};

const matchesCategoryFilter = (
  roomType: AvailabilityRoomType,
  categoryIds: string[] | undefined,
) => {
  if (!categoryIds || categoryIds.length === 0 || !roomType.categoryId) {
    return true;
  }
  return categoryIds.includes(roomType.categoryId);
};

const canAccommodateOccupancies = (
  roomType: AvailabilityRoomType,
  roomOccupancies: RoomOccupancy[],
) =>
  roomOccupancies.every((occupancy) => {
    const totalGuests = occupancy.adults + occupancy.children;
    const minTotal = roomType.minOccupancy || 1;
    const maxTotal = roomType.maxOccupancy + (roomType.maxChildren || 0);
    return totalGuests >= minTotal && totalGuests <= maxTotal;
  });

const restrictionAppliesToRoomType = (
  restriction: BookingRestriction,
  roomTypeId: string,
) => !restriction.roomTypeId || restriction.roomTypeId === roomTypeId;

const restrictionAppliesToDates = (
  restriction: BookingRestriction,
  checkInDate: string,
  checkOutDate: string,
) => {
  if (!restriction.startDate || !restriction.endDate) {
    return true;
  }
  return restriction.startDate <= checkInDate && restriction.endDate >= checkOutDate;
};

const passesBookingRestrictions = (
  checkIn: Date,
  checkOut: Date,
  roomTypeId: string,
  restrictions: BookingRestriction[],
) => {
  const nights = countNights(checkIn, checkOut);
  const checkInDay = checkIn.getDay();
  const checkInDate = dateString(checkIn);
  const checkOutDate = dateString(checkOut);

  for (const restriction of restrictions) {
    if (!restrictionAppliesToRoomType(restriction, roomTypeId)) continue;
    if (!restrictionAppliesToDates(restriction, checkInDate, checkOutDate)) continue;

    if (
      restriction.restrictionType === "min_stay" &&
      nights < (restriction.value.minNights || 0)
    ) {
      return false;
    }

    if (
      restriction.restrictionType === "checkin_days" &&
      !restriction.value.allowedDays?.includes(checkInDay)
    ) {
      return false;
    }
  }

  return true;
};

const isDateRangeBlocked = (
  checkInDate: string,
  checkOutDate: string,
  roomTypeId: string,
  closures: PropertyClosure[],
) =>
  closures.some((closure) => {
    if (closure.roomTypeId && closure.roomTypeId !== roomTypeId) {
      return false;
    }
    return closure.startDate < checkOutDate && closure.endDate >= checkInDate;
  });

const reservationOverlapsStay = (
  reservation: AvailabilityReservation,
  checkInDate: string,
  checkOutDate: string,
) =>
  reservation.status !== "Cancelled" &&
  reservation.checkInDate < checkOutDate &&
  reservation.checkOutDate > checkInDate;

export function computeAvailabilitySearchResult({
  checkIn,
  checkOut,
  roomOccupancies,
  rooms,
  roomTypes,
  reservations,
  restrictions,
  closures,
  categoryIds,
}: AvailabilitySearchInput): AvailabilitySearchResult {
  const visibleRoomTypes = roomTypes.filter(
    (roomType) =>
      roomType.isVisible !== false &&
      matchesCategoryFilter(roomType, categoryIds),
  );

  if (rooms.length === 0) {
    return {
      availableRoomTypeIds: visibleRoomTypes
        .filter((roomType) => canAccommodateOccupancies(roomType, roomOccupancies))
        .map((roomType) => roomType.id),
      roomTypeAvailability: [],
      seasonalPrices: [],
      hasNoInventory: true,
      isDatesBlocked: false,
    };
  }

  const checkInDate = dateString(checkIn);
  const checkOutDate = dateString(checkOut);
  const stayDates = getStayDateStrings(checkIn, checkOut);
  const availabilitySummaries: RoomTypeAvailabilitySummary[] = [];
  const availableRoomTypeIds: string[] = [];
  let closureBlockedCount = 0;
  let candidateRoomTypeCount = 0;

  for (const roomType of visibleRoomTypes) {
    const roomsOfType = rooms.filter(
      (room) => room.roomTypeId === roomType.id && isBookableRoom(room),
    );

    if (roomsOfType.length === 0) {
      continue;
    }

    if (!passesBookingRestrictions(checkIn, checkOut, roomType.id, restrictions)) {
      continue;
    }

    candidateRoomTypeCount += 1;

    if (isDateRangeBlocked(checkInDate, checkOutDate, roomType.id, closures)) {
      closureBlockedCount += 1;
      continue;
    }

    const roomIdsOfType = new Set(roomsOfType.map((room) => room.id));
    const bookingsCountByDate: Record<string, number> = {};
    const relevantReservations = reservations.filter(
      (reservation) =>
        roomIdsOfType.has(reservation.roomId) &&
        reservationOverlapsStay(reservation, checkInDate, checkOutDate),
    );

    for (const reservation of relevantReservations) {
      const reservationDays = eachDayOfInterval({
        start: new Date(`${reservation.checkInDate}T00:00:00`),
        end: new Date(`${reservation.checkOutDate}T00:00:00`),
      });
      if (reservationDays.length > 0) reservationDays.pop();

      for (const day of reservationDays) {
        const dayString = dateString(day);
        bookingsCountByDate[dayString] = (bookingsCountByDate[dayString] || 0) + 1;
      }
    }

    let minAvailableRoomsForStay = roomsOfType.length;
    const hasAnyAvailabilityForAllNights = stayDates.every((dayString) => {
      const bookedCount = bookingsCountByDate[dayString] || 0;
      const availableRoomsCount = roomsOfType.length - bookedCount;

      if (availableRoomsCount < minAvailableRoomsForStay) {
        minAvailableRoomsForStay = availableRoomsCount;
      }

      return availableRoomsCount > 0;
    });

    if (!hasAnyAvailabilityForAllNights || minAvailableRoomsForStay <= 0) {
      continue;
    }

    availabilitySummaries.push({
      roomTypeId: roomType.id,
      availableRooms: minAvailableRoomsForStay,
    });

    if (
      canAccommodateOccupancies(roomType, roomOccupancies) &&
      minAvailableRoomsForStay >= roomOccupancies.length
    ) {
      availableRoomTypeIds.push(roomType.id);
    }
  }

  return {
    availableRoomTypeIds,
    roomTypeAvailability: availabilitySummaries,
    seasonalPrices: [],
    hasNoInventory: false,
    isDatesBlocked:
      candidateRoomTypeCount > 0 &&
      closureBlockedCount === candidateRoomTypeCount &&
      availabilitySummaries.length === 0,
  };
}
