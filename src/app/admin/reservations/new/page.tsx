"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatISO, differenceInDays, areIntervalsOverlapping, parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { Check, ChevronsUpDown } from "lucide-react";

import { useDataContext } from "@/context/data-context";
import type { ReservationPaymentMethod, ReservationStatus, RoomType } from "@/data/types";
import { ReservationDateRangePicker } from "@/components/reservations/date-range-picker";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  calculateMultipleRoomPricing,
  resolveRoomNightlyRate,
  getSeasonalPrice,
  type RoomPricingOverrides,
} from "@/lib/pricing-calculator";
import { isBookableRoom, ROOM_STATUS_LABELS } from "@/lib/rooms";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { buildRoomOccupancyAssignments } from "@/lib/reservations/guest-allocation";
import { PermissionGate } from "@/components/admin/permission-gate";

const paymentMethodOptions = [
  "Not specified",
  "Bank/IMPS",
  "Cash",
  "UPI",
  "Bhagat Ji",
  "Anurag Ji",
] as const satisfies ReservationPaymentMethod[];

const creatableStatuses = ["Confirmed", "Tentative", "Standby"] as const satisfies ReservationStatus[];

const dateRangeSchema = z.object({
  from: z.date({ required_error: "Check-in is required." }),
  to: z.date({ required_error: "Check-out is required." }),
}).refine((range) => range.from && range.to && range.to > range.from, {
  message: "Check-out must be after check-in.",
  path: ["to"],
});

const customRateRecordSchema = z
  .record(z.string(), z.coerce.number().min(1, "Custom price must be positive."))
  .default({})
  .transform((value) => value ?? {});

const reservationFormSchema = z.object({
  guestId: z.string({ required_error: "Please select a guest." }),
  dateRange: dateRangeSchema,
  adults: z.coerce.number().min(1, "At least one adult is required."),
  children: z.coerce.number().min(0, "Children cannot be negative."),
  status: z.enum(creatableStatuses),
  paymentMethod: z.enum(paymentMethodOptions),
  roomTypeId: z.string().optional(),
  roomIds: z.array(z.string()).min(1, "Select at least one room."),
  notes: z.string().max(500).optional(),
  customRates: customRateRecordSchema,
});

type ReservationFormValues = z.input<typeof reservationFormSchema>;

type CustomRateFieldErrors = Partial<Record<string, { message?: string }>>;

