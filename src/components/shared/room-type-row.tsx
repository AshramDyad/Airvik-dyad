"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReservationHoverCard } from "@/components/shared/reservation-hover-card";
import type {
  AvailabilityCellStatus,
  RoomDayReservation,
  RoomTypeAvailability,
  UnitsViewMode,
} from "@/data/types";
import type { CalendarReservationDetail } from "@/lib/calendar/reservation-details";
import { cn } from "@/lib/utils";

const availabilityStatusClasses: Record<AvailabilityCellStatus, string> = {
  free: "bg-emerald-400 border border-emerald-200",
  partial: "bg-amber-400 border border-amber-200",
  busy: "bg-red-400 border border-red-200",
  closed: "bg-slate-400 border border-slate-200",
};

const bookedPillClasses =
  "relative flex h-11 w-full items-center justify-center rounded-xl border border-indigo-300 bg-indigo-300 px-4 text-xs font-semibold text-indigo-900 transition-all";

const cellBaseClasses =
  "relative flex min-h-[60px] w-full items-center justify-center rounded-none px-6 text-lg font-semibold transition focus-visible:outline-none";

const formatName = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();

interface RoomTypeRowProps {
  data: RoomTypeAvailability;
  unitsView: UnitsViewMode;
  showPartialDays: boolean;
  todayIso: string;
  onCellClick?: (roomTypeId: string, date: string, status: AvailabilityCellStatus, isClosed: boolean) => void;
  selectedCell?: { roomTypeId: string; date: string } | null;
  reservationDetailsById: ReadonlyMap<string, CalendarReservationDetail>;
}

export function RoomTypeRow({
  data,
  unitsView,
  showPartialDays,
  todayIso,
  onCellClick,
  selectedCell,
  reservationDetailsById,
}: RoomTypeRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { roomType, availability } = data;

  const getGuestName = React.useCallback(
    (entry: RoomDayReservation) => {
      const detail = reservationDetailsById.get(entry.reservationId);
      return (
        formatName(
          detail?.guestSnapshot.firstName,
          detail?.guestSnapshot.lastName,
        ) || "Guest"
      );
    },
    [reservationDetailsById],
  );

  if (roomType.units <= 0) {
    return null;
  }

  const canExpand = roomType.rooms.length > 0;

  const toggleExpand = () => {
    if (canExpand) {
      setIsExpanded((prev) => !prev);
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
        <TableCell className="sticky left-0 z-20 border-r border-b border-border/50 bg-card">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleExpand}
              disabled={!canExpand}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground",
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
            <div className="flex flex-col gap-1">
              <span
                className="max-w-[14rem] truncate text-sm font-semibold text-foreground"
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

          const hasBookings = day.reservationIds && day.reservationIds.length > 0;

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
            <TableCell key={day.date} className="p-0">
              {bookedUnits === 0 ? (
                cellContent
              ) : hasBookings ? (
                <ReservationHoverCard
                  reservationIds={day.reservationIds}
                  date={day.date}
                  reservationDetailsById={reservationDetailsById}
                >
                  {cellContent}
                </ReservationHoverCard>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {cellContent}
                  </TooltipTrigger>
                  <TooltipContent className="text-sm">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {day.bookedCount} of {day.unitsTotal} units booked
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(day.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </TableCell>
          );
        })}
      </TableRow>

      {/* Expanded: Individual Room Number Rows */}
      {isExpanded &&
        roomType.rooms.map((room) => (
          <TableRow key={room.id} className="text-sm hover:bg-transparent data-[state=selected]:bg-transparent">
            <TableCell className="sticky left-0 z-20 border-r border-b border-border/40 bg-card">
              <div className="flex items-center gap-2 pl-8 text-muted-foreground">
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

                  const guestName = getGuestName(entry);
                  dayCells.push(
                    <TableCell
                      key={`${room.id}-${entry.reservationId}-${day.date}`}
                      className="p-0"
                      colSpan={span}
                    >
                      <ReservationHoverCard
                        reservationIds={[entry.reservationId]}
                        date={day.date}
                        reservationDetailsById={reservationDetailsById}
                      >
                        <div
                          className={cn(
                            bookedPillClasses,
                            columnTextClass,
                            "cursor-pointer",
                            isTodayColumn && "bg-primary border-primary text-white shadow-[0_0_0_2px_rgba(15,118,110,0.15)]"
                          )}
                        >
                          <span className={cn("max-w-full truncate text-sm font-semibold", columnTextClass)}>
                            {guestName}
                          </span>
                        </div>
                      </ReservationHoverCard>
                    </TableCell>
                  );
                  index += span - 1;
                  continue;
                }

                const roomStatus: AvailabilityCellStatus = isClosed ? "closed" : "free";
                dayCells.push(
                  <TableCell key={`${room.id}-${day.date}`} className="p-0">
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
              return dayCells;
            })()}
          </TableRow>
        ))}


    </>
  );
}
