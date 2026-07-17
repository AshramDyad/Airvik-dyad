"use client";

import * as React from "react";
import { CalendarIcon, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DateRange, Matcher } from "react-day-picker";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type ClosureDateRange = { startDate: string; endDate: string; roomTypeId?: string };

type ReservationDateRangePickerProps = {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  disabled?: boolean;
  allowPastDates?: boolean;
  blockedRanges?: ClosureDateRange[];
};

export function ReservationDateRangePicker({
  value,
  onChange,
  className,
  disabled = false,
  allowPastDates = false,
  blockedRanges = [],
}: ReservationDateRangePickerProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => value?.from ?? new Date());

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (value?.from) {
      setDisplayMonth(value.from);
      return;
    }
    setDisplayMonth(new Date());
  }, [value?.from]);

  const handleSelect = (range: DateRange | undefined) => {
    onChange(range);
    if (range?.from) {
      setDisplayMonth(range.from);
    }
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const handleClear = () => {
    const emptyRange: DateRange = { from: undefined, to: undefined };
    onChange(emptyRange);
    setDisplayMonth(new Date());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-14 justify-start text-left font-normal text-base border hover:border-primary/50 transition-all duration-300 bg-background/50",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
              {value?.from ? (
                value.to ? (
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">Check-in → Check-out</span>
                    <span className="text-sm font-medium">
                      {format(value.from, "MMM dd")} - {format(value.to, "MMM dd, yyyy")}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">Check-in date</span>
                    <span className="text-sm font-medium">{format(value.from, "MMM dd, yyyy")}</span>
                  </div>
                )
              ) : (
                <span className="text-muted-foreground">Select dates</span>
              )}
            </div>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={4}
        collisionPadding={12}
        sticky="always"
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[calc(100vw-1rem)] max-w-[600px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-white p-0 shadow-xl sm:w-auto sm:max-w-[calc(100vw-1.5rem)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border/30 px-4 py-1 text-sm sm:px-5">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
            <div className="min-w-0">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/80">Check-in</span>
              <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
                {value?.from ? format(value.from, "EEE, MMM d") : "Select date"}
              </span>
            </div>
            <div className="min-w-0 text-left sm:text-right">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/80">Check-out</span>
              <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
                {value?.to ? format(value.to, "EEE, MMM d") : "Select date"}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2.5 text-xs text-primary hover:bg-primary/5 hover:text-primary"
            onClick={handleClear}
            disabled={!value?.from && !value?.to}
          >
            Clear
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <Calendar
            initialFocus
            mode="range"
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            selected={value}
            onSelect={handleSelect}
            numberOfMonths={isMobile ? 1 : 2}
            disabled={[
              ...(allowPastDates
                ? []
                : [{ before: new Date(new Date().setHours(0, 0, 0, 0)) }] as Matcher[]),
              ...blockedRanges
                .filter((r) => !r.roomTypeId)
                .map((r) => ({
                  from: parseISO(r.startDate),
                  to: parseISO(r.endDate),
                })) as Matcher[],
            ]}
            showOutsideDays
            className="p-1.5 sm:px-3"
            classNames={{
              months: "flex flex-col gap-4 sm:flex-row sm:gap-6 mt-1",
              month: "space-y-1",
              caption: "flex h-7 items-center justify-between",
              caption_label: "text-sm font-semibold text-foreground",
              nav: "flex items-center gap-1",
              nav_button:
                "inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground transition-colors hover:border-primary focus-visible:outline-none",
              nav_button_previous: "order-1",
              nav_button_next: "order-2",
              table: "w-full border-collapse",
              head_row: "flex w-full gap-1",
              head_cell:
                "flex h-8 w-8 mt-1 items-center justify-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70",
              row: "flex w-full gap-1 mb-1",
              cell: "relative p-0 text-center text-xs focus-within:relative focus-within:z-20",
              day: "inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[0.8125rem] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary/50 focus-visible:bg-primary/5 aria-selected:hover:bg-primary aria-selected:hover:border-primary",
              day_selected:
                "inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground",
              day_today:
                "inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border/60 text-foreground",
              day_range_start:
                "day-range-start inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground",
              day_range_end:
                "day-range-end inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground",
              day_range_middle:
                "day-range-middle inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-foreground aria-selected:!text-foreground",
              day_outside: "pointer-events-none select-none opacity-0",
              day_disabled: "text-muted-foreground opacity-40 hover:border-transparent hover:bg-transparent",
              day_hidden: "invisible",
            }}
          />
          {(() => {
          const closures = blockedRanges.filter((r) => !r.roomTypeId);
          if (closures.length === 0) return null;
          return (
            <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                {closures.length === 1 ? (
                  <span>
                    Bookings are closed from{" "}
                    <strong>
                      {format(new Date(closures[0].startDate + "T00:00:00"), "d MMM yyyy")}
                    </strong>{" "}
                    to{" "}
                    <strong>
                      {format(new Date(closures[0].endDate + "T00:00:00"), "d MMM yyyy")}
                    </strong>.
                  </span>
                ) : (
                  <>
                    <span className="font-medium">Bookings are closed during:</span>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {closures.map((r, i) => (
                        <li key={i}>
                          {format(new Date(r.startDate + "T00:00:00"), "d MMM yyyy")}
                          {" – "}
                          {format(new Date(r.endDate + "T00:00:00"), "d MMM yyyy")}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          );
          })()}
        </div>
      </PopoverContent>
    </Popover>
  );
}