export default function CreateReservationPage() {
  const {
    guests,
    rooms,
    roomTypes,
    reservations,
    ratePlans,
    seasonalPrices,
    addReservation,
    isLoading,
    property,
  } = useDataContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const guestPrefillId = searchParams?.get("guestId") ?? null;
  const guestCreationUrl = `/admin/guests?intent=create-for-reservation&redirect=${encodeURIComponent(
    "/admin/reservations/new"
  )}`;

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: {
      guestId: guestPrefillId ?? "",
      adults: 1,
      children: 0,
      status: "Confirmed",
      paymentMethod: "Not specified",
      roomTypeId: undefined,
      roomIds: [],
      notes: "",
      customRates: {},
    },
  });

  React.useEffect(() => {
    if (guestPrefillId) {
      form.setValue("guestId", guestPrefillId);
    }
  }, [guestPrefillId, form]);

  const watchedDateRange = form.watch("dateRange") as DateRange | undefined;
  const selectedRoomTypeId = form.watch("roomTypeId") || "";
  const watchedRoomIds = form.watch("roomIds");
  const selectedRoomIds = React.useMemo(() => watchedRoomIds ?? [], [watchedRoomIds]);
  const customRates = form.watch("customRates");
  const customRatesValue = React.useMemo(() => customRates ?? {}, [customRates]);
  const adultsInput = form.watch("adults");
  const childrenInput = form.watch("children");
  const adults = Number(adultsInput ?? 0) || 0;
  const children = Number(childrenInput ?? 0) || 0;
  const totalGuests = adults + children;

  const nights = React.useMemo(() => {
    if (!watchedDateRange?.from || !watchedDateRange?.to) return 0;
    return Math.max(differenceInDays(watchedDateRange.to, watchedDateRange.from), 1);
  }, [watchedDateRange]);

  const allAvailableRooms = React.useMemo(() => {
    if (!watchedDateRange?.from || !watchedDateRange?.to) {
      return [];
    }

    return rooms.filter((room) => {
      const isBooked = reservations.some((res) => {
        if (res.roomId !== room.id) return false;
        if (res.status === "Cancelled") return false;
        return areIntervalsOverlapping(
          { start: watchedDateRange.from!, end: watchedDateRange.to! },
          { start: parseISO(res.checkInDate), end: parseISO(res.checkOutDate) },
          { inclusive: false }
        );
      });

      if (isBooked) {
        return false;
      }

      return isBookableRoom(room);
    });
  }, [rooms, reservations, watchedDateRange]);

  const filteredAvailableRooms = React.useMemo(() => {
    if (!selectedRoomTypeId) return allAvailableRooms;
    return allAvailableRooms.filter((room) => room.roomTypeId === selectedRoomTypeId);
  }, [allAvailableRooms, selectedRoomTypeId]);

  React.useEffect(() => {
    if (!watchedDateRange?.from || !watchedDateRange?.to) return;
    const availableIds = new Set(allAvailableRooms.map((room) => room.id));
    const current = form.getValues("roomIds");
    const filtered = current.filter((id) => availableIds.has(id));
    if (filtered.length !== current.length) {
      form.setValue("roomIds", filtered, { shouldValidate: true });
    }
  }, [allAvailableRooms, form, watchedDateRange]);

  const roomMap = React.useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const roomTypeMap = React.useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes]);

  const getRoomCapacity = React.useCallback((roomId: string) => {
    const room = roomMap.get(roomId);
    if (!room) return 0;
    const roomType = roomTypeMap.get(room.roomTypeId);
    return roomType?.maxOccupancy ?? 2;
  }, [roomMap, roomTypeMap]);

  const handleRoomToggle = (roomId: string) => {
    const current = form.getValues("roomIds") ?? [];
    if (current.includes(roomId)) {
      form.setValue(
        "roomIds",
        current.filter((id) => id !== roomId),
        { shouldValidate: true }
      );
      return;
    }

    if (!watchedDateRange?.from || !watchedDateRange?.to) {
      toast.error("Select dates before choosing rooms.");
      return;
    }

    if (totalGuests <= 0) {
      toast.error("Add at least one guest before selecting rooms.");
      return;
    }

    if (selectedRoomsCapacity >= totalGuests) {
      toast.error("Capacity already matches guest count.");
      return;
    }

    form.setValue("roomIds", [...current, roomId], { shouldValidate: true });
  };

  const selectedGuestId = form.watch("guestId");
  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId);
  const [guestPopoverOpen, setGuestPopoverOpen] = React.useState(false);

  const formatGuestName = React.useCallback((guest: { firstName?: string | null; lastName?: string | null }) => {
    const parts = [guest.firstName, guest.lastName]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());
    return parts.join(" ");
  }, []);

  const selectedGuestLabel = React.useMemo(() => {
    if (!selectedGuest) return "";
    return formatGuestName(selectedGuest);
  }, [formatGuestName, selectedGuest]);

  const buildGuestKeywords = React.useCallback(
    (guest: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }) => {
      const fullName = formatGuestName(guest);
      const values = [fullName, guest.email, guest.phone];
      return values
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim());
    },
    [formatGuestName]
  );
  const defaultRatePlan = ratePlans.find((rp) => rp.name === "Standard Rate") || ratePlans[0];

  const selectedRoomTypes = React.useMemo(() => {
    return selectedRoomIds
      .map((roomId) => {
        const room = roomMap.get(roomId);
        if (!room) return null;
        return roomTypeMap.get(room.roomTypeId) ?? null;
      })
      .filter((type): type is RoomType => Boolean(type));
  }, [roomMap, roomTypeMap, selectedRoomIds]);

  const uniqueSelectedRoomTypes = React.useMemo(() => {
    const entries = new Map<string, RoomType>();
    selectedRoomIds.forEach((roomId) => {
      const room = roomMap.get(roomId);
      if (!room) return;
      const roomType = roomTypeMap.get(room.roomTypeId);
      if (!roomType) return;
      entries.set(roomType.id, roomType);
    });
    return Array.from(entries.values());
  }, [roomMap, roomTypeMap, selectedRoomIds]);

  React.useEffect(() => {
    const allowedIds = new Set(uniqueSelectedRoomTypes.map((type) => type.id));
    const currentRates = form.getValues("customRates") ?? {};
    const nextEntries = Object.entries(currentRates).filter(
      ([roomTypeId, value]) => allowedIds.has(roomTypeId) && typeof value === "number" && value > 0
    );
    if (nextEntries.length !== Object.keys(currentRates).length) {
      form.setValue("customRates", Object.fromEntries(nextEntries), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, uniqueSelectedRoomTypes]);

  const selectedRoomsCapacity = React.useMemo(() => {
    if (!selectedRoomIds.length) return 0;
    return selectedRoomIds.reduce((sum, roomId) => sum + getRoomCapacity(roomId), 0);
  }, [getRoomCapacity, selectedRoomIds]);

  const hasCapacityForGuests = totalGuests > 0 && selectedRoomsCapacity >= totalGuests;

  const taxConfig = React.useMemo(() => {
    const enabled = Boolean(property?.tax_enabled);
    return {
      enabled,
      percentage: enabled ? property?.tax_percentage ?? 0 : 0,
    };
  }, [property?.tax_enabled, property?.tax_percentage]);

  const nightlyOverrides = React.useMemo<RoomPricingOverrides | undefined>(() => {
    const entries = Object.entries(customRatesValue).filter(([, value]) =>
      typeof value === "number" && value > 0
    );
    return entries.length ? Object.fromEntries(entries) : undefined;
  }, [customRatesValue]);

  const adminCheckInDate = watchedDateRange?.from
    ? formatISO(watchedDateRange.from, { representation: "date" })
    : undefined;

  const pricing = React.useMemo(() => {
    if (!selectedRoomTypes.length || nights <= 0) return null;
    return calculateMultipleRoomPricing({
      roomTypes: selectedRoomTypes,
      ratePlan: defaultRatePlan,
      nights: nights || 1,
      taxConfig,
      nightlyOverrides,
      seasonalPrices,
      checkInDate: adminCheckInDate,
    });
  }, [selectedRoomTypes, defaultRatePlan, nights, taxConfig, nightlyOverrides, seasonalPrices, adminCheckInDate]);

  const formatCurrency = useCurrencyFormatter({ maximumFractionDigits: 0 });
  const customRateErrors = form.formState.errors.customRates as CustomRateFieldErrors | undefined;

  const handleCustomRateInput = React.useCallback(
    (roomTypeId: string, rawValue: string) => {
      if (!rawValue.trim()) {
        if (roomTypeId in customRatesValue) {
          const nextRates = { ...customRatesValue };
          delete nextRates[roomTypeId];
          form.setValue("customRates", nextRates, { shouldDirty: true, shouldValidate: true });
        }
        return;
      }
      const numericValue = Number(rawValue);
      if (Number.isNaN(numericValue)) {
        return;
      }
      form.setValue(
        "customRates",
        {
          ...customRatesValue,
          [roomTypeId]: numericValue,
        },
        { shouldDirty: true, shouldValidate: true }
      );
    },
    [customRatesValue, form]
  );

  const handleResetCustomRate = React.useCallback(
    (roomTypeId: string) => {
      if (!(roomTypeId in customRatesValue)) {
        return;
      }
      const nextRates = { ...customRatesValue };
      delete nextRates[roomTypeId];
      form.setValue("customRates", nextRates, { shouldDirty: true, shouldValidate: true });
    },
    [customRatesValue, form]
  );

  const buildCustomRoomTotals = React.useCallback(
    (roomIdsList: string[], stayNights: number): Array<number | null> => {
      if (!stayNights || stayNights <= 0) {
        return roomIdsList.map(() => null);
      }
      return roomIdsList.map((roomId) => {
        const room = roomMap.get(roomId);
        if (!room) return null;
        const roomType = roomTypeMap.get(room.roomTypeId);
        if (!roomType) return null;
        const override = customRatesValue[roomType.id];
        if (typeof override === "number" && override > 0) {
          return override * stayNights;
        }
        // Fall back to seasonal price when no manual override
        if (adminCheckInDate) {
          const seasonal = getSeasonalPrice(roomType.id, adminCheckInDate, seasonalPrices);
          if (seasonal !== null) {
            return seasonal * stayNights;
          }
        }
        return null;
      });
    },
    [customRatesValue, roomMap, roomTypeMap, adminCheckInDate, seasonalPrices]
  );

  const onSubmit = async (values: ReservationFormValues) => {
    if (!defaultRatePlan) {
      toast.error("No rate plan configured yet.");
      return;
    }

    if (!hasCapacityForGuests) {
      toast.error("Selected rooms cannot accommodate all guests.", {
        description: "Add more rooms or reduce guest count to proceed.",
      });
      return;
    }

    try {
      const roomOccupancies = buildRoomOccupancyAssignments(
        values.roomIds,
        values.adults,
        values.children
      );

      const stayNights = Math.max(
        differenceInDays(values.dateRange.to, values.dateRange.from),
        1
      );
      const customTotals = buildCustomRoomTotals(values.roomIds, stayNights);
      const hasCustomTotals = customTotals.some(
        (total) => typeof total === "number" && total > 0
      );

      const result = await addReservation({
        guestId: values.guestId,
        roomIds: values.roomIds,
        ratePlanId: defaultRatePlan.id,
        checkInDate: formatISO(values.dateRange.from, { representation: "date" }),
        checkOutDate: formatISO(values.dateRange.to, { representation: "date" }),
        numberOfGuests: values.adults + values.children,
        adultCount: values.adults,
        childCount: values.children,
        status: values.status,
        notes: values.notes,
        bookingDate: new Date().toISOString(),
        source: "reception",
        paymentMethod: values.paymentMethod,
        roomOccupancies,
        customRoomTotals: hasCustomTotals ? customTotals : undefined,
      });

      if (!result.length) {
        toast.error("Reservation could not be created.");
        return;
      }

      toast.success("Reservation created successfully.");
      router.replace(`/admin/reservations/${result[0].id}?createdBooking=1`);
    } catch (error) {
      const isConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "23P01";

      toast.error(
        isConflict ? "Room No Longer Available" : "Failed to create reservation",
        {
          description: isConflict
            ? (error as { message?: string }).message ||
              "One or more rooms are already booked for the selected dates."
            : (error as Error).message,
        },
      );
    }
  };

  if (isLoading) {
    return (
      <PermissionGate feature="reservationCreate">
        <div className="space-y-4">
          <div className="h-12 w-72 rounded-xl bg-muted animate-pulse" />
          <div className="h-96 rounded-2xl bg-muted animate-pulse" />
        </div>
      </PermissionGate>
    );
  }

  return (
    <PermissionGate feature="reservationCreate">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-serif font-semibold">Create Reservation</h1>
            <p className="text-sm text-muted-foreground">
              Capture reservation details using the same experience guests see online.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/reservations" prefetch={false}>Back to Reservations</Link>
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Guest</CardTitle>
                  <CardDescription>Select an existing guest or add a new one.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <FormField
                      control={form.control}
                      name="guestId"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Guest</FormLabel>
                          <Popover open={guestPopoverOpen} onOpenChange={setGuestPopoverOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={guestPopoverOpen}
                                  className={cn(
                                    "h-12 w-full justify-between rounded-xl border border-border/50 bg-card/80 px-4 font-medium",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {selectedGuestLabel ? selectedGuestLabel : "Select guest"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[var(--radix-popover-trigger-width)] rounded-2xl border border-border/50 bg-card/95 p-0 shadow-lg backdrop-blur"
                            >
                              <Command>
                                <CommandInput placeholder="Search guest..." />
                                <CommandList>
                                  <CommandEmpty>No guest found.</CommandEmpty>
                                  <CommandGroup>
                                    {guests.map((guest) => {
                                      const guestLabel = formatGuestName(guest);
                                      const isSelected = guest.id === field.value;
                                      return (
                                        <CommandItem
                                          key={guest.id}
                                          value={guest.id}
                                          keywords={buildGuestKeywords(guest)}
                                          className="text-foreground data-[selected=true]:text-primary"
                                          onSelect={() => {
                                            form.setValue("guestId", guest.id, { shouldValidate: true });
                                            setGuestPopoverOpen(false);
                                          }}
                                        >
                                          <span
                                            className={cn(
                                              "mr-2 flex h-5 w-5 items-center justify-center rounded-md border border-border/60",
                                              isSelected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "opacity-60 [&_svg]:invisible"
                                            )}
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                          </span>
                                          {guestLabel || "Unnamed guest"}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button variant="outline" className="h-12 shrink-0" asChild>
                      <Link href={guestCreationUrl} prefetch={false}>
                        Add New Guest
                      </Link>
                    </Button>
                  </div>
                  {selectedGuest && (
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
                      <div className="font-medium">{selectedGuest.firstName} {selectedGuest.lastName}</div>
                      <div className="text-muted-foreground">{selectedGuest.email}</div>
                      <div className="text-muted-foreground">{selectedGuest.phone}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stay Details</CardTitle>
                  <CardDescription>Choose dates, guests, and room type filters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check-in / Check-out</FormLabel>
                        <FormControl>
                          <ReservationDateRangePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="adults"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adults</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="children"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Children</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="roomTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Room Type Filter</FormLabel>
                          <Select
                            value={field.value ?? "__all"}
                            onValueChange={(val) => field.onChange(val === "__all" ? undefined : val)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All room types" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__all">All room types</SelectItem>
                              {roomTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Rooms</CardTitle>
                  <CardDescription>Select one or more rooms for this booking.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-72 overflow-y-auto pr-1">
                    <div className="space-y-3">
                      {watchedDateRange?.from && watchedDateRange?.to ? (
                        filteredAvailableRooms.length ? (
                          filteredAvailableRooms.map((room) => {
                            const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
                            const isSelected = selectedRoomIds.includes(room.id);
                            return (
                              <div
                                key={room.id}
                                className={cn(
                                  "flex items-center gap-4 rounded-2xl border px-4 py-3",
                                  isSelected ? "border-primary/60 bg-primary/5" : "border-border/40 bg-card"
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleRoomToggle(room.id)}
                                  id={`room-${room.id}`}
                                />
                                <label htmlFor={`room-${room.id}`} className="flex flex-1 flex-col text-sm font-medium">
                                  <span className="flex items-center gap-2">
                                    Room {room.roomNumber}
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-border/50 bg-background/50 px-2 py-0 text-[10px] font-semibold"
                                    >
                                      {ROOM_STATUS_LABELS[room.status]}
                                    </Badge>
                                  </span>
                                  <span className="text-xs text-muted-foreground">{roomType?.name}</span>
                                </label>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                            No rooms match the selected dates or filters.
                          </div>
                        )
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                          Select dates to load available rooms.
                        </div>
                      )}
                    </div>
                  </div>
                  {form.formState.errors.roomIds && (
                    <p className="mt-2 text-sm text-destructive">
                      {form.formState.errors.roomIds.message}
                    </p>
                  )}
                  <div className="mt-4 rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Capacity Selected</span>
                      <span className="font-medium">
                        {selectedRoomIds.length ? `${selectedRoomsCapacity} guests` : "0"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Guest count: {totalGuests} ({adults} adults / {children} children)
                    </div>
                    {!hasCapacityForGuests && selectedRoomIds.length > 0 && (
                      <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        Add more rooms or adjust guests. Need capacity for {totalGuests} but currently have {selectedRoomsCapacity}.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Prices (optional)</CardTitle>
                  <CardDescription>Override nightly rates for selected room types.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {uniqueSelectedRoomTypes.length ? (
                    uniqueSelectedRoomTypes.map((roomType) => {
                      const overrideValue = customRatesValue[roomType.id];
                      const hasOverride = typeof overrideValue === "number" && overrideValue > 0;
                      const defaultNightlyRate = resolveRoomNightlyRate({
                        roomType,
                        ratePlan: defaultRatePlan,
                      });
                      const errorMessage = customRateErrors?.[roomType.id]?.message;
                      return (
                        <div
                          key={roomType.id}
                          className="space-y-2 rounded-xl border border-border/50 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{roomType.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Default {formatCurrency(defaultNightlyRate)} / night
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={1}
                                className="w-28"
                                value={typeof overrideValue === "number" ? overrideValue : ""}
                                onChange={(event) =>
                                  handleCustomRateInput(roomType.id, event.target.value)
                                }
                                placeholder={formatCurrency(defaultNightlyRate)}
                              />
                              {hasOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetCustomRate(roomType.id)}
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                          </div>
                          {errorMessage && (
                            <p className="text-xs text-destructive">{errorMessage}</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                      Select rooms to override their nightly rates.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Changes apply only to this booking and update the summary immediately.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Additional Details</CardTitle>
                  <CardDescription>Status, payment method, and notes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {creatableStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentMethodOptions.map((method) => (
                                <SelectItem key={method} value={method}>
                                  {method}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Optional notes for the front desk" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                  <CardDescription>Review before saving.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Guests</span>
                      <span className="font-medium">{adults + children} ({adults} Adults / {children} Children)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Nights</span>
                      <span className="font-medium">{nights || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rooms Selected</span>
                      <span className="font-medium">{selectedRoomIds.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className={cn("font-medium", hasCapacityForGuests ? "text-foreground" : "text-destructive")}>{selectedRoomsCapacity} / {totalGuests}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">{pricing ? formatCurrency(pricing.totalCost) : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Taxes & Fees</span>
                      <span className="font-semibold">
                        {pricing
                          ? `${taxConfig.enabled && pricing.taxRatePercent ? `${pricing.taxRatePercent.toFixed(pricing.taxRatePercent % 1 === 0 ? 0 : 2)}% · ` : ""}${formatCurrency(pricing.taxesAndFees)}`
                          : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-base">
                      <span className="font-medium">Grand Total</span>
                      <span className="font-semibold">{pricing ? formatCurrency(pricing.grandTotal) : "-"}</span>
                    </div>
                  </div>
                  {!taxConfig.enabled && (
                    <p className="text-xs text-muted-foreground">
                      Taxes &amp; Fees are turned off in Property Settings.
                    </p>
                  )}
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected Rooms</div>
                    {selectedRoomIds.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedRoomIds.map((roomId) => {
                          const room = rooms.find((r) => r.id === roomId);
                          return (
                            <Badge key={roomId} variant="secondary" className="rounded-full px-3 py-1">
                              Room {room?.roomNumber}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No rooms selected yet.</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full mt-4" disabled={form.formState.isSubmitting || !hasCapacityForGuests}>
                    {form.formState.isSubmitting ? "Saving..." : !hasCapacityForGuests ? "Add more capacity" : "Save Reservation & Generate Invoice"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Website Rates</CardTitle>
                  <CardDescription>Reference pricing from the public site.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {roomTypes.map((roomType) => (
                    <div key={roomType.id} className="rounded-xl border border-border/40 p-3">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{roomType.name}</span>
                        <span className="text-primary">
                          {roomType.price
                            ? `${formatCurrency(roomType.price)} / night`
                            : "-"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Up to {roomType.maxOccupancy} guests · {roomType.bedTypes.join(", ")}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </div>
    </PermissionGate>
  );
}
