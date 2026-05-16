"use client";

import * as React from "react";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  UnitsViewMode,
  AvailabilityCellStatus,
  RoomTypeAvailability,
} from "@/data/types";
import { useDataContext } from "@/context/data-context";
import {
  formatMonthStart,
  useMultiMonthAvailability,
} from "@/hooks/use-monthly-availability";
import { useCalendarReservationDetails } from "@/hooks/use-calendar-reservation-details";
import { RoomTypeRow } from "@/components/shared/room-type-row";
import { cn } from "@/lib/utils";
import { useFullscreen } from "@/hooks/use-fullscreen";

type SelectedCell = {
  roomTypeId: string;
  date: string;
};

const availabilityDotClasses: Record<AvailabilityCellStatus, string> = {
  free: "bg-emerald-500",
  partial: "bg-amber-500",
  busy: "bg-rose-600",
  closed: "bg-slate-500",
};

const legendStatuses: Array<{ key: AvailabilityCellStatus; label: string }> = [
  { key: "free", label: "Free" },
  { key: "partial", label: "Partially booked" },
  { key: "busy", label: "Fully booked" },
  { key: "closed", label: "Closed" },
];

export function AvailabilityCalendar() {
  const { property } = useDataContext();
  const [currentMonth, setCurrentMonth] = React.useState(
    startOfMonth(new Date())
  );
  const [selectedCell, setSelectedCell] = React.useState<SelectedCell | null>(
    null
  );
  const [unitsView, setUnitsView] = React.useState<UnitsViewMode>(
    property.defaultUnitsView
  );
  const [rpcError, setRpcError] = React.useState<Error | null>(null);
  const [visibleMonths, setVisibleMonths] = React.useState(1);
  const { elementRef, isFullscreen, toggleFullscreen } = useFullscreen<HTMLDivElement>();

  const monthSequence = React.useMemo(() => {
    return Array.from({ length: visibleMonths }, (_, index) =>
      startOfMonth(addMonths(currentMonth, index))
    );
  }, [currentMonth, visibleMonths]);
  const { dataByMonth, isLoading, error } = useMultiMonthAvailability(
    currentMonth,
    visibleMonths
  );
  const visibleReservationIds = React.useMemo(
    () => collectAvailabilityReservationIds(dataByMonth),
    [dataByMonth],
  );
  const { detailsById: reservationDetailsById } =
    useCalendarReservationDetails(visibleReservationIds);
  const hasAvailability = React.useMemo(() => {
    return monthSequence.some((monthDate) => {
      const monthKey = formatMonthStart(monthDate);
      const availability = dataByMonth[monthKey];
      if (!availability) {
        return false;
      }
      return availability.some((room) => room.roomType.units > 0);
    });
  }, [dataByMonth, monthSequence]);

  const monthOptions = React.useMemo(
    () => buildMonthOptions(currentMonth),
    [currentMonth]
  );
  const todayIso = React.useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  React.useEffect(() => {
    setUnitsView(property.defaultUnitsView);
  }, [property.defaultUnitsView]);

  React.useEffect(() => {
    setRpcError(error ?? null);
  }, [error]);

  React.useEffect(() => {
    if (error) {
      console.error("Failed to load monthly availability", error);
    }
  }, [error]);

  React.useEffect(() => {
    setSelectedCell(null);
  }, [currentMonth, visibleMonths]);

  const handleMonthSelect = (value: string) => {
    const parsed = parseISO(value);
    setCurrentMonth(startOfMonth(parsed));
  };

  const handleVisibleMonthsChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    setVisibleMonths(Math.max(1, Math.min(12, parsed)));
  };

  const handleCellSelection = (
    roomTypeId: string,
    date: string,
    status: AvailabilityCellStatus,
    isClosed: boolean
  ) => {
    if (status === "busy" || status === "closed" || isClosed) {
      return;
    }
    setSelectedCell((prev) =>
      prev && prev.roomTypeId === roomTypeId && prev.date === date
        ? null
        : { roomTypeId, date }
    );
  };

  return (
    <div
      ref={elementRef}
      className={cn(
        "rounded-3xl border border-border/60 bg-card shadow-xl transition-all duration-300",
        isFullscreen && "fixed inset-0 z-[100] h-screen w-screen overflow-auto rounded-none border-none shadow-none"
      )}
    >
      <div className="border-b border-border/50 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                className="h-9 w-9 rounded-xl flex-shrink-0"
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={format(currentMonth, "yyyy-MM-dd")}
                onValueChange={handleMonthSelect}
              >
                <SelectTrigger
                  aria-label="Select calendar month"
                  className="min-w-[160px] rounded-xl border bg-transparent focus:outline-none text-sm font-semibold"
                >
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(({ label, value }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                className="h-9 w-9 rounded-xl flex-shrink-0"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              <Select
                value={String(visibleMonths)}
                onValueChange={handleVisibleMonthsChange}
              >
                <SelectTrigger
                  id="availability-months"
                  aria-label="Visible calendar months"
                  className="h-14 min-w-[130px] rounded-xl border border-border/60 bg-card/60 text-sm font-semibold text-foreground"
                >
                  <SelectValue placeholder="Months" />
                </SelectTrigger>
                <SelectContent align="end">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} {count === 1 ? "Month" : "Months"}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <Select
              value={unitsView}
              onValueChange={(value) => setUnitsView(value as UnitsViewMode)}
            >
              <SelectTrigger
                aria-label="Calendar units view"
                className="h-14 min-w-[150px] rounded-xl border border-border/60 bg-card/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remaining">Units left</SelectItem>
                <SelectItem value="booked">Units booked</SelectItem>
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    className="h-14 w-14 rounded-xl border border-border/60 bg-card/60 flex-shrink-0"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <Maximize2 className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
            {legendStatuses
              .filter(
                (status) => property.showPartialDays || status.key !== "partial"
              )
              .map((status) => (
                <div
                  key={status.key}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 shadow-sm"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      availabilityDotClasses[status.key]
                    )}
                  />
                  <span>{status.label}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-5">
        {rpcError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-medium">
              Unable to load aggregated availability.
            </p>
            <p className="mt-1 text-destructive/80">
              Change the month to retry, or dismiss this message.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setRpcError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-[700px] w-full rounded-2xl" />
        ) : hasAvailability ? (
          <TooltipProvider delayDuration={0}>
            <div className="space-y-6">
              {monthSequence.map((monthDate, index) => {
                const monthKey = formatMonthStart(monthDate);
                const monthAvailability = dataByMonth[monthKey] ?? [];
                const visibleMonthRooms = monthAvailability.filter(
                  (room) => room.roomType.units > 0
                );
                const headerSource =
                  visibleMonthRooms.length > 0
                    ? visibleMonthRooms
                    : monthAvailability;
                const headerDays = buildHeaderDays(headerSource, monthDate);
                const monthLabel = format(monthDate, "MMMM yyyy");

                return (
                  <section
                    key={monthKey}
                    className="overflow-hidden rounded-3xl border border-border/50 bg-card shadow-md"
                  >
                    {visibleMonthRooms.length > 0 ? (
                      <DragScrollContainer
                        ariaLabel={`Availability grid for ${monthLabel}`}
                        className="max-h-[calc(100vh-280px)] overflow-auto scrollbar-hide"
                      >
                        <Table className="min-w-max border-separate border-spacing-0" baseWrapper={false}>
                          <TableHeader className="sticky top-0 z-30 bg-card/95 backdrop-blur shadow-sm">
                            <TableRow>
                              <TableHead className="sticky left-0 z-40 w-56 border-r border-b border-border/40 bg-card/95 backdrop-blur px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                                <div>
                                  <p className="text-[11px]">Month</p>
                                  <p className="text-base font-semibold text-foreground">
                                    {monthLabel}
                                  </p>
                                </div>
                              </TableHead>
                              {headerDays.map((day) => {
                                const isTodayColumn = day.iso === todayIso;
                                return (
                                  <TableHead
                                    key={day.iso}
                                    className={cn(
                                      "min-w-[3.5rem] border-l border-b border-border/60 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide",
                                      isTodayColumn
                                        ? "bg-primary text-white shadow-[0_4px_20px_rgba(16,185,129,0.2)]"
                                        : "bg-card/95 backdrop-blur text-foreground"
                                    )}
                                  >
                                    <div>{format(day.date, "EEE")}</div>
                                    <div>{format(day.date, "d")}</div>
                                  </TableHead>
                                );
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleMonthRooms.map((room) => (
                              <RoomTypeRow
                                key={`${monthKey}-${room.roomType.id}`}
                                data={room}
                                unitsView={unitsView}
                                showPartialDays={property.showPartialDays}
                                todayIso={todayIso}
                                onCellClick={handleCellSelection}
                                selectedCell={selectedCell}
                                reservationDetailsById={reservationDetailsById}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </DragScrollContainer>
                    ) : (
                      <div className="px-4 pb-6">
                        <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-center text-sm text-muted-foreground">
                          Configure rooms to display availability for this
                          month.
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </TooltipProvider>
        ) : !rpcError ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-8 text-center text-sm text-muted-foreground">
            Configure rooms to see availability data.
          </div>
        ) : null}
      </div>
    </div>
  );
}

type DragScrollContainerProps = {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
};

function DragScrollContainer({
  children,
  ariaLabel,
  className,
}: DragScrollContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef({
    isPointerDown: false,
    startX: 0,
    scrollLeft: 0,
    dragged: false,
    pointerId: null as number | null,
    shouldPreventClick: false,
    hasCapture: false,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    dragState.current.isPointerDown = true;
    dragState.current.startX = event.clientX;
    dragState.current.scrollLeft = container.scrollLeft;
    dragState.current.dragged = false;
    dragState.current.shouldPreventClick = false;
    dragState.current.pointerId = event.pointerId;
    dragState.current.hasCapture = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.isPointerDown) {
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const deltaX = event.clientX - dragState.current.startX;
    if (!dragState.current.dragged && Math.abs(deltaX) > 3) {
      dragState.current.dragged = true;
      if (!dragState.current.hasCapture) {
        container.setPointerCapture(event.pointerId);
        dragState.current.hasCapture = true;
        container.classList.add("cursor-grabbing");
      }
    }
    if (dragState.current.dragged) {
      event.preventDefault();
      container.scrollLeft = dragState.current.scrollLeft - deltaX;
    }
  };

  const endDrag = () => {
    const container = containerRef.current;
    if (dragState.current.pointerId !== null && container && dragState.current.hasCapture) {
      container.releasePointerCapture(dragState.current.pointerId);
    }
    if (container) {
      container.classList.remove("cursor-grabbing");
    }
    if (dragState.current.dragged) {
      dragState.current.shouldPreventClick = true;
    }
    dragState.current.isPointerDown = false;
    dragState.current.pointerId = null;
    dragState.current.dragged = false;
    dragState.current.hasCapture = false;
  };

  const handlePointerUp = () => {
    endDrag();
  };

  const handlePointerLeave = () => {
    if (!dragState.current.isPointerDown) {
      return;
    }
    endDrag();
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current.shouldPreventClick) {
      event.preventDefault();
      event.stopPropagation();
      dragState.current.shouldPreventClick = false;
    }
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn("overflow-x-auto", className)}
        aria-label={ariaLabel}
        role="region"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
    </div>
  );
}

function buildHeaderDays(
  availability: RoomTypeAvailability[] | null | undefined,
  fallbackMonth: Date
) {
  if (availability && availability.length > 0) {
    const firstRoom = availability[0];
    if (firstRoom.availability.length > 0) {
      return firstRoom.availability.map((day) => ({
        iso: day.date,
        date: parseISO(day.date),
      }));
    }
  }

  const start = startOfMonth(fallbackMonth);
  const end = endOfMonth(fallbackMonth);
  return eachDayOfInterval({ start, end }).map((date) => ({
    iso: format(date, "yyyy-MM-dd"),
    date,
  }));
}

function collectAvailabilityReservationIds(
  dataByMonth: Record<string, RoomTypeAvailability[]>
) {
  const ids = new Set<string>();

  Object.values(dataByMonth).forEach((availabilityByRoomType) => {
    availabilityByRoomType.forEach((roomTypeAvailability) => {
      roomTypeAvailability.availability.forEach((day) => {
        day.reservationIds.forEach((id) => ids.add(id));
        Object.values(day.roomReservations ?? {}).forEach((entry) => {
          ids.add(entry.reservationId);
        });
      });
    });
  });

  return Array.from(ids).sort();
}

function buildMonthOptions(currentMonth: Date) {
  const todayStart = startOfMonth(new Date());
  const anchor =
    currentMonth < todayStart ? startOfMonth(currentMonth) : todayStart;
  return Array.from({ length: 12 }, (_, index) => {
    const monthDate = addMonths(anchor, index);
    return {
      label: format(monthDate, "MMMM yyyy"),
      value: format(monthDate, "yyyy-MM-dd"),
    };
  });
}
