"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { ReservationHoverCard } from "@/components/shared/reservation-hover-card";
import type {
  AvailabilityCellStatus,
  RoomTypeAvailability,
  UnitsViewMode,
  Guest,
} from "@/data/types";
import { cn } from "@/lib/utils";
import { useDataContext } from "@/context/data-context";

const availabilityStatusClasses: Record<AvailabilityCellStatus, string> = {
  free: "bg-emerald-400 border border-emerald-200",
  partial: "bg-amber-400 border border-amber-200",
  busy: "bg-red-400 border border-red-200",
  closed: "bg-slate-400 border border-slate-200",
};

const bookedPillClasses =
  "relative flex h-11 min-w-0 w-full items-center justify-center overflow-hidden rounded-xl border border-indigo-300 bg-indigo-300 px-2 text-xs font-semibold text-indigo-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const roomHoldPillClasses = "border-amber-300 bg-amber-200 text-amber-950";

const pendingPillClasses = "border-orange-300 bg-orange-200 text-orange-950";

const cellBaseClasses =
  "relative flex min-h-[60px] min-w-0 w-full items-center justify-center rounded-none px-2 text-lg font-semibold transition focus-visible:outline-none";

interface RoomTypeRowProps {
  data: RoomTypeAvailability;
  unitsView: UnitsViewMode;
  showPartialDays: boolean;
  todayIso: string;
  onCellClick?: (roomTypeId: string, date: string, status: AvailabilityCellStatus, isClosed: boolean) => void;
  selectedCell?: { roomTypeId: string; date: string } | null;
  activeReservationCardId?: string | null;
  onActiveReservationCardChange?: (cardId: string | null) => void;
}

