"use client";

import * as React from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ReservationStatus } from "@/data/types";
import type { CalendarReservationDetail } from "@/lib/calendar/reservation-details";
import { cn } from "@/lib/utils";
import { isActiveReservationStatus } from "@/lib/reservations/status";

const reservationStatusStyles: Record<
  ReservationStatus,
  { ribbon: string; dot: string }
> = {
  Tentative: {
    ribbon: "border border-secondary/50 bg-secondary/30 text-secondary-foreground",
    dot: "bg-secondary/80",
  },
  Standby: {
    ribbon: "border border-amber-400/60 bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
  },
  Confirmed: {
    ribbon: "border border-primary/40 bg-primary/10 text-primary",
    dot: "bg-primary/80",
  },
  "Checked-in": {
    ribbon: "border border-accent/50 bg-accent/30 text-accent-foreground",
    dot: "bg-accent/80",
  },
  "Checked-out": {
    ribbon: "border border-muted/50 bg-muted/40 text-muted-foreground",
    dot: "bg-muted/70",
  },
  Cancelled: {
    ribbon: "border border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive/80",
  },
  "No-show": {
    ribbon: "border border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive/80",
  },
};

const getStatusStyle = (status: ReservationStatus) =>
  reservationStatusStyles[status] ?? {
    ribbon: "border border-muted/40 bg-muted/40 text-muted-foreground",
    dot: "bg-muted/70",
  };

const mixedStatusStyle = {
  ribbon: "border border-muted/50 bg-muted/30 text-muted-foreground",
  dot: "bg-muted/70",
};

interface ReservationDetail {
  reservation: CalendarReservationDetail;
  guestName: string;
  customerTitle?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  adultCount: number;
  childCount: number;
  roomNumber?: string;
  roomTypeName?: string;
}

interface ReservationGroupSummary {
  bookingId: string;
  guestName: string;
  guestsText?: string | null;
  bookingDate: Date;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  rooms: Array<{ id: string; roomNumber?: string; roomTypeName?: string }>;
  statusLabel: ReservationStatus | "Mixed";
  statusStyle: { ribbon: string; dot: string };
}

interface GroupedRoomType {
  label: string;
  count: number;
  roomNumbers: string[];
}

interface ReservationHoverCardProps {
  children: React.ReactNode;
  reservationIds: string[];
  date: string;
  reservationDetailsById: ReadonlyMap<string, CalendarReservationDetail>;
}

const BOOKING_ID_VISIBLE_LENGTH = 7 as const;

function formatBookingId(id: string): string {
  if (!id) return "-";
  if (id.length <= BOOKING_ID_VISIBLE_LENGTH) return id;
  return id.slice(-BOOKING_ID_VISIBLE_LENGTH);
}

function formatName(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .trim();
}

