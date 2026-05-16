import type { Guest, Property, Reservation, Room, RoomType } from "@/data/types";
import type { InvoiceData } from "@/lib/invoice/generate-invoice";

export type ReservationInvoiceRow = Reservation & {
  displayAmount?: number;
  paidAmount?: number;
  remainingBalance?: number;
  guestName?: string;
  roomNumber?: string;
  nights?: number;
  roomCount?: number;
  subRows?: ReservationInvoiceRow[];
};

const formatName = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();

const splitFallbackName = (name: string | null | undefined) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Guest",
    lastName: parts.slice(1).join(" "),
  };
};

function buildGuestFromSnapshot(row: ReservationInvoiceRow): Guest | null {
  const sourceRow =
    row.guestSnapshot || !row.subRows?.length
      ? row
      : row.subRows.find((entry) => entry.guestSnapshot) ?? row;
  const snapshot = sourceRow.guestSnapshot ?? row.guestSnapshot;
  const snapshotName = formatName(snapshot?.firstName, snapshot?.lastName);
  const fallbackName = snapshotName || row.guestName || sourceRow.guestName;

  if (!snapshot && !fallbackName) {
    return null;
  }

  const fallback = splitFallbackName(fallbackName);

  return {
    id: sourceRow.guestId || row.guestId,
    firstName: snapshot?.firstName?.trim() || fallback.firstName,
    lastName: snapshot?.lastName?.trim() || fallback.lastName,
    email: snapshot?.email?.trim() || "",
    phone: snapshot?.phone?.trim() || "",
  };
}

export function buildReservationInvoiceData(
  row: ReservationInvoiceRow,
  guests: Guest[],
  property: Property,
  rooms: Room[],
  roomTypes: RoomType[],
): InvoiceData {
  const reservations = row.subRows?.length ? row.subRows : [row];
  const guest =
    guests.find((entry) => entry.id === row.guestId) ??
    buildGuestFromSnapshot(row);

  return { reservations, guest, property, rooms, roomTypes };
}
