"use client";

import * as React from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDataContext } from "@/context/data-context";
import type { Reservation, ReservationStatus } from "@/data/types";
import { getReservationById, getReservationsByBookingId } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  getReservationStatusLabel,
  isActiveReservationStatus,
} from "@/lib/reservations/status";

const reservationStatusStyles: Record<
  ReservationStatus,
  { ribbon: string; dot: string }
> = {
  "Room Hold": {
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
  reservation: Reservation;
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
}

const BOOKING_ID_VISIBLE_LENGTH = 7 as const;
const HOVER_CLOSE_DELAY_MS = 180;

type OpenMode = "hover" | "focus" | "click";

type TriggerElementProps = React.HTMLAttributes<HTMLElement> & {
  disabled?: boolean;
};

function formatBookingId(id: string): string {
  if (!id) return "-";
  if (id.length <= BOOKING_ID_VISIBLE_LENGTH) return id;
  return id.slice(-BOOKING_ID_VISIBLE_LENGTH);
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

function mergeReservations(
  existing: Reservation[],
  incoming: Reservation[]
): Reservation[] {
  const merged = new Map(
    existing.map((reservation) => [reservation.id, reservation])
  );

  incoming.forEach((reservation) => {
    merged.set(reservation.id, reservation);
  });

  return Array.from(merged.values());
}

function composeEventHandlers<Event extends React.SyntheticEvent>(
  originalHandler: ((event: Event) => void) | undefined,
  nextHandler: (event: Event) => void
) {
  return (event: Event) => {
    originalHandler?.(event);
    if (!event.defaultPrevented) {
      nextHandler(event);
    }
  };
}

export function ReservationHoverCard({
  children,
  reservationIds,
  date,
}: ReservationHoverCardProps) {
  const { reservations, guests, rooms, roomTypes } = useDataContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const [fetchedReservations, setFetchedReservations] = React.useState<
    Reservation[]
  >([]);
  const [failedReservationIds, setFailedReservationIds] = React.useState<
    Set<string>
  >(() => new Set());
  const [isFetchingDetails, setIsFetchingDetails] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const openModeRef = React.useRef<OpenMode | null>(null);
  const pendingReservationIdsRef = React.useRef<Set<string>>(new Set());
  const activeFetchCountRef = React.useRef(0);
  const isMountedRef = React.useRef(true);

  const hoverDate = React.useMemo(() => {
    const parsed = parseISO(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [date]);
  const targetReservationIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          reservationIds
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        )
      ),
    [reservationIds]
  );

  const combinedReservations = React.useMemo(() => {
    const merged = new Map<string, Reservation>();

    fetchedReservations.forEach((reservation) => {
      merged.set(reservation.id, reservation);
    });
    reservations.forEach((reservation) => {
      merged.set(reservation.id, reservation);
    });

    return Array.from(merged.values());
  }, [fetchedReservations, reservations]);

  const combinedReservationMap = React.useMemo(
    () =>
      new Map(
        combinedReservations.map((reservation) => [reservation.id, reservation])
      ),
    [combinedReservations]
  );

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openForTransientInteraction = React.useCallback(
    (mode: Exclude<OpenMode, "click">) => {
      clearCloseTimer();
      if (openModeRef.current !== "click") {
        openModeRef.current = mode;
        setIsOpen(true);
      }
    },
    [clearCloseTimer]
  );

  const openForClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      clearCloseTimer();
      openModeRef.current = "click";
      setIsOpen(true);
      event.preventDefault();
    },
    [clearCloseTimer]
  );

  const scheduleTransientClose = React.useCallback(() => {
    if (openModeRef.current === "click") {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      openModeRef.current = null;
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      clearCloseTimer();
      if (nextOpen) {
        openModeRef.current = "click";
        setIsOpen(true);
        return;
      }

      openModeRef.current = null;
      setIsOpen(false);
    },
    [clearCloseTimer]
  );

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  React.useEffect(() => {
    if (!isOpen || targetReservationIds.length === 0) {
      return;
    }

    const missingReservationIds = targetReservationIds.filter(
      (id) =>
        !combinedReservationMap.has(id) &&
        !failedReservationIds.has(id) &&
        !pendingReservationIdsRef.current.has(id)
    );

    if (missingReservationIds.length === 0) {
      return;
    }

    missingReservationIds.forEach((id) => {
      pendingReservationIdsRef.current.add(id);
    });
    activeFetchCountRef.current += 1;
    setIsFetchingDetails(true);

    const loadMissingReservations = async () => {
      const fetched: Reservation[] = [];
      const failedIds: string[] = [];

      const primaryReservations = await Promise.all(
        missingReservationIds.map(async (id) => {
          try {
            const result = await getReservationById(id);
            if (!result.data) {
              failedIds.push(id);
              return null;
            }
            return result.data;
          } catch {
            failedIds.push(id);
            return null;
          }
        })
      );

      const resolvedPrimaryReservations = primaryReservations.filter(
        (reservation): reservation is Reservation => reservation !== null
      );
      fetched.push(...resolvedPrimaryReservations);

      const bookingIds = Array.from(
        new Set(
          resolvedPrimaryReservations
            .map((reservation) => reservation.bookingId || reservation.id)
            .filter((bookingId) => bookingId.length > 0)
        )
      );

      const bookingReservationGroups = await Promise.all(
        bookingIds.map(async (bookingId) => {
          try {
            const result = await getReservationsByBookingId(bookingId);
            return result.data;
          } catch {
            return [];
          }
        })
      );

      bookingReservationGroups.forEach((bookingReservations) => {
        fetched.push(...bookingReservations);
      });

      if (isMountedRef.current) {
        if (fetched.length > 0) {
          setFetchedReservations((current) =>
            mergeReservations(current, fetched)
          );
        }

        if (failedIds.length > 0) {
          setFailedReservationIds((current) => {
            const next = new Set(current);
            failedIds.forEach((id) => next.add(id));
            return next;
          });
        }
      }

      missingReservationIds.forEach((id) => {
        pendingReservationIdsRef.current.delete(id);
      });
      activeFetchCountRef.current = Math.max(
        0,
        activeFetchCountRef.current - 1
      );

      if (isMountedRef.current && activeFetchCountRef.current === 0) {
        setIsFetchingDetails(false);
      }
    };

    void loadMissingReservations();
  }, [
    combinedReservationMap,
    failedReservationIds,
    isOpen,
    targetReservationIds,
  ]);

  const reservationDetails = React.useMemo<ReservationDetail[]>(() => {
    const guestMap = new Map(guests.map((guest) => [guest.id, guest]));
    const roomMap = new Map(rooms.map((room) => [room.id, room]));
    const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt]));
    const reservationMap = new Map(
      combinedReservations.map((reservation) => [reservation.id, reservation])
    );

    const details: ReservationDetail[] = [];
    const targetBookingIds = new Set<string>();
    const seenReservationIds = new Set<string>();

    const includeReservationDetail = (reservation: Reservation | undefined) => {
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

      const guest = guestMap.get(reservation.guestId);
      const room = roomMap.get(reservation.roomId);
      const roomType = room ? roomTypeMap.get(room.roomTypeId) : undefined;
      const snapshotFirstName = reservation.guestSnapshot?.firstName ?? null;
      const snapshotLastName = reservation.guestSnapshot?.lastName ?? null;
      const snapshotName = [snapshotFirstName, snapshotLastName]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" ");
      const firstName = guest?.firstName ?? snapshotFirstName;
      const lastName = guest?.lastName ?? snapshotLastName;

      details.push({
        reservation,
        guestName: guest
          ? `${guest.firstName} ${guest.lastName}`
          : snapshotName || "Unknown Guest",
        customerTitle: null,
        customerFirstName: firstName,
        customerLastName: lastName,
        adultCount: Number.isFinite(reservation.adultCount)
          ? reservation.adultCount
          : reservation.numberOfGuests ?? 0,
        childCount: Number.isFinite(reservation.childCount)
          ? reservation.childCount
          : 0,
        roomNumber: room?.roomNumber,
        roomTypeName: roomType?.name,
      });

      seenReservationIds.add(reservation.id);
      const bookingKey = reservation.bookingId || reservation.id;
      if (bookingKey) {
        targetBookingIds.add(bookingKey);
      }
    };

    targetReservationIds.forEach((id) => {
      includeReservationDetail(reservationMap.get(id));
    });

    if (targetBookingIds.size > 0) {
      reservationMap.forEach((reservation) => {
        const bookingKey = reservation.bookingId || reservation.id;
        if (targetBookingIds.has(bookingKey)) {
          includeReservationDetail(reservation);
        }
      });
    }

    return details;
  }, [
    targetReservationIds,
    combinedReservations,
    guests,
    rooms,
    roomTypes,
    hoverDate,
  ]);

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

    const groups = new Map<
      string,
      {
        bookingId: string;
        guestName: string;
        bookingDate: Date;
        checkIn: Date;
        checkOut: Date;
        nights: number;
        rooms: Array<{ id: string; roomNumber?: string; roomTypeName?: string }>;
        statuses: Set<ReservationStatus>;
        totals: GuestTotals;
      }
    >();

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
      existing.checkIn =
        checkIn < existing.checkIn ? checkIn : existing.checkIn;
      existing.checkOut =
        checkOut > existing.checkOut ? checkOut : existing.checkOut;
      existing.nights = Math.max(existing.nights, nights);
      existing.statuses.add(reservation.status);
      existing.totals = accumulateGuestTotals(existing.totals, detail);
    });

    return Array.from(groups.values()).map((group) => {
      const statusLabel =
        group.statuses.size === 1 ? [...group.statuses][0] : "Mixed";
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
          const typeCompare = (a.roomTypeName || "").localeCompare(
            b.roomTypeName || ""
          );
          if (typeCompare !== 0) return typeCompare;
          return (a.roomNumber || "").localeCompare(
            b.roomNumber || "",
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );
        }),
        statusLabel,
        statusStyle,
      } satisfies ReservationGroupSummary;
    });
  }, [displayedReservationDetails]);

  const hasMissingReservationIds = targetReservationIds.some(
    (id) => !combinedReservationMap.has(id)
  );
  const missingReservationIdsFailed =
    targetReservationIds.length > 0 &&
    targetReservationIds.every(
      (id) => combinedReservationMap.has(id) || failedReservationIds.has(id)
    );
  const showLoadingState =
    reservationGroups.length === 0 &&
    (isFetchingDetails ||
      (hasMissingReservationIds && !missingReservationIdsFailed));

  const triggerChild = React.isValidElement<TriggerElementProps>(children) ? (
    React.cloneElement(children, {
      onMouseEnter: composeEventHandlers(
        children.props.onMouseEnter,
        () => openForTransientInteraction("hover")
      ),
      onMouseLeave: composeEventHandlers(
        children.props.onMouseLeave,
        scheduleTransientClose
      ),
      onFocus: composeEventHandlers(
        children.props.onFocus,
        () => openForTransientInteraction("focus")
      ),
      onBlur: composeEventHandlers(
        children.props.onBlur,
        scheduleTransientClose
      ),
      onClick: composeEventHandlers(children.props.onClick, openForClick),
    })
  ) : (
    <span
      onMouseEnter={() => openForTransientInteraction("hover")}
      onMouseLeave={scheduleTransientClose}
      onFocus={() => openForTransientInteraction("focus")}
      onBlur={scheduleTransientClose}
      onClick={openForClick}
    >
      {children}
    </span>
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{triggerChild}</PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[calc(100vw-1.5rem)] max-h-[26rem] overflow-hidden rounded-xl p-3 sm:w-96"
        align="start"
        side="bottom"
        sideOffset={5}
        collisionBoundary={[]}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={() => openForTransientInteraction("hover")}
        onMouseLeave={scheduleTransientClose}
        onFocus={() => openForTransientInteraction("focus")}
        onBlur={scheduleTransientClose}
      >
        <div>
          {reservationGroups.length > 0 ? (
            <div className="w-full max-h-[24rem] [&_[data-radix-scroll-area-viewport]]:max-h-[24rem] overflow-y-auto scrollbar-hide">
              <div className="space-y-3 text-sm">
                {reservationGroups.map((group) => {
                  const groupedRoomTypes = groupRoomsByType(group.rooms);

                  return (
                    <div
                      key={group.bookingId}
                      className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
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
                                aria-label={`View reservation ${formatBookingId(
                                  group.bookingId
                                )}`}
                              >
                                View reservation details
                              </Link>
                            </div>
                          )}
                        </div>
                        <Badge
                          className={cn("text-xs", group.statusStyle.ribbon)}
                        >
                          {group.statusLabel === "Mixed"
                            ? group.statusLabel
                            : getReservationStatusLabel(group.statusLabel)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide">
                            Booking Date
                          </p>
                          <p className="text-foreground">
                            {format(group.bookingDate, "MMM d, yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide">
                            Nights
                          </p>
                          <p className="text-foreground">{group.nights}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide">
                            Check-in
                          </p>
                          <p className="text-foreground">
                            {format(group.checkIn, "MMM d, yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide">
                            Check-out
                          </p>
                          <p className="text-foreground">
                            {format(group.checkOut, "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-secondary/40 p-2">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>Rooms</span>
                          <span>
                            {group.rooms.length} room
                            {group.rooms.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="mt-2 divide-y divide-border/40 rounded-md border border-border/40 bg-background/70">
                          {groupedRoomTypes.map((roomType) => {
                            const roomList =
                              roomType.roomNumbers.length > 0
                                ? roomType.roomNumbers.join(", ")
                                : "Pending assignment";

                            return (
                              <div
                                key={roomType.label}
                                className="flex flex-col gap-1 px-2 py-2"
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
                                <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">
                {showLoadingState
                  ? "Loading reservation details..."
                  : "Reservation details unavailable"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {showLoadingState
                  ? "Fetching the booking linked to this calendar cell."
                  : "The booking could not be loaded for this calendar cell."}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