function formatCustomerName(detail: ReservationDetail): string {
  const parts: string[] = [];

  if (detail.customerTitle) {
    const trimmed = detail.customerTitle.trim();
    if (trimmed) parts.push(trimmed);
  }

  const fullName = [detail.customerFirstName, detail.customerLastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");

  if (fullName) parts.push(fullName);

  if (parts.length > 0) return parts.join(" ");

  return detail.guestName || "Guest";
}

type GuestTotals = {
  adults: number;
  children: number;
};

function formatGuestTotals(adults: number, children: number): string | null {
  const safeAdults = Math.max(0, adults);
  const safeChildren = Math.max(0, children);
  const totalGuests = safeAdults + safeChildren;

  if (totalGuests === 0) {
    return null;
  }

  const breakdownSegments: string[] = [];
  if (safeAdults > 0) {
    breakdownSegments.push(`${safeAdults} adult${safeAdults === 1 ? "" : "s"}`);
  }
  if (safeChildren > 0) {
    breakdownSegments.push(`${safeChildren} child${safeChildren === 1 ? "" : "ren"}`);
  }

  const breakdown = breakdownSegments.length
    ? ` (${breakdownSegments.join(", ")})`
    : "";

  return `${totalGuests} guest${totalGuests === 1 ? "" : "s"}${breakdown}`;
}

function accumulateGuestTotals(
  totals: GuestTotals,
  detail: ReservationDetail
): GuestTotals {
  return {
    adults: totals.adults + detail.adultCount,
    children: totals.children + detail.childCount,
  };
}

function groupRoomsByType(
  rooms: ReservationGroupSummary["rooms"]
): GroupedRoomType[] {
  const groups = new Map<string, GroupedRoomType>();

  rooms.forEach((room) => {
    const label = room.roomTypeName?.trim() || "Room";
    const roomNumber = room.roomNumber?.trim();
    const existing = groups.get(label);

    if (existing) {
      existing.count += 1;
      if (roomNumber) {
        existing.roomNumbers.push(roomNumber);
      }
      return;
    }

    groups.set(label, {
      label,
      count: 1,
      roomNumbers: roomNumber ? [roomNumber] : [],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      roomNumbers: [...group.roomNumbers].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      ),
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
}

export function ReservationHoverCard({
  children,
  reservationIds,
  date,
  reservationDetailsById,
}: ReservationHoverCardProps) {
  const hoverDate = React.useMemo(() => {
    const parsed = parseISO(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [date]);

  const reservationDetails = React.useMemo<ReservationDetail[]>(() => {
    const details: ReservationDetail[] = [];
    const targetBookingIds = new Set<string>();
    const seenReservationIds = new Set<string>();

    const includeReservationDetail = (
      reservation: CalendarReservationDetail | undefined,
    ) => {
      if (!reservation || seenReservationIds.has(reservation.id)) {
        return;
      }

      if (hoverDate) {
        const checkIn = parseISO(reservation.checkInDate);
        const checkOut = parseISO(reservation.checkOutDate);
        if (!(hoverDate >= checkIn && hoverDate < checkOut)) {
          return;
        }
      }

      const snapshotName = formatName(
        reservation.guestSnapshot?.firstName,
        reservation.guestSnapshot?.lastName
      );

      details.push({
        reservation,
        guestName: snapshotName || "Unknown Guest",
        customerTitle: null,
        customerFirstName: reservation.guestSnapshot?.firstName ?? null,
        customerLastName: reservation.guestSnapshot?.lastName ?? null,
        adultCount: Number.isFinite(reservation.adultCount)
          ? reservation.adultCount
          : reservation.numberOfGuests ?? 0,
        childCount: Number.isFinite(reservation.childCount)
          ? reservation.childCount
          : 0,
        roomNumber: reservation.roomNumber,
        roomTypeName: reservation.roomTypeName,
      });

      seenReservationIds.add(reservation.id);
      const bookingKey = reservation.bookingId || reservation.id;
      if (bookingKey) {
        targetBookingIds.add(bookingKey);
      }
    };

    reservationIds.forEach((id) => {
      includeReservationDetail(reservationDetailsById.get(id));
    });

    if (targetBookingIds.size > 0) {
      reservationDetailsById.forEach((reservation) => {
        const bookingKey = reservation.bookingId || reservation.id;
        if (targetBookingIds.has(bookingKey)) {
          includeReservationDetail(reservation);
        }
      });
    }

    return details;
  }, [reservationIds, reservationDetailsById, hoverDate]);

  const displayedReservationDetails = React.useMemo(() => {
    const active = reservationDetails.filter((detail) =>
      isActiveReservationStatus(detail.reservation.status)
    );
    return active.length ? active : reservationDetails;
  }, [reservationDetails]);

  const reservationGroups = React.useMemo<ReservationGroupSummary[]>(() => {
    if (displayedReservationDetails.length === 0) {
      return [];
    }

    const groups = new Map<string, {
      bookingId: string;
      guestName: string;
      bookingDate: Date;
      checkIn: Date;
      checkOut: Date;
      nights: number;
      rooms: Array<{ id: string; roomNumber?: string; roomTypeName?: string }>;
      statuses: Set<ReservationStatus>;
      totals: GuestTotals;
    }>();

    displayedReservationDetails.forEach((detail) => {
      const { reservation } = detail;
      const bookingId = reservation.bookingId || reservation.id;
      const checkIn = parseISO(reservation.checkInDate);
      const checkOut = parseISO(reservation.checkOutDate);
      const bookingDate = parseISO(reservation.bookingDate);
      const nights = Math.max(differenceInDays(checkOut, checkIn), 1);
      const existing = groups.get(bookingId);
      if (!existing) {
        groups.set(bookingId, {
          bookingId,
          guestName: formatCustomerName(detail),
          bookingDate,
          checkIn,
          checkOut,
          nights,
          rooms: [
            {
              id: reservation.id,
              roomNumber: detail.roomNumber,
              roomTypeName: detail.roomTypeName,
            },
          ],
          statuses: new Set<ReservationStatus>([reservation.status]),
          totals: {
            adults: detail.adultCount,
            children: detail.childCount,
          },
        });
        return;
      }

      existing.rooms.push({
        id: reservation.id,
        roomNumber: detail.roomNumber,
        roomTypeName: detail.roomTypeName,
      });
      existing.checkIn = checkIn < existing.checkIn ? checkIn : existing.checkIn;
      existing.checkOut = checkOut > existing.checkOut ? checkOut : existing.checkOut;
      existing.nights = Math.max(existing.nights, nights);
      existing.statuses.add(reservation.status);
      existing.totals = accumulateGuestTotals(existing.totals, detail);
    });

    return Array.from(groups.values()).map((group) => {
      const statusLabel = group.statuses.size === 1 ? [...group.statuses][0] : "Mixed";
      const statusStyle =
        statusLabel === "Mixed"
          ? mixedStatusStyle
          : getStatusStyle(statusLabel as ReservationStatus);
      const guestsText = formatGuestTotals(
        group.totals.adults,
        group.totals.children
      );

      return {
        bookingId: group.bookingId,
        guestName: group.guestName,
        guestsText,
        bookingDate: group.bookingDate,
        checkIn: group.checkIn,
        checkOut: group.checkOut,
        nights: group.nights,
          rooms: [...group.rooms].sort((a, b) => {
            const typeCompare = (a.roomTypeName || "").localeCompare(b.roomTypeName || "");
            if (typeCompare !== 0) return typeCompare;
            return (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }),
        statusLabel,
        statusStyle,
      } satisfies ReservationGroupSummary;
    });
  }, [displayedReservationDetails]);

  if (reservationGroups.length === 0) {
    return <>{children}</>;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        className="w-96 max-w-lg max-h-[26rem] overflow-hidden rounded-2xl"
        align="start"
        sideOffset={5}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Date</p>
              <h4 className="text-sm font-semibold leading-tight">
                {format(parseISO(date), "MMMM d, yyyy")}
              </h4>
            </div>
              <Badge variant="secondary" className="text-sm font-medium">
              {displayedReservationDetails.length} Room
              {displayedReservationDetails.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <Separator />

          <div
            
            className="w-full max-h-[18rem] [&_[data-radix-scroll-area-viewport]]:max-h-[18rem] overflow-y-auto scrollbar-hide"
          >
            <div className="space-y-4 text-sm">
              {reservationGroups.map((group) => {
                const groupedRoomTypes = groupRoomsByType(group.rooms);

                return (
                  <div
                    key={group.bookingId}
                    className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-semibold leading-snug text-foreground">
                          {group.guestName}
                        </p>
                        {group.guestsText && (
                          <p className="text-sm text-muted-foreground">
                            {group.guestsText}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Booking ID: {formatBookingId(group.bookingId)}
                        </p>
                        {group.rooms[0]?.id && (
                          <div>
                            <Link
                              href={`/admin/reservations/${group.rooms[0].id}`}
                              className="text-sm font-semibold text-primary hover:underline"
                              aria-label={`View reservation ${formatBookingId(group.bookingId)}`}
                            >
                              View reservation details
                            </Link>
                          </div>
                        )}
                      </div>
                      <Badge className={cn("text-sm", group.statusStyle.ribbon)}>
                        {group.statusLabel}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm font-medium text-muted-foreground">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Booking Date</p>
                        <p className="text-foreground">
                          {format(group.bookingDate, "MMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Nights</p>
                        <p className="text-foreground">{group.nights}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Check-in</p>
                        <p className="text-foreground">
                          {format(group.checkIn, "MMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Check-out</p>
                        <p className="text-foreground">
                          {format(group.checkOut, "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-secondary/40 p-3">
                      <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Rooms</span>
                        <span>
                          {group.rooms.length} room
                          {group.rooms.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-3 divide-y divide-border/40 rounded-lg border border-border/40 bg-background/70">
                        {groupedRoomTypes.map((roomType) => {
                          const roomList =
                            roomType.roomNumbers.length > 0
                              ? roomType.roomNumbers.join(", ")
                              : "Pending assignment";

                          return (
                            <div
                              key={roomType.label}
                              className="flex flex-col gap-1 px-3 py-3"
                              aria-label={`${roomType.label} with ${roomType.count} room${
                                roomType.count > 1 ? "s" : ""
                              }. Rooms: ${roomList}`}
                            >
                              <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                                <span>{roomType.label}</span>
                                <span className="text-sm font-medium text-primary">
                                  {roomType.count}x
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground/80">
                                  Rooms:
                                </span>
                                <span>{roomList}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
