import { parseISO } from "date-fns";

import type { BookingSummary, Room } from "@/data/types";
import type { DashboardTableRow } from "./dashboard-table";

type TodayRange = {
  start: Date;
  end: Date;
};

type DashboardReservationRow = BookingSummary["subRows"][number];

type DashboardSummaryInput = {
  bookings: BookingSummary[];
  rooms: Room[];
  todayRange: TodayRange;
};

type DashboardSummary = {
  occupancyPercentage: number;
  occupiedRoomsCount: number;
  availableRooms: number;
  arrivalsRows: DashboardTableRow[];
  departuresRows: DashboardTableRow[];
  roomsForSaleCount: number;
};

const cancelledStatuses = new Set(["Cancelled", "No-show"]);

const formatName = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();

const getGuestName = (
  booking: BookingSummary,
  reservation: DashboardReservationRow,
) =>
  reservation.guestName?.trim() ||
  booking.guestName?.trim() ||
  formatName(booking.guestSnapshot.firstName, booking.guestSnapshot.lastName) ||
  formatName(
    reservation.guestSnapshot?.firstName,
    reservation.guestSnapshot?.lastName,
  ) ||
  "Unknown Guest";

const getGuestEmail = (
  booking: BookingSummary,
  reservation: DashboardReservationRow,
) =>
  booking.guestSnapshot.email?.trim() ||
  reservation.guestSnapshot?.email?.trim() ||
  undefined;

const buildTableRow = (
  booking: BookingSummary,
  reservation: DashboardReservationRow,
  roomMap: Map<string, Room>,
): DashboardTableRow => {
  const room = roomMap.get(reservation.roomId);

  return {
    id: reservation.id,
    guestName: getGuestName(booking, reservation),
    guestEmail: getGuestEmail(booking, reservation),
    roomNumber: room?.roomNumber || "N/A",
    status: reservation.status,
  };
};

export function buildDashboardSummary({
  bookings,
  rooms,
  todayRange,
}: DashboardSummaryInput): DashboardSummary {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const roomsAvailableForSale = rooms.filter(
    (room) => room.status !== "Maintenance",
  );

  let occupiedRooms = 0;
  const arrivals: Array<{ row: DashboardTableRow; sort: number }> = [];
  const departures: Array<{ row: DashboardTableRow; sort: number }> = [];

  bookings.forEach((booking) => {
    (booking.subRows ?? []).forEach((reservation) => {
      if (cancelledStatuses.has(reservation.status)) {
        return;
      }

      const checkIn = parseISO(reservation.checkInDate);
      const checkOut = parseISO(reservation.checkOutDate);

      if (checkIn >= todayRange.start && checkIn <= todayRange.end) {
        arrivals.push({
          sort: checkIn.getTime(),
          row: buildTableRow(booking, reservation, roomMap),
        });
      }

      if (checkOut >= todayRange.start && checkOut <= todayRange.end) {
        departures.push({
          sort: checkOut.getTime(),
          row: buildTableRow(booking, reservation, roomMap),
        });
      }

      const stayCoversToday =
        todayRange.start >= checkIn && todayRange.start < checkOut;
      if (
        reservation.status === "Checked-in" ||
        (stayCoversToday && reservation.status === "Confirmed")
      ) {
        occupiedRooms += 1;
      }
    });
  });

  const availableRoomsCount = Math.max(
    roomsAvailableForSale.length - occupiedRooms,
    0,
  );
  const occupancy = roomsAvailableForSale.length
    ? (occupiedRooms / roomsAvailableForSale.length) * 100
    : 0;

  const sortByDate = (a: { sort: number }, b: { sort: number }) =>
    a.sort - b.sort;

  return {
    occupancyPercentage: occupancy,
    occupiedRoomsCount: occupiedRooms,
    availableRooms: availableRoomsCount,
    arrivalsRows: arrivals.sort(sortByDate).map((item) => item.row),
    departuresRows: departures.sort(sortByDate).map((item) => item.row),
    roomsForSaleCount: roomsAvailableForSale.length,
  };
}