export function RoomTypeRow({
  data,
  unitsView,
  showPartialDays,
  todayIso,
  onCellClick,
  selectedCell,
  activeReservationCardId,
  onActiveReservationCardChange,
}: RoomTypeRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { roomType, availability } = data;
  const { guests } = useDataContext();
  const activeReservationCardScope = `${roomType.id}:`;

  const guestMap = React.useMemo(() => {
    return new Map<string, Guest>(guests.map((guest) => [guest.id, guest]));
  }, [guests]);

  const getGuestName = React.useCallback(
    (guestId: string) => {
      const guest = guestMap.get(guestId);
      if (!guest) {
        return "Guest";
      }
      return `${guest.firstName} ${guest.lastName}`.trim();
    },
    [guestMap]
  );

  if (roomType.units <= 0) {
    return null;
  }

  const canExpand = roomType.rooms.length > 0;

  const toggleExpand = () => {
    if (canExpand) {
      setIsExpanded((prev) => {
        const nextExpanded = !prev;
        if (
          !nextExpanded &&
          activeReservationCardId?.startsWith(activeReservationCardScope)
        ) {
          onActiveReservationCardChange?.(null);
        }
        return nextExpanded;
      });
    }
  };

  const getDisplayStatus = (
    status: AvailabilityCellStatus
  ): AvailabilityCellStatus => {
    if (!showPartialDays && status === "partial") {
      return "free";
    }
    return status;
  };

  const handleCellClick = (
    date: string,
    status: AvailabilityCellStatus,
    isClosed: boolean
  ) => {
    if (onCellClick) {
      onCellClick(roomType.id, date, status, isClosed);
    }
  };

  return (
    <>
      {/* Aggregated Room Type Row */}
      <TableRow className="bg-transparent text-sm hover:bg-transparent data-[state=selected]:bg-transparent">
        <TableCell
          className="sticky left-0 z-20 border-r border-b border-border/50 bg-card px-2 sm:px-4"
          style={{
            width: "var(--avail-label-w)",
            minWidth: "var(--avail-label-w)",
            maxWidth: "var(--avail-label-w)",
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleExpand}
              disabled={!canExpand}
              className={cn(
                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground",
                canExpand ? "bg-white hover:bg-secondary" : "cursor-not-allowed opacity-40"
              )}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className="max-w-full truncate text-sm font-semibold text-foreground"
                title={roomType.name}
              >
                {roomType.name}
              </span>
              <Badge variant="secondary" className="w-fit text-[11px] font-medium text-foreground">
                {roomType.units} {roomType.units === 1 ? "unit" : "units"}
              </Badge>
            </div>
          </div>
        </TableCell>
        {availability.map((day) => {
          const baseStatus = getDisplayStatus(day.status);
          const isSelected =
            selectedCell?.roomTypeId === roomType.id &&
            selectedCell?.date === day.date;
          const bookedUnits = day.bookedCount;
          const remainingUnits = Math.max(day.unitsTotal - bookedUnits, 0);
          const showNumber =
            unitsView === "booked"
              ? bookedUnits || ""
              : bookedUnits === 0
                ? ""
                : remainingUnits;

          const isDisabled =
            baseStatus === "busy" || baseStatus === "closed" || day.isClosed;

          const isTodayColumn = todayIso === day.date;
          const formattedDate = format(parseISO(day.date), "MMMM d, yyyy");
          const metricLabel =
            unitsView === "booked"
              ? bookedUnits === 0
                ? "No units booked"
                : `${bookedUnits} ${bookedUnits === 1 ? "unit" : "units"} booked`
              : remainingUnits === 0
                ? "No units left"
                : `${remainingUnits} ${remainingUnits === 1 ? "unit" : "units"} left`;
          const ariaLabel = `${metricLabel} on ${formattedDate}`;
          const columnTextClass = isTodayColumn
            ? "text-white"
            : "text-white";

          const cellContent = (
            <button
              type="button"
              className={cn(
                cellBaseClasses,
                availabilityStatusClasses[baseStatus],
                columnTextClass,
                isDisabled && "cursor-not-allowed",
                !isDisabled && "cursor-pointer",
                isSelected && "outline outline-2 outline-offset-[-2px]",
                isTodayColumn && "bg-primary border-0 text-white"
              )}
              onClick={() =>
                handleCellClick(day.date, baseStatus, day.isClosed)
              }
              disabled={isDisabled}
              aria-label={ariaLabel}
            >
              <div className="flex items-center justify-center">
                {/* — line */}
                <span
                  className={cn(
                    "leading-none",
                    columnTextClass
                  )}
                >
                  {showNumber === "" ? "—" : showNumber}
                </span>
              </div>
              {day.isClosed && (
                <div
                  className={cn(
                    "absolute inset-x-2 bottom-1 flex items-center justify-center gap-1 text-[10px] font-medium",
                    columnTextClass
                  )}
                >
                  <Lock className={cn("h-3 w-3", columnTextClass)} />
                  <span>Closed</span>
                </div>
              )}
            </button>
          );

          return (
            <TableCell
              key={day.date}
              className="overflow-hidden p-0"
              style={{
                width: "var(--avail-day-w)",
                minWidth: "var(--avail-day-w)",
                maxWidth: "var(--avail-day-w)",
              }}
            >
              {cellContent}
            </TableCell>
          );
        })}
        <TableCell aria-hidden="true" className="border-b border-border/50 p-0" />
      </TableRow>

      {/* Expanded: Individual Room Number Rows */}
      {isExpanded &&
        roomType.rooms.map((room) => (
          <TableRow key={room.id} className="text-sm hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableCell
              className="sticky left-0 z-20 border-r border-b border-border/40 bg-card"
              style={{
                width: "var(--avail-label-w)",
                minWidth: "var(--avail-label-w)",
                maxWidth: "var(--avail-label-w)",
              }}
            >
              <div className="flex items-center gap-2 pl-4 text-muted-foreground sm:pl-8">
                <span>→</span>
                <span className="font-semibold text-foreground">
                  Room {room.roomNumber}
                </span>
              </div>
            </TableCell>
            {(() => {
              const dayCells: React.ReactNode[] = [];
              for (let index = 0; index < availability.length; index++) {
                const day = availability[index];
                const entry = day.roomReservations?.[room.id] ?? null;
                const isTodayColumn = todayIso === day.date;
                const isClosed = day.isClosed === true;
                const columnTextClass = isTodayColumn
                  ? "text-white"
                  : "text-muted-foreground/70";

                if (entry) {
                  let span = 0;
                  for (let offset = index; offset < availability.length; offset++) {
                    const compareDay = availability[offset];
                    const compareEntry = compareDay.roomReservations?.[room.id];
                    if (!compareEntry || compareEntry.reservationId !== entry.reservationId) {
                      break;
                    }
                    span += 1;
                  }

                  const guestName = getGuestName(entry.guestId);
                  const reservationCardId = `${roomType.id}:${room.id}:${entry.reservationId}:${day.date}`;
                  const pillTextClass =
                    entry.status === "Room Hold"
                      ? "text-amber-950"
                      : entry.status === "Pending"
                        ? "text-orange-950"
                        : columnTextClass;
                  dayCells.push(
                    <TableCell
                      key={`${room.id}-${entry.reservationId}-${day.date}`}
                      className="overflow-hidden p-0"
                      colSpan={span}
                    >
                      <ReservationHoverCard
                        reservationIds={[entry.reservationId]}
                        date={day.date}
                        cardId={reservationCardId}
                        activeCardId={activeReservationCardId}
                        onActiveCardChange={onActiveReservationCardChange}
                      >
                        <button
                          type="button"
                          className={cn(
                            bookedPillClasses,
                            entry.status === "Room Hold" && roomHoldPillClasses,
                            entry.status === "Pending" && pendingPillClasses,
                            pillTextClass,
                            "cursor-pointer",
                            isTodayColumn &&
                              entry.status !== "Room Hold" &&
                              entry.status !== "Pending" &&
                              "bg-primary border-primary text-white shadow-[0_0_0_2px_rgba(15,118,110,0.15)]"
                          )}
                          aria-label={`View booking details for ${guestName} in Room ${
                            room.roomNumber
                          } on ${format(parseISO(day.date), "MMMM d, yyyy")}`}
                        >
                          <span
                            className={cn(
                              "max-w-full truncate text-sm font-semibold",
                              pillTextClass
                            )}
                          >
                            {guestName}
                          </span>
                        </button>
                      </ReservationHoverCard>
                    </TableCell>
                  );
                  index += span - 1;
                  continue;
                }

                const roomStatus: AvailabilityCellStatus = isClosed ? "closed" : "free";
                dayCells.push(
                  <TableCell
                    key={`${room.id}-${day.date}`}
                    className="overflow-hidden p-0"
                    style={{
                      width: "var(--avail-day-w)",
                      minWidth: "var(--avail-day-w)",
                      maxWidth: "var(--avail-day-w)",
                    }}
                  >
                    <div
                      className={cn(
                        cellBaseClasses,
                        availabilityStatusClasses[roomStatus],
                        columnTextClass,
                        isTodayColumn && "bg-primary border-primary text-white shadow-[0_0_0_2px_rgba(15,118,110,0.15)]"
                      )}
                    >
                      {isClosed && (
                        <Lock className={cn("h-3 w-3", columnTextClass)} />
                      )}
                    </div>
                  </TableCell>
                );
              }
              dayCells.push(
                <TableCell
                  key={`${room.id}-trailing-scroll-space`}
                  aria-hidden="true"
                  className="border-b border-border/40 p-0"
                />
              );
              return dayCells;
            })()}
          </TableRow>
        ))}


    </>
  );
}
