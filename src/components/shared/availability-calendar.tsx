"use client";

import * as React from "react";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWithinInterval,
  parseISO,
  isSameDay,
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
  ReservationStatus,
  UnitsViewMode,
  AvailabilityCellStatus,
  RoomTypeAvailability,
} from "@/data/types";
import { useDataContext } from "@/context/data-context";
import {
  formatMonthStart,
  useMultiMonthAvailability,
} from "@/hooks/use-monthly-availability";
import { RoomTypeRow } from "@/components/shared/room-type-row";
import { cn } from "@/lib/utils";
import { useFullscreen } from "@/hooks/use-fullscreen";
import {
  doesReservationBlockAvailability,
  getReservationStatusLabel,
} from "@/lib/reservations/status";

const reservationStatusStyles: Record<
  ReservationStatus,
  { ribbon: string; dot: string }
> = {
  "Room Hold": {
    ribbon: "border border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
  Standby: {
    ribbon: "border border-sky-200 bg-sky-50 text-sky-900",
    dot: "bg-sky-500",
  },
  Confirmed: {
    ribbon: "border border-emerald-200 bg-emerald-50 text-emerald-900",
    dot: "bg-emerald-600",
  },
  "Checked-in": {
    ribbon: "border border-indigo-200 bg-indigo-50 text-indigo-900",
    dot: "bg-indigo-600",
  },
  "Checked-out": {
    ribbon: "border border-slate-200 bg-slate-50 text-slate-900",
    dot: "bg-slate-500",
  },
  Cancelled: {
    ribbon: "border border-rose-200 bg-rose-500 text-white",
    dot: "bg-rose-500",
  },
  "No-show": {
    ribbon: "border border-rose-200 bg-rose-500 text-white",
    dot: "bg-rose-600",
  },
};

const defaultStatusStyle = {
  ribbon: "border border-slate-200 bg-slate-50 text-slate-900",
  dot: "bg-slate-500",
};

const getStatusStyle = (status: ReservationStatus) =>
  reservationStatusStyles[status] ?? defaultStatusStyle;

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
  const [activeReservationCardId, setActiveReservationCardId] = React.useState<
    string | null
  >(null);
  const [unitsView, setUnitsView] = React.useState<UnitsViewMode>(
    property.defaultUnitsView
  );
  const [useLegacyView, setUseLegacyView] = React.useState(false);
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
    setActiveReservationCardId(null);
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

  const handleUseLegacyView = () => {
    setUseLegacyView(true);
  };

  if (useLegacyView) {
    return <LegacyAvailabilityCalendar />;
  }

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
                className="h-9 w-9 rounded-xl flex-shrink-0"
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={format(currentMonth, "yyyy-MM-dd")}
                onValueChange={handleMonthSelect}
              >
                <SelectTrigger className="min-w-[160px] rounded-xl border bg-transparent focus:outline-none text-sm font-semibold">
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
                className="h-9 w-9 rounded-xl flex-shrink-0"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                aria-label="Next month"
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
              <SelectTrigger className="h-14 min-w-[150px] rounded-xl border border-border/60 bg-card/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              Change the month to retry, or switch to the legacy room-by-room
              view for immediate access.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleUseLegacyView}>
                Use legacy view
              </Button>
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
              {monthSequence.map((monthDate) => {
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
                        initialScrollDate={
                          headerDays.some((day) => day.iso === todayIso)
                            ? todayIso
                            : undefined
                        }
                      >
                        <Table className="min-w-max border-separate border-spacing-0" baseWrapper={false}>
                          <TableHeader className="sticky top-0 z-30 bg-card/95 backdrop-blur shadow-sm">
                            <TableRow>
                              <TableHead
                                className="sticky left-0 z-40 w-56 border-r border-b border-border/40 bg-card/95 backdrop-blur px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                                data-calendar-sticky-column
                              >
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
                                    data-calendar-date={day.iso}
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
                                activeReservationCardId={activeReservationCardId}
                                onActiveReservationCardChange={
                                  setActiveReservationCardId
                                }
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
  initialScrollDate?: string;
};

function DragScrollContainer({
  children,
  ariaLabel,
  className,
  initialScrollDate,
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

  React.useLayoutEffect(() => {
    if (!initialScrollDate) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const stickyColumn = container.querySelector<HTMLElement>(
      "[data-calendar-sticky-column]"
    );
    const initialDateHeader = container.querySelector<HTMLElement>(
      `[data-calendar-date="${initialScrollDate}"]`
    );
    if (!stickyColumn || !initialDateHeader) {
      return;
    }

    container.scrollLeft = Math.max(
      initialDateHeader.offsetLeft - stickyColumn.offsetWidth,
      0
    );
  }, [initialScrollDate]);

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

function LegacyAvailabilityCalendar() {
  const { reservations, guests, rooms } = useDataContext();
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const daysInMonth = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));

  const getReservationForDate = (roomId: string, date: Date) => {
    return reservations.find((res) => {
      if (res.roomId !== roomId || !doesReservationBlockAvailability(res)) {
        return false;
      }
      const checkIn = parseISO(res.checkInDate);
      const checkOut = parseISO(res.checkOutDate);
      return (
        isWithinInterval(date, { start: checkIn, end: checkOut }) &&
        !isSameDay(date, checkOut)
      );
    });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
      {/* Header */}
      <div className="border-b border-border/50 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
              Availability Overview
            </h2>
            <p className="text-sm text-muted-foreground">
              Monthly view of room bookings. Hover over a booking for details.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border/40 bg-background/50 px-2 sm:px-3 py-2 shadow-sm w-fit">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary shrink-0 transition-colors"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] sm:min-w-[140px] text-center text-sm sm:text-base font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary shrink-0 transition-colors"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <TooltipProvider delayDuration={0}>
          {/* Scrollable Calendar Container */}
          <div className="overflow-x-auto rounded-xl border border-border/40 bg-background/50 shadow-sm focus:outline-none ">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 w-16 sm:w-24 border-r border-border/30 bg-muted/60 backdrop-blur">
                      <span className="text-xs sm:text-sm font-semibold">
                        Room
                      </span>
                    </TableHead>
                    {daysInMonth.map((day) => (
                      <TableHead
                        key={day.toString()}
                        className={cn(
                          "w-10 sm:w-12 p-1 sm:p-2 text-center",
                          isSameDay(day, new Date()) && "bg-primary/10"
                        )}
                      >
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground">
                          {format(day, "E")}
                        </div>
                        <div className="text-sm sm:text-base font-semibold">
                          {format(day, "d")}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room) => {
                    const dayCells = [];
                    for (let i = 0; i < daysInMonth.length; i++) {
                      const day = daysInMonth[i];
                      const reservation = getReservationForDate(room.id, day);

                      if (!reservation) {
                        dayCells.push(
                          <TableCell
                            key={day.toString()}
                            className={cn(
                              "border-l border-border/20 p-0 h-10 sm:h-12",
                              isSameDay(day, new Date()) && "bg-primary/5"
                            )}
                          />
                        );
                        continue;
                      }

                      const checkIn = parseISO(reservation.checkInDate);
                      const isStartOfBookingInView =
                        isSameDay(day, checkIn) || i === 0;

                      if (isStartOfBookingInView) {
                        let span = 0;
                        for (let j = i; j < daysInMonth.length; j++) {
                          if (
                            getReservationForDate(room.id, daysInMonth[j])
                              ?.id === reservation.id
                          ) {
                            span++;
                          } else {
                            break;
                          }
                        }

                        if (span > 0) {
                          const guest = guests.find(
                            (g) => g.id === reservation.guestId
                          );
                          const statusStyle = getStatusStyle(
                            reservation.status
                          );
                          dayCells.push(
                            <TableCell
                              key={day.toString()}
                              colSpan={span}
                              className={cn(
                                "border-l border-border/20 p-0 h-10 sm:h-12",
                                isSameDay(day, new Date()) && "bg-primary/5"
                              )}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "m-0.5 sm:m-1 flex h-9 sm:h-10 items-center overflow-hidden rounded-lg px-2 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs font-medium shadow-sm cursor-pointer transition-all hover:shadow-md",
                                      statusStyle.ribbon
                                    )}
                                  >
                                    <span className="truncate">
                                      {guest?.firstName} {guest?.lastName}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-bold">
                                    {guest?.firstName} {guest?.lastName}
                                  </p>
                                  <p className="text-sm">
                                    Status: {getReservationStatusLabel(reservation.status)}
                                  </p>
                                  <p className="text-sm">
                                    Check-in: {format(checkIn, "MMM d, yyyy")}
                                  </p>
                                  <p className="text-sm">
                                    Check-out:{" "}
                                    {format(
                                      parseISO(reservation.checkOutDate),
                                      "MMM d, yyyy"
                                    )}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          );
                          i += span - 1;
                        }
                      }
                    }
                    return (
                      <TableRow key={room.id}>
                        <TableCell className="sticky left-0 z-10 border-r border-border/30 bg-muted/60 backdrop-blur font-semibold text-xs sm:text-sm">
                          {room.roomNumber}
                        </TableCell>
                        {dayCells}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Legend
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shrink-0",
                  getStatusStyle("Confirmed").dot
                )}
              />
              <span className="text-xs sm:text-sm text-muted-foreground">
                Confirmed
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shrink-0",
                  getStatusStyle("Checked-in").dot
                )}
              />
              <span className="text-xs sm:text-sm text-muted-foreground">
                Checked-in
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shrink-0",
                  getStatusStyle("Room Hold").dot
                )}
              />
              <span className="text-xs sm:text-sm text-muted-foreground">
                Room Hold
              </span>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
