"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import {
  Baby,
  Building,
  Calendar as CalendarIcon,
  ChevronDown,
  Info,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  differenceInDays,
  format,
  formatISO,
  parse,
  parseISO,
} from "date-fns";

import type {
  Property,
  PropertyClosure,
  RatePlan,
  RoomType,
  SeasonalPrice,
} from "@/data/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PricingBreakdown } from "@/components/ui/pricing-breakdown";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { useRoomTypeAvailabilitySearch } from "@/hooks/use-room-type-availability-search";
import { useRoomTypeInventory } from "@/hooks/use-room-type-inventory";
import { calculateRoomPricing } from "@/lib/pricing-calculator";
import { cn } from "@/lib/utils";

const Calendar = dynamic(
  () => import("@/components/ui/calendar").then((module) => module.Calendar),
  {
    ssr: false,
    loading: () => <div className="h-[360px] rounded-lg bg-muted/30" />,
  },
);

const bookingSchema = z.object({
  dateRange: z
    .object({
      from: z.date({ required_error: "Check-in date is required." }),
      to: z.date({ required_error: "Check-out date is required." }),
    })
    .refine((data) => data.from < data.to, {
      message: "Check-out date must be after check-in date.",
      path: ["to"],
    }),
  guests: z.coerce.number().min(1, "At least one adult is required."),
  children: z.coerce.number().min(0),
  rooms: z.coerce.number().min(1, "At least one room is required."),
  specialRequests: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

type RoomBookingPanelProps = {
  roomType: RoomType;
  standardRatePlan: RatePlan | undefined;
  seasonalPrices: SeasonalPrice[];
  propertyClosures: PropertyClosure[];
  property: Property;
};

export function RoomBookingPanel({
  roomType,
  standardRatePlan,
  seasonalPrices,
  propertyClosures,
  property,
}: RoomBookingPanelProps) {
  const searchParams = useSearchParams();
  const safeSearchParams = React.useMemo(
    () => searchParams ?? new URLSearchParams(),
    [searchParams],
  );
  const router = useRouter();
  const formatCurrency = useCurrencyFormatter();
  const [isDatesPopoverOpen, setIsDatesPopoverOpen] = React.useState(false);
  const [isGuestsPopoverOpen, setIsGuestsPopoverOpen] = React.useState(false);
  const [isRoomsPopoverOpen, setIsRoomsPopoverOpen] = React.useState(false);
  const {
    totalBookableRooms,
    isLoading: isLoadingInventory,
    error: inventoryError,
  } = useRoomTypeInventory(roomType.id);

  const taxConfig = React.useMemo(
    () => ({
      enabled: Boolean(property.tax_enabled),
      percentage: property.tax_percentage ?? 0,
    }),
    [property.tax_enabled, property.tax_percentage],
  );

  const capacitySchema = React.useMemo(() => {
    return bookingSchema.superRefine((data, ctx) => {
      const perRoomCapacity = roomType.maxOccupancy;
      const perRoomChildCapacity =
        typeof roomType.maxChildren === "number"
          ? roomType.maxChildren
          : roomType.maxOccupancy;
      const totalCapacity = data.rooms * perRoomCapacity;
      const totalChildCapacity = data.rooms * perRoomChildCapacity;

      if (data.guests + data.children > totalCapacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Select up to ${totalCapacity} total guest${
            totalCapacity === 1 ? "" : "s"
          } across ${data.rooms} room${data.rooms === 1 ? "" : "s"}.`,
          path: ["guests"],
        });
      }

      if (data.children > totalChildCapacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `You can include up to ${totalChildCapacity} child${
            totalChildCapacity === 1 ? "" : "ren"
          } across ${data.rooms} room${data.rooms === 1 ? "" : "s"}.`,
          path: ["children"],
        });
      }
    });
  }, [roomType]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(capacitySchema),
    defaultValues: {
      guests: safeSearchParams.get("guests")
        ? Number(safeSearchParams.get("guests"))
        : 2,
      children: safeSearchParams.get("children")
        ? Number(safeSearchParams.get("children"))
        : 0,
      rooms: safeSearchParams.get("rooms")
        ? Number(safeSearchParams.get("rooms"))
        : 1,
      dateRange:
        safeSearchParams.get("from") && safeSearchParams.get("to")
          ? {
              from: parse(safeSearchParams.get("from")!, "yyyy-MM-dd", new Date()),
              to: parse(safeSearchParams.get("to")!, "yyyy-MM-dd", new Date()),
            }
          : undefined,
      specialRequests: "",
    },
  });

  const dateRange = form.watch("dateRange");
  const guestsCount = form.watch("guests");
  const childrenCount = form.watch("children");
  const roomsCount = form.watch("rooms");
  const {
    availableRoomsForStay,
    isCheckingAvailability,
    isDatesBlocked: isSelectedRangeBlocked,
  } = useRoomTypeAvailabilitySearch({
    roomTypeId: roomType.id,
    dateRange,
    adults: guestsCount,
    children: childrenCount,
    enabled: true,
  });

  const totalCapacity = roomsCount * roomType.maxOccupancy;
  const perRoomChildLimit = roomType.maxChildren ?? roomType.maxOccupancy;
  const totalChildCapacity = roomsCount * perRoomChildLimit;
  const maxConfiguredChildCapacity =
    roomType.maxChildren !== undefined ? roomsCount * roomType.maxChildren : undefined;
  const maxChildrenAllowed = Math.max(
    0,
    Math.min(totalChildCapacity, totalCapacity - guestsCount),
  );
  const isAtTotalCapacity =
    totalCapacity > 0 && guestsCount + childrenCount >= totalCapacity;
  const isAtChildCapacity =
    typeof maxConfiguredChildCapacity === "number" &&
    childrenCount >= maxConfiguredChildCapacity;
  const capacityHelperMessage = React.useMemo(() => {
    if (roomsCount === 1) {
      const childSnippet =
        roomType.maxChildren !== undefined
          ? `, including up to ${roomType.maxChildren} child${
              roomType.maxChildren === 1 ? "" : "ren"
            }`
          : "";
      return `This room fits up to ${roomType.maxOccupancy} guest${
        roomType.maxOccupancy === 1 ? "" : "s"
      }${childSnippet}.`;
    }

    const childSnippet =
      roomType.maxChildren !== undefined
        ? `, including up to ${roomsCount * roomType.maxChildren} child${
            roomsCount * roomType.maxChildren === 1 ? "" : "ren"
          } total.`
        : ".";

    return `Your ${roomsCount} room selection fits up to ${totalCapacity} guest${
      totalCapacity === 1 ? "" : "s"
    } (${roomType.maxOccupancy} per room)${childSnippet}`;
  }, [roomType, roomsCount, totalCapacity]);
  const roomsParam = safeSearchParams.get("rooms");
  const parsedRequestedRooms = roomsParam ? Number(roomsParam) : undefined;
  const requestedRoomsLimit =
    parsedRequestedRooms && Number.isFinite(parsedRequestedRooms) && parsedRequestedRooms > 0
      ? Math.floor(parsedRequestedRooms)
      : undefined;

  const disabledDates = React.useMemo(() => {
    const closureMatchers = propertyClosures
      .filter((closure) => !closure.roomTypeId || closure.roomTypeId === roomType.id)
      .map((closure) => ({
        from: parseISO(closure.startDate),
        to: parseISO(closure.endDate),
      }));

    return [{ before: new Date() }, ...closureMatchers];
  }, [propertyClosures, roomType.id]);

  const minAvailableRoomsForStay = availableRoomsForStay;
  const hasInventoryCount = typeof totalBookableRooms === "number";
  const cappedByInventory = hasInventoryCount
    ? Math.min(requestedRoomsLimit ?? totalBookableRooms, totalBookableRooms)
    : requestedRoomsLimit ?? 1;

  const computedMaxRooms =
    minAvailableRoomsForStay !== undefined
      ? Math.min(cappedByInventory, minAvailableRoomsForStay)
      : cappedByInventory;

  const maxSelectableRooms = Math.max(0, computedMaxRooms);
  const roomsUnavailableForDates = Boolean(
    dateRange?.from &&
      dateRange?.to &&
      !isCheckingAvailability &&
      (maxSelectableRooms === 0 || isSelectedRangeBlocked) &&
      hasInventoryCount &&
      totalBookableRooms > 0,
  );
  const isRoomsCappedByRequest = Boolean(
    requestedRoomsLimit &&
      maxSelectableRooms > 0 &&
      maxSelectableRooms < requestedRoomsLimit,
  );

  React.useEffect(() => {
    if (maxSelectableRooms > 0 && roomsCount > maxSelectableRooms) {
      form.setValue("rooms", maxSelectableRooms);
    }
  }, [form, roomsCount, maxSelectableRooms]);

  React.useEffect(() => {
    const maxAdults = Math.max(1, totalCapacity - childrenCount);
    if (guestsCount > maxAdults) {
      form.setValue("guests", maxAdults, { shouldValidate: true });
    }

    if (childrenCount > maxChildrenAllowed) {
      form.setValue("children", maxChildrenAllowed, { shouldValidate: true });
    }
  }, [
    form,
    totalCapacity,
    totalChildCapacity,
    guestsCount,
    childrenCount,
    maxChildrenAllowed,
  ]);

  const nightCount =
    dateRange?.from && dateRange?.to
      ? differenceInDays(dateRange.to, dateRange.from)
      : 0;
  const checkInDate = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : undefined;
  const pricing = React.useMemo(() => {
    return calculateRoomPricing({
      roomType,
      ratePlan: standardRatePlan,
      nights: nightCount,
      rooms: roomsCount,
      taxConfig,
      seasonalPrices,
      checkInDate,
    });
  }, [
    roomType,
    standardRatePlan,
    nightCount,
    roomsCount,
    taxConfig,
    seasonalPrices,
    checkInDate,
  ]);

  function onSubmit(values: BookingFormValues) {
    const totalGuests = values.guests + values.children;
    const query = new URLSearchParams();

    const roomsRequested = Math.max(1, Number(values.rooms) || 1);
    for (let index = 0; index < roomsRequested; index += 1) {
      query.append("roomTypeId", roomType.id);
    }

    query.set("from", formatISO(values.dateRange.from, { representation: "date" }));
    query.set("to", formatISO(values.dateRange.to, { representation: "date" }));
    query.set("guests", totalGuests.toString());
    query.set("children", values.children.toString());
    query.set("rooms", values.rooms.toString());

    if (values.specialRequests) {
      query.set("specialRequests", values.specialRequests);
    }

    router.push(`/book/review?${query.toString()}`);
  }

  return (
    <div
      className="lg:col-span-2 mt-8 lg:mt-0 shadow-lg rounded-xl border border-gray-100"
      id="booking-form"
    >
      <Card className="sticky top-32 bg-white border-0 overflow-hidden p-6">
        <div className="p-6 bg-orange-50 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">from</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {formatCurrency(pricing.nightlyRate, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-gray-600">/night</span>
          </div>
        </div>
        <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <FormField
                  control={form.control}
                  name="dateRange"
                  render={({ field }) => {
                    const handleDateSelect = (range: DateRange | undefined) => {
                      field.onChange(range);
                      if (range?.from && range?.to) {
                        setIsDatesPopoverOpen(false);
                      }
                    };

                    return (
                      <FormItem>
                        <Popover
                          open={isDatesPopoverOpen}
                          onOpenChange={setIsDatesPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal border-0 border-b rounded-none p-4 h-auto hover:bg-transparent",
                                !field.value?.from && "text-muted-foreground",
                              )}
                            >
                              <div className="flex items-center w-full">
                                <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                <div className="flex-1">
                                  <div className="text-xs text-gray-600 mb-1">
                                    Check-in → Check-out
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {field.value?.from && field.value?.to
                                      ? `${format(field.value.from, "MMM dd")} - ${format(
                                          field.value.to,
                                          "MMM dd, yyyy",
                                        )}`
                                      : "Select dates"}
                                  </div>
                                </div>
                              </div>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="center"
                            sideOffset={12}
                            className="w-full max-w-[min(100vw-1.5rem,640px)] md:max-w-none border border-border/40 rounded-2xl bg-white shadow-xl px-4 py-4 md:px-5 md:py-4 max-h-[80vh] overflow-y-auto"
                          >
                            <div className="px-5 py-4 border-b border-border/30">
                              <div className="flex gap-4 md:flex-row md:items-start md:justify-between text-sm">
                                <div className="flex-1">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                                    Check-in
                                  </span>
                                  <span className="mt-1 block text-base font-medium text-foreground">
                                    {field.value?.from
                                      ? format(field.value.from, "EEE, MMM d")
                                      : "Select date"}
                                  </span>
                                </div>
                                <div className="flex-1 text-right">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                                    Check-out
                                  </span>
                                  <span className="mt-1 block text-base font-medium text-foreground">
                                    {field.value?.to
                                      ? format(field.value.to, "EEE, MMM d")
                                      : "Select date"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={field.value?.from}
                              selected={{
                                from: field.value?.from,
                                to: field.value?.to,
                              }}
                              onSelect={handleDateSelect}
                              numberOfMonths={2}
                              disabled={disabledDates}
                              showOutsideDays
                              className="pt-3 pb-4 md:pt-4 md:pb-5 px-1 md:px-5"
                              classNames={{
                                months: "flex flex-col gap-6 sm:flex-row sm:gap-6",
                                month: "space-y-4",
                                caption: "flex items-center justify-between",
                                caption_label: "text-base font-semibold text-foreground",
                                nav: "flex items-center gap-2",
                                nav_button:
                                  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                nav_button_previous: "order-1",
                                nav_button_next: "order-2",
                                table: "w-full border-collapse",
                                head_row: "flex w-full",
                                head_cell:
                                  "flex h-11 w-11 items-center justify-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70",
                                row: "mt-1 flex w-full",
                                cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                                day: "inline-flex h-11 w-11 items-center justify-center rounded-full border border-transparent text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary/50 focus-visible:bg-primary/5 aria-selected:hover:bg-primary aria-selected:hover:border-primary",
                                day_selected:
                                  "inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground border border-primary",
                                day_today:
                                  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border/60 text-foreground",
                                day_range_start:
                                  "day-range-start inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground border border-primary",
                                day_range_end:
                                  "day-range-end inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground border border-primary",
                                day_range_middle:
                                  "day-range-middle inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-foreground aria-selected:!text-foreground border border-primary/20",
                                day_outside: "pointer-events-none opacity-0 select-none",
                                day_disabled:
                                  "opacity-40 text-muted-foreground hover:border-transparent hover:bg-transparent",
                                day_hidden: "invisible",
                              }}
                            />
                            <p className="px-5 pb-1 text-xs text-muted-foreground">
                              Availability reflects rooms housekeeping has marked Clean or Dirty; maintenance rooms stay hidden until they&apos;re ready.
                            </p>
                            {(() => {
                              const relevantClosures = propertyClosures.filter(
                                (closure) =>
                                  !closure.roomTypeId || closure.roomTypeId === roomType.id,
                              );
                              if (relevantClosures.length === 0) return null;
                              return (
                                <div className="flex items-start gap-2 mx-5 mb-3 px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <div>
                                    {relevantClosures.length === 1 ? (
                                      <span>
                                        Bookings are closed from{" "}
                                        <strong>
                                          {format(
                                            new Date(
                                              `${relevantClosures[0].startDate}T00:00:00`,
                                            ),
                                            "d MMM yyyy",
                                          )}
                                        </strong>{" "}
                                        to{" "}
                                        <strong>
                                          {format(
                                            new Date(
                                              `${relevantClosures[0].endDate}T00:00:00`,
                                            ),
                                            "d MMM yyyy",
                                          )}
                                        </strong>.
                                      </span>
                                    ) : (
                                      <>
                                        <span className="font-medium">
                                          Bookings are closed during:
                                        </span>
                                        <ul className="mt-1 space-y-0.5 list-disc list-inside">
                                          {relevantClosures.map((closure, index) => (
                                            <li key={index}>
                                              {format(
                                                new Date(`${closure.startDate}T00:00:00`),
                                                "d MMM yyyy",
                                              )}
                                              {" – "}
                                              {format(
                                                new Date(`${closure.endDate}T00:00:00`),
                                                "d MMM yyyy",
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="pl-2" />
                      </FormItem>
                    );
                  }}
                />
                <div className="grid grid-cols-2 gap-0 divide-x">
                  <FormField
                    control={form.control}
                    name="guests"
                    render={() => (
                      <FormItem>
                        <Popover
                          open={isGuestsPopoverOpen}
                          onOpenChange={setIsGuestsPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-primary" />
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">
                                    Guests
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {guestsCount + childrenCount} guest
                                    {guestsCount + childrenCount > 1 ? "s" : ""}
                                  </div>
                                </div>
                              </div>
                              <ChevronDown
                                className={cn(
                                  "size-4 text-gray-400 transition-transform",
                                  isGuestsPopoverOpen && "rotate-180",
                                )}
                              />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            sideOffset={12}
                            align="center"
                            className="w-[min(90vw,420px)] sm:w-[380px] rounded-3xl border border-border/30 bg-white shadow-xl p-6 space-y-6"
                          >
                            <div className="space-y-1">
                              <h4 className="text-lg font-semibold text-foreground">
                                Select guests
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Choose number of adults and children
                              </p>
                            </div>
                            <div className="divide-y divide-border/20">
                              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                  <div className="flex lg:h-10 lg:w-10 w-8 h-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Users className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <span className="block text-base font-medium text-foreground">
                                      Adults
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      Ages 13 or above
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center lg:gap-3">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                    onClick={() =>
                                      form.setValue(
                                        "guests",
                                        Math.max(1, guestsCount - 1),
                                      )
                                    }
                                    type="button"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-9 text-center text-base font-semibold text-foreground">
                                    {guestsCount}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                    onClick={() =>
                                      form.setValue(
                                        "guests",
                                        Math.max(
                                          1,
                                          Math.min(
                                            totalCapacity - childrenCount,
                                            guestsCount + 1,
                                          ),
                                        ),
                                        { shouldValidate: true },
                                      )
                                    }
                                    type="button"
                                    disabled={
                                      totalCapacity === 0 ||
                                      guestsCount + childrenCount >= totalCapacity
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <FormField
                                control={form.control}
                                name="children"
                                render={({ field: childField }) => (
                                  <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                      <div className="flex lg:h-10 lg:w-10 w-8 h-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Baby className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <span className="block text-base font-medium text-foreground">
                                          Children
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                          Ages 0 to 12
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center lg:gap-3">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                        onClick={() =>
                                          childField.onChange(
                                            Math.max(0, childField.value - 1),
                                          )
                                        }
                                        type="button"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="w-9 text-center text-base font-semibold text-foreground">
                                        {childField.value}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                        onClick={() =>
                                          childField.onChange(
                                            Math.min(
                                              childField.value + 1,
                                              Math.max(0, maxChildrenAllowed),
                                            ),
                                          )
                                        }
                                        type="button"
                                        disabled={
                                          totalCapacity === 0 ||
                                          childField.value >=
                                            Math.max(0, maxChildrenAllowed)
                                        }
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              />
                            </div>
                            <div className="pt-2 border-t border-border/20 space-y-1">
                              <p className="text-xs text-muted-foreground">
                                {capacityHelperMessage}
                              </p>
                              {isAtTotalCapacity && (
                                <p className="text-xs text-amber-700">
                                  Need space for more guests? Increase your room count first.
                                </p>
                              )}
                              {!isAtTotalCapacity &&
                                isAtChildCapacity &&
                                roomType.maxChildren !== undefined && (
                                  <p className="text-xs text-amber-700">
                                    You&apos;ve reached the child limit for these rooms.
                                  </p>
                                )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="px-3 pb-2" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rooms"
                    render={({ field }) => (
                      <FormItem>
                        <Popover
                          open={isRoomsPopoverOpen}
                          onOpenChange={setIsRoomsPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Building className="h-5 w-5 text-primary" />
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">
                                    Rooms
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {roomsCount} room{roomsCount > 1 ? "s" : ""}
                                  </div>
                                </div>
                              </div>
                              <ChevronDown
                                className={cn(
                                  "size-4 text-gray-400 transition-transform",
                                  isRoomsPopoverOpen && "rotate-180",
                                )}
                              />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            sideOffset={12}
                            align="center"
                            className="w-[min(90vw,420px)] sm:w-[380px] rounded-3xl border border-border/30 bg-white shadow-xl p-6 space-y-6"
                          >
                            <div className="space-y-1">
                              <h4 className="text-lg font-semibold text-foreground">
                                Select rooms
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Choose number of rooms
                              </p>
                            </div>
                            <div className="divide-y divide-border/20">
                              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                  <div className="flex lg:h-10 lg:w-10 w-8 h-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Building className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <span className="block text-base font-medium text-foreground">
                                      Rooms
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      Number of rooms
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center lg:gap-3">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                    onClick={() =>
                                      field.onChange(Math.max(1, field.value - 1))
                                    }
                                    type="button"
                                    disabled={field.value <= 1}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-9 text-center text-base font-semibold text-foreground">
                                    {field.value}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                    onClick={() =>
                                      field.onChange(
                                        Math.min(
                                          maxSelectableRooms || 1,
                                          field.value + 1,
                                        ),
                                      )
                                    }
                                    type="button"
                                    disabled={
                                      maxSelectableRooms === 0 ||
                                      field.value >= maxSelectableRooms
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="pt-3 text-xs text-muted-foreground">
                              {isLoadingInventory ? (
                                <p>Loading room inventory...</p>
                              ) : inventoryError ? (
                                <p>Room inventory is temporarily unavailable.</p>
                              ) : isCheckingAvailability && dateRange?.from && dateRange?.to ? (
                                <p>Checking latest availability...</p>
                              ) : maxSelectableRooms > 0 ? (
                                <p>
                                  {`You can select up to ${maxSelectableRooms} room${
                                    maxSelectableRooms === 1 ? "" : "s"
                                  } for these dates.`}
                                  {isRoomsCappedByRequest && requestedRoomsLimit && (
                                    <>
                                      {" "}
                                      You originally chose {requestedRoomsLimit}; adjust your search if you need more.
                                    </>
                                  )}
                                </p>
                              ) : (
                                <p>No rooms of this type are ready for the selected dates.</p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="px-3 pb-2" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="specialRequests"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900">
                        Special Requests{" "}
                        <span className="text-gray-500 font-normal">
                          (Optional)
                        </span>
                      </label>
                      <textarea
                        {...field}
                        placeholder="Any special requests or requirements?"
                        className="w-full min-h-[80px] p-3 border border-gray-200 shadow-md hover:border-gray-300 rounded-xl resize-none text-sm focus:outline-none"
                      />
                    </div>
                  </FormItem>
                )}
              />

              {nightCount > 0 && (
                <PricingBreakdown
                  nightlyRate={pricing.nightlyRate}
                  nights={nightCount}
                  rooms={roomsCount}
                  totalCost={pricing.totalCost}
                  taxesAndFees={pricing.taxesAndFees}
                  grandTotal={pricing.grandTotal}
                  taxesApplied={pricing.taxesApplied}
                  taxRatePercent={pricing.taxRatePercent}
                  currency={property.currency}
                />
              )}
              {roomsUnavailableForDates && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <Info className="h-4 w-4" />
                  <p>
                    This room type is fully booked for at least one night in your selected range. Please adjust your dates or pick another room type.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl"
                disabled={
                  !dateRange?.from ||
                  !dateRange?.to ||
                  isLoadingInventory ||
                  !hasInventoryCount ||
                  isCheckingAvailability ||
                  maxSelectableRooms === 0
                }
              >
                {isLoadingInventory || isCheckingAvailability
                  ? "Checking availability..."
                  : "Book now"}
              </Button>

              <p className="text-xs text-center text-gray-500">
                You won&apos;t be charged yet. Review before payment.
              </p>
            </form>
          </Form>
        </div>
      </Card>
    </div>
  );
}
