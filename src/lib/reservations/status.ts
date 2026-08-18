import type { Reservation, ReservationStatus } from "@/data/types";

export const ROOM_HOLD_STATUS: ReservationStatus = "Room Hold";
export const ROOM_HOLD_LABEL = "(Pending) Room Hold";
const ROOM_HOLD_DURATION_MS = 30 * 60 * 1000;

export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "Pending",
  ROOM_HOLD_STATUS,
  "Standby",
  "Confirmed",
  "Checked-in",
  "Checked-out",
];

const RESERVATION_STATUS_PRIORITY: Record<ReservationStatus, number> = {
  "Checked-out": 6,
  "Checked-in": 5,
  Confirmed: 4,
  Standby: 3,
  "Room Hold": 2,
  Pending: 1,
  Cancelled: 0,
  "No-show": -1,
};

export type ReservationAvailabilityShape = Pick<
  Reservation,
  "status" | "holdExpiresAt"
>;

type ReservationDateRangeShape = ReservationAvailabilityShape &
  Pick<Reservation, "roomId" | "checkInDate" | "checkOutDate">;

type DateRangeShape = {
  from: Date;
  to: Date;
};

export function isActiveReservationStatus(status: ReservationStatus): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(status);
}

export function shouldShowReservationFinancials(
  status: ReservationStatus
): boolean {
  return status !== "Cancelled" && status !== "No-show";
}

export function getReservationStatusLabel(status: ReservationStatus): string {
  return status === ROOM_HOLD_STATUS ? ROOM_HOLD_LABEL : status;
}

export function isActiveRoomHold(
  reservation: ReservationAvailabilityShape,
  now: Date = new Date()
): boolean {
  if (reservation.status !== ROOM_HOLD_STATUS) {
    return false;
  }

  // Legacy holds without an expiry remain blocking until an administrator
  // resolves them. This is safer than making an unknown hold bookable.
  if (!reservation.holdExpiresAt) {
    return true;
  }

  const expiry = Date.parse(reservation.holdExpiresAt);
  return Number.isNaN(expiry) || expiry > now.getTime();
}

export function doesReservationBlockAvailability(
  reservation: ReservationAvailabilityShape,
  now: Date = new Date()
): boolean {
  if (reservation.status === "Cancelled" || reservation.status === "No-show") {
    return false;
  }

  if (reservation.status === ROOM_HOLD_STATUS) {
    return isActiveRoomHold(reservation, now);
  }

  return true;
}

export function getActiveHoldRoomIdsForDateRange(
  reservations: ReservationDateRangeShape[],
  dateRange: DateRangeShape,
  now: Date = new Date()
): Set<string> {
  const heldRoomIds = new Set<string>();
  const rangeStart = dateRange.from.getTime();
  const rangeEnd = dateRange.to.getTime();

  reservations.forEach((reservation) => {
    if (!isActiveRoomHold(reservation, now)) {
      return;
    }

    const checkIn = new Date(`${reservation.checkInDate}T00:00:00`).getTime();
    const checkOut = new Date(`${reservation.checkOutDate}T00:00:00`).getTime();
    const overlaps = rangeStart < checkOut && rangeEnd > checkIn;

    if (overlaps) {
      heldRoomIds.add(reservation.roomId);
    }
  });

  return heldRoomIds;
}

export function getRoomHoldExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + ROOM_HOLD_DURATION_MS).toISOString();
}

export function resolveAggregateStatus(statuses: ReservationStatus[]): ReservationStatus {
  if (statuses.length === 0) {
    return "Cancelled";
  }

  return statuses.reduce<ReservationStatus>((best, current) => {
    const currentPriority = RESERVATION_STATUS_PRIORITY[current] ?? -1;
    const bestPriority = RESERVATION_STATUS_PRIORITY[best] ?? -1;
    return currentPriority > bestPriority ? current : best;
  }, statuses[0]);
}

export function hasActiveReservations(statuses: ReservationStatus[]): boolean {
  return statuses.some((status) => isActiveReservationStatus(status));
}
