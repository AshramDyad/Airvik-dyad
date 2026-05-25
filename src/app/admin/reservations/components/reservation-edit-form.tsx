"use client";

import * as React from "react";
import { areIntervalsOverlapping, differenceInDays, format, formatISO, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { ReservationDateRangePicker } from "@/components/reservations/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { isBookableRoom, ROOM_STATUS_LABELS } from "@/lib/rooms";
import {
  calculateMultipleRoomPricing,
  calculateRoomPricing,
  getSeasonalPrice,
  resolveRoomNightlyRate,
  type RoomPricingOverrides,
} from "@/lib/pricing-calculator";
import { resolveReservationTaxConfig } from "@/lib/reservations/calculate-financials";
import { buildRoomOccupancyAssignments } from "@/lib/reservations/guest-allocation";
import {
  doesReservationBlockAvailability,
  isActiveReservationStatus,
} from "@/lib/reservations/status";
import { markReservationAsRemoved } from "@/lib/reservations/filters";
import { isReservationUuid } from "@/lib/reservations/identifiers";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import type { Reservation, RoomType } from "@/data/types";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import { useDataContext } from "@/context/data-context";

const dateRangeSchema = z
  .object({
    from: z.date({ required_error: "Check-in is required" }),
    to: z.date({ required_error: "Check-out is required" }),
  })
  .superRefine((range, ctx) => {
    if (!range.from || !range.to) {
      return;
    }
    if (range.to <= range.from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Check-out must be after check-in",
        path: [],
      });
    }
  });

const customRateRecordSchema = z
  .record(z.string(), z.coerce.number().min(1, "Custom price must be positive"))
  .default({})
  .transform((value) => value ?? {});

const buildEditReservationSchema = (
  resolveCapacity: (roomIds: string[]) => number
) =>
  z
    .object({
      dateRange: dateRangeSchema,
      adults: z.coerce.number().min(0, "Adults cannot be negative"),
      children: z.coerce.number().min(0, "Children cannot be negative"),
      roomIds: z.array(z.string()).min(1, "Select at least one room"),
      roomTypeId: z.string().optional(),
      notes: z.string().max(500, "Notes must be under 500 characters").optional(),
      customRates: customRateRecordSchema,
    })
    .superRefine((values, ctx) => {
      const totalGuests = (values.adults ?? 0) + (values.children ?? 0);
      if (totalGuests <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one guest is required",
          path: ["adults"],
        });
        return;
      }
      const capacity = resolveCapacity(values.roomIds ?? []);
      if (capacity > 0 && totalGuests > capacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guest count exceeds selected rooms capacity",
          path: ["roomIds"],
        });
      }
    });

type EditFormValues = z.input<ReturnType<typeof buildEditReservationSchema>>;

type PendingRoomEntry = {
  key: string;
  kind: "kept" | "new" | "removed";
  reservation?: Reservation;
  roomId: string;
  roomLabel: string;
  roomTypeLabel?: string;
  occupancyLabel?: string;
};

type GuestTotals = {
  adults: number;
  children: number;
};

type CustomRateFieldErrors = Partial<Record<string, { message?: string }>>;

interface ReservationEditFormProps {
  reservation: ReservationWithDetails;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function ReservationEditForm({
  reservation,
  onCancel,
  onSuccess,
}: ReservationEditFormProps) {
  const {
    updateReservation,
    addRoomsToBooking,
    reservations,
    rooms,
    roomTypes,
    guests,
    ratePlans,
    seasonalPrices,
    property,
    validateBookingRequest,
    refreshReservations,
    activeBookingReservations,
  } = useDataContext();

  const guest = React.useMemo(() => guests.find((g) => g.id === reservation.guestId), [guests, reservation.guestId]);

  const groupReservations = React.useMemo(
    () => (activeBookingReservations.length > 0 ? activeBookingReservations : reservations)
      .filter((entry) => entry.bookingId === reservation.bookingId),
    [reservations, activeBookingReservations, reservation.bookingId]
  );

  const activeGroupReservations = React.useMemo(
    () => groupReservations.filter((entry) => isActiveReservationStatus(entry.status)),
    [groupReservations]
  );

  const bookingGuestTotals = React.useMemo<GuestTotals>(() => {
    if (activeGroupReservations.length) {
      return activeGroupReservations.reduce(
        (acc, entry) => {
          const totals = resolveReservationGuestTotals(entry);
          return {
            adults: acc.adults + totals.adults,
            children: acc.children + totals.children,
          };
        },
        { adults: 0, children: 0 }
      );
    }

    return resolveReservationGuestTotals(reservation);
  }, [activeGroupReservations, reservation]);

  const initialStayNights = React.useMemo(
    () =>
      Math.max(
        differenceInDays(
          parseISO(reservation.checkOutDate),
          parseISO(reservation.checkInDate)
        ),
        1
      ),
    [reservation.checkInDate, reservation.checkOutDate]
  );

  const initialRoomIds = React.useMemo(() => {
    const ids = activeGroupReservations.map((entry) => entry.roomId);
    if (ids.length) {
      return ids;
    }
    return [reservation.roomId];
  }, [activeGroupReservations, reservation.roomId]);

  const normalizedInitialRoomIds = React.useMemo(
    () => [...initialRoomIds].sort(),
    [initialRoomIds]
  );

  const roomMap = React.useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const roomTypeMap = React.useMemo(() => new Map(roomTypes.map((type) => [type.id, type])), [roomTypes]);

  const derivedCustomRates = React.useMemo(() => {
    if (!initialStayNights) {
      return {};
    }
    const entries = new Map<string, number>();
    activeGroupReservations.forEach((entry) => {
      const room = roomMap.get(entry.roomId);
      if (!room) return;
      const roomType = roomTypeMap.get(room.roomTypeId);
      if (!roomType) return;
      if (!entry.totalAmount || entry.totalAmount <= 0) return;
      const nightly = entry.totalAmount / initialStayNights;
      if (nightly > 0) {
        entries.set(roomType.id, nightly);
      }
    });
    return Object.fromEntries(entries);
  }, [activeGroupReservations, initialStayNights, roomMap, roomTypeMap]);

  const resolveCapacity = React.useCallback(
    (roomIds: string[]) =>
      roomIds.reduce((sum, roomId) => {
        const room = roomMap.get(roomId);
        if (!room) return sum;
        const roomType = roomTypeMap.get(room.roomTypeId);
        return sum + (roomType?.maxOccupancy ?? 0);
      }, 0),
    [roomMap, roomTypeMap]
  );

  const schema = React.useMemo(() => buildEditReservationSchema(resolveCapacity), [resolveCapacity]);
  const resolver = React.useMemo(() => zodResolver(schema), [schema]);
  const formDefaultValues = React.useMemo(
    () => buildDefaultValues(reservation, initialRoomIds, bookingGuestTotals, derivedCustomRates),
    [reservation, initialRoomIds, bookingGuestTotals, derivedCustomRates]
  );

  const form = useForm<EditFormValues>({
    resolver,
    defaultValues: formDefaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const lastResetSignatureRef = React.useRef<string | null>(null);

  const defaultValuesSignature = React.useMemo(
    () =>
      JSON.stringify({
        id: reservation.id,
        checkIn: reservation.checkInDate,
        checkOut: reservation.checkOutDate,
        adults: bookingGuestTotals.adults,
        children: bookingGuestTotals.children,
        roomIds: normalizedInitialRoomIds,
        notes: reservation.notes ?? "",
        customRates: Object.entries(derivedCustomRates).sort(([a], [b]) => a.localeCompare(b)),
      }),
    [
      reservation.id,
      reservation.checkInDate,
      reservation.checkOutDate,
      bookingGuestTotals.adults,
      bookingGuestTotals.children,
      normalizedInitialRoomIds,
      reservation.notes,
      derivedCustomRates,
    ]
  );

  React.useEffect(() => {
    if (form.formState.isSubmitting) return;
    if (lastResetSignatureRef.current === defaultValuesSignature) return;
    form.reset(formDefaultValues);
    lastResetSignatureRef.current = defaultValuesSignature;
  }, [form, formDefaultValues, defaultValuesSignature]);

  React.useEffect(() => {
    void form.trigger("roomIds");
  }, [schema, form]);

  const watchedDateRange = form.watch("dateRange");
  const adults = Number(form.watch("adults")) || 0;
  const childGuests = Number(form.watch("children")) || 0;
  const totalGuests = adults + childGuests;
  const rawSelectedRoomIds = form.watch("roomIds");
  const selectedRoomIds = React.useMemo(() => rawSelectedRoomIds ?? [], [rawSelectedRoomIds]);
  const selectedRoomTypeId = form.watch("roomTypeId") || undefined;
  const customRates = form.watch("customRates");
  const customRatesValue = React.useMemo(() => customRates ?? {}, [customRates]);

  const nights = React.useMemo(() => {
    if (!watchedDateRange?.from || !watchedDateRange?.to) return 0;
    return Math.max(differenceInDays(watchedDateRange.to, watchedDateRange.from), 1);
  }, [watchedDateRange]);

  const bookingRoomIds = React.useMemo(
    () => new Set(activeGroupReservations.map((entry) => entry.roomId)),
    [activeGroupReservations]
  );

  const allAvailableRooms = React.useMemo(() => {
    if (!watchedDateRange?.from || !watchedDateRange?.to) {
      return [];
    }
    const windowStart = watchedDateRange.from;
    const windowEnd = watchedDateRange.to;

    return rooms.filter((room) => {
      const belongsToBooking = bookingRoomIds.has(room.id);
      if (!isBookableRoom(room) && !belongsToBooking) {
        return false;
      }

      const overlaps = reservations.some((resEntry) => {
        if (resEntry.bookingId === reservation.bookingId) return false;
        if (resEntry.roomId !== room.id) return false;
        if (!doesReservationBlockAvailability(resEntry)) return false;
        return areIntervalsOverlapping(
          { start: windowStart, end: windowEnd },
          { start: parseISO(resEntry.checkInDate), end: parseISO(resEntry.checkOutDate) },
          { inclusive: false }
        );
      });

      if (overlaps && !belongsToBooking) {
        return false;
      }

      return true;
    });
  }, [watchedDateRange, rooms, reservations, reservation.bookingId, bookingRoomIds]);

  const filteredAvailableRooms = React.useMemo(() => {
    if (!selectedRoomTypeId || selectedRoomTypeId === "__all") {
      return allAvailableRooms;
    }
    return allAvailableRooms.filter((room) => room.roomTypeId === selectedRoomTypeId);
  }, [allAvailableRooms, selectedRoomTypeId]);

  const pendingRoomEntries = React.useMemo<PendingRoomEntry[]>(() => {
    const entries: PendingRoomEntry[] = [];
    const selectedSet = new Set(selectedRoomIds);

    const buildRoomMeta = (roomId: string) => {
      const room = roomMap.get(roomId);
      const roomType = room ? roomTypeMap.get(room.roomTypeId) : undefined;
      return {
        roomLabel: room?.roomNumber ? `Room ${room.roomNumber}` : "Unassigned room",
        roomTypeLabel: roomType?.name,
        occupancyLabel: roomType?.maxOccupancy
          ? `${roomType.maxOccupancy} guests max`
          : undefined,
      } satisfies Pick<PendingRoomEntry, "roomLabel" | "roomTypeLabel" | "occupancyLabel">;
    };

    activeGroupReservations.forEach((entry) => {
      const kind: PendingRoomEntry["kind"] = selectedSet.has(entry.roomId)
        ? "kept"
        : "removed";
      entries.push({
        key: `${kind}-${entry.id}`,
        kind,
        reservation: entry,
        roomId: entry.roomId,
        ...buildRoomMeta(entry.roomId),
      });
    });

    selectedRoomIds.forEach((roomId) => {
      if (activeGroupReservations.some((entry) => entry.roomId === roomId)) {
        return;
      }
      entries.push({
        key: `new-${roomId}`,
        kind: "new",
        roomId,
        ...buildRoomMeta(roomId),
      });
    });

    const order: Record<PendingRoomEntry["kind"], number> = {
      kept: 0,
      new: 1,
      removed: 2,
    };

    return entries.sort((a, b) => order[a.kind] - order[b.kind]);
  }, [activeGroupReservations, roomMap, roomTypeMap, selectedRoomIds]);

  const getDefaultRatePlan = React.useMemo(() => {
    // Look for "Standard Rate" first, then fall back to first available rate plan
    return ratePlans.find((plan) => plan.name === "Standard Rate") || ratePlans[0];
  }, [ratePlans]);

  const ratePlan = React.useMemo(() => {
    if (!ratePlans.length) {
      return undefined;
    }

    // If reservation has a rate plan, use it
    if (reservation.ratePlanId) {
      return ratePlans.find((plan) => plan.id === reservation.ratePlanId);
    }

    // For imported reservations without rate plan, use default
    return getDefaultRatePlan;
  }, [ratePlans, reservation.ratePlanId, getDefaultRatePlan]);
  const ratePlanUnavailable = !ratePlan;

  const selectedRoomsCapacity = React.useMemo(
    () => resolveCapacity(selectedRoomIds),
    [resolveCapacity, selectedRoomIds]
  );
  const hasCapacity = totalGuests > 0 && selectedRoomsCapacity >= totalGuests;
  const canSubmit = form.formState.isValid && hasCapacity && selectedRoomIds.length > 0 && !ratePlanUnavailable;

  React.useEffect(() => {
    if (!watchedDateRange?.from || !watchedDateRange?.to) return;
    const availableIds = new Set(allAvailableRooms.map((room) => room.id));
    const current = form.getValues("roomIds") ?? [];
    const filtered = current.filter((id) => availableIds.has(id));
    if (filtered.length !== current.length) {
      form.setValue("roomIds", filtered, { shouldValidate: true });
    }
  }, [allAvailableRooms, form, watchedDateRange]);

  React.useEffect(() => {
    void form.trigger("roomIds");
  }, [adults, childGuests, form]);

  const taxSnapshotSource = React.useMemo(
    () => activeGroupReservations[0] ?? reservation,
    [activeGroupReservations, reservation]
  );

  const taxConfig = React.useMemo(() => {
    const config = resolveReservationTaxConfig(taxSnapshotSource, property);
    return {
      enabled: config.enabled,
      percentage: config.percentage,
    };
  }, [taxSnapshotSource, property]);
  const taxSnapshot = React.useMemo(
    () => {
      const enabled = Boolean(taxConfig.enabled);
      return {
        taxEnabledSnapshot: enabled,
        taxRateSnapshot: enabled ? taxConfig.percentage : 0,
      };
    },
    [taxConfig]
  );

  const selectedRoomTypes = React.useMemo(() => {
    return selectedRoomIds
      .map((roomId) => {
        const room = roomMap.get(roomId);
        if (!room) return null;
        return roomTypeMap.get(room.roomTypeId) ?? null;
      })
      .filter((type): type is NonNullable<typeof type> => Boolean(type));
  }, [selectedRoomIds, roomMap, roomTypeMap]);

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

  const formatCurrency = useCurrencyFormatter({ maximumFractionDigits: 0 });
  const customRateErrors = form.formState.errors.customRates as CustomRateFieldErrors | undefined;

  const nightlyOverrides = React.useMemo<RoomPricingOverrides | undefined>(() => {
    const entries = Object.entries(customRatesValue).filter(([, value]) =>
      typeof value === "number" && value > 0
    );
    return entries.length ? Object.fromEntries(entries) : undefined;
  }, [customRatesValue]);

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
        if (typeof override !== "number" || override <= 0) {
          return null;
        }
        return override * stayNights;
      });
    },
    [customRatesValue, roomMap, roomTypeMap]
  );

  const editCheckInDate = watchedDateRange?.from
    ? formatISO(watchedDateRange.from, { representation: "date" })
    : undefined;

  // When the check-in date changes, clear auto-filled custom rates that no longer match
  // the correct price for the new date. "Auto-filled" means the value was derived from
  // the saved totalAmount and equals derivedCustomRates[roomTypeId]. If the user typed a
  // different value, it won't match and will be left untouched.
  React.useEffect(() => {
    if (!editCheckInDate) return;

    const currentRates = form.getValues("customRates") ?? {};
    let changed = false;
    const nextRates: Record<string, number> = { ...currentRates };

    uniqueSelectedRoomTypes.forEach((roomType) => {
      const currentOverride = currentRates[roomType.id];
      if (typeof currentOverride !== "number" || currentOverride <= 0) return;

      // Only clear if this rate matches the auto-filled derived value (not a manual override).
      const autoFilledRate = derivedCustomRates[roomType.id];
      if (autoFilledRate !== currentOverride) return;

      // Compute the correct rate for the new check-in date.
      const seasonalRate = getSeasonalPrice(roomType.id, editCheckInDate, seasonalPrices);
      const defaultRate = roomType.price > 0 ? roomType.price : (ratePlan?.price ?? 0);
      const correctRate = seasonalRate ?? defaultRate;

      // If the stored rate is wrong for these dates, remove the override so the
      // pricing engine recalculates with the seasonal or default price.
      if (currentOverride !== correctRate) {
        delete nextRates[roomType.id];
        changed = true;
      }
    });

    if (changed) {
      form.setValue("customRates", nextRates, { shouldDirty: true, shouldValidate: true });
    }
    // We intentionally depend only on editCheckInDate so this runs exactly when the date
    // changes, not on every re-render. The other values are read inside and are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCheckInDate]);

  const pricing = React.useMemo(() => {
    if (!selectedRoomTypes.length || nights <= 0 || !ratePlan) return null;
    return calculateMultipleRoomPricing({
      roomTypes: selectedRoomTypes,
      ratePlan,
      nights: nights || 1,
      taxConfig,
      nightlyOverrides,
      seasonalPrices,
      checkInDate: editCheckInDate,
    });
  }, [selectedRoomTypes, ratePlan, nights, taxConfig, nightlyOverrides, seasonalPrices, editCheckInDate]);

  const resolveRoomCharge = React.useCallback(
    (roomId: string, stayNights: number) => {
      if (!stayNights || stayNights <= 0 || !ratePlan) {
        return null;
      }
      const room = roomMap.get(roomId);
      const roomType = room ? roomTypeMap.get(room.roomTypeId) : undefined;
      const pricingResult = calculateRoomPricing({
        roomType,
        ratePlan,
        nights: stayNights,
        rooms: 1,
        taxConfig,
        nightlyRateOverride: roomType ? customRatesValue[roomType.id] : undefined,
        seasonalPrices,
        checkInDate: editCheckInDate,
      });
      return pricingResult.totalCost;
    },
    [roomMap, roomTypeMap, ratePlan, taxConfig, customRatesValue, seasonalPrices, editCheckInDate]
  );

  const handleRoomToggle = (roomId: string) => {
    if (ratePlanUnavailable) {
      toast.error("Assign a rate plan before selecting rooms.");
      return;
    }
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
      toast.error("Select stay dates first.");
      return;
    }

    if (totalGuests <= 0) {
      toast.error("Add guests before selecting rooms.");
      return;
    }

    if (selectedRoomsCapacity >= totalGuests && totalGuests > 0) {
      toast.error("Capacity already matches guest count.");
      return;
    }

    form.setValue("roomIds", [...current, roomId], { shouldValidate: true });
  };

  const handleSubmit = async (values: EditFormValues) => {
    const { dateRange, adults: adultCount, children: childCount, notes } = values;
    if (!dateRange?.from || !dateRange?.to) {
      form.setError("dateRange", { message: "Select stay dates" });
      return;
    }

    // Ensure we have a rate plan - assign default if this is an imported reservation
    const effectiveRatePlan = ratePlan || getDefaultRatePlan;
    if (!effectiveRatePlan) {
      toast.error("No rate plans available. Please create a rate plan first.");
      return;
    }

    const uniqueRoomIds = Array.from(new Set(values.roomIds));
    form.setValue("roomIds", uniqueRoomIds, { shouldValidate: true });

    const totalGuestsSelected = adultCount + childCount;
    // Debug logging - remove in production
    console.log('reservation.ratePlanId:', reservation.ratePlanId);
    console.log('effectiveRatePlan:', effectiveRatePlan);
    console.log('effectiveRatePlan.id:', effectiveRatePlan?.id);
    console.log('isReservationUuid(effectiveRatePlan.id):', isReservationUuid(effectiveRatePlan?.id));

    const baseReservationPayload = {
      checkInDate: formatISO(dateRange.from, { representation: "date" }),
      checkOutDate: formatISO(dateRange.to, { representation: "date" }),
      notes: notes?.trim() || undefined,
      // Only include rate plan ID if it's a valid UUID
      ...(reservation.ratePlanId === null && isReservationUuid(effectiveRatePlan?.id) && {
        ratePlanId: effectiveRatePlan.id
      }),
    };
    const roomOccupancies = buildRoomOccupancyAssignments(
      uniqueRoomIds,
      adultCount,
      childCount
    );
    const occupancyByRoomId = new Map(
      roomOccupancies.map((entry) => [entry.roomId, entry])
    );
    const { taxEnabledSnapshot, taxRateSnapshot } = taxSnapshot;

    const stayNights = Math.max(differenceInDays(dateRange.to, dateRange.from), 1);
    const roomChargeMap = new Map<string, number>();
    uniqueRoomIds.forEach((roomId) => {
      const computed = resolveRoomCharge(roomId, stayNights);
      if (typeof computed === "number" && Number.isFinite(computed)) {
        roomChargeMap.set(roomId, computed);
      }
    });

    const remainingReservations = [...activeGroupReservations];
    const assignments: Array<{ reservation: Reservation; roomId: string }> = [];

    uniqueRoomIds.forEach((roomId) => {
      const matchIndex = remainingReservations.findIndex((entry) => entry.roomId === roomId);
      if (matchIndex !== -1) {
        const matched = remainingReservations.splice(matchIndex, 1)[0];
        assignments.push({ reservation: matched, roomId });
      }
    });

    const roomsStillNeeded = uniqueRoomIds.filter(
      (roomId) => !assignments.some((assignment) => assignment.roomId === roomId)
    );

    const roomsToCreate: string[] = [];
    roomsStillNeeded.forEach((roomId) => {
      const reassignmentTarget = remainingReservations.shift();
      if (reassignmentTarget) {
        assignments.push({ reservation: reassignmentTarget, roomId });
      } else {
        roomsToCreate.push(roomId);
      }
    });

    const reservationsToCancel = [...remainingReservations];

    const dateSummary = `${format(dateRange.from, "MMM d, yyyy")} - ${format(
      dateRange.to,
      "MMM d, yyyy"
    )}`;
    const revertStack: Array<() => Promise<unknown> | void> = [];

    try {
      const availabilityResults = await Promise.all(
        uniqueRoomIds.map(async (roomId, index) => {
          const allocation =
            occupancyByRoomId.get(roomId) ?? roomOccupancies[index] ?? {
              adults: adultCount,
              children: childCount,
            };

          return {
            roomId,
            result: await validateBookingRequest(
              baseReservationPayload.checkInDate,
              baseReservationPayload.checkOutDate,
              roomId,
              allocation.adults,
              allocation.children,
              reservation.bookingId
            ),
          };
        })
      );

      const unavailable = availabilityResults.find(({ result }) => !result.isValid);
      if (unavailable) {
        const room = roomMap.get(unavailable.roomId);
        const roomType = room ? roomTypeMap.get(room.roomTypeId) : undefined;
        const roomLabel = room?.roomNumber ? `Room ${room.roomNumber}` : "Selected room";
        const roomLine = roomType?.name ? `${roomLabel}, ${roomType.name}` : roomLabel;
        toast.error("These rooms are not available for these dates.", {
          description: `${dateSummary}\n${roomLine}.`,
        });
        return;
      }
      for (const { reservation: entry, roomId } of assignments) {
        const previousPayload = {
          checkInDate: entry.checkInDate,
          checkOutDate: entry.checkOutDate,
          adultCount: entry.adultCount,
          childCount: entry.childCount,
          numberOfGuests: entry.numberOfGuests ?? entry.adultCount + entry.childCount,
          notes: entry.notes ?? undefined,
          roomId: entry.roomId,
          totalAmount: entry.totalAmount,
          taxEnabledSnapshot: entry.taxEnabledSnapshot ?? false,
          taxRateSnapshot: entry.taxRateSnapshot ?? 0,
        };
        const allocation =
          occupancyByRoomId.get(roomId) ?? {
            adults: adultCount,
            children: childCount,
          };
        await updateReservation(entry.id, {
          ...baseReservationPayload,
          roomId,
          adultCount: allocation.adults,
          childCount: allocation.children,
          numberOfGuests: allocation.adults + allocation.children,
          totalAmount: roomChargeMap.get(roomId) ?? entry.totalAmount,
          taxEnabledSnapshot,
          taxRateSnapshot,
        });
        revertStack.push(() =>
          updateReservation(entry.id, {
            ...previousPayload,
          })
        );
      }

      const hasExplicitRoomRemoval =
        uniqueRoomIds.length > 0 &&
        activeGroupReservations.some(
          (entry) => !uniqueRoomIds.includes(entry.roomId)
        );

      if (hasExplicitRoomRemoval) {
        for (const entry of reservationsToCancel) {
          if (entry.status === "Cancelled") {
            continue;
          }
          const previousStatus = entry.status;
          const previousMetadata = entry.externalMetadata
            ? { ...entry.externalMetadata }
            : null;
          await updateReservation(entry.id, {
            status: "Cancelled",
            externalMetadata: markReservationAsRemoved(entry.externalMetadata),
          });
          revertStack.push(() =>
            updateReservation(entry.id, {
              status: previousStatus,
              externalMetadata: previousMetadata ?? {},
            })
          );
        }
      }

      if (roomsToCreate.length) {
        const newRoomOccupancies = roomsToCreate.map((roomId) => {
          const allocation = occupancyByRoomId.get(roomId) ?? {
            adults: adultCount,
            children: childCount,
          };
          return {
            roomId,
            adults: allocation.adults,
            children: allocation.children,
          };
        });

        const customTotalsForNewRooms = buildCustomRoomTotals(roomsToCreate, stayNights);
        const hasCustomTotals = customTotalsForNewRooms.some(
          (total) => typeof total === "number" && total > 0
        );

        await addRoomsToBooking({
          bookingId: reservation.bookingId,
          roomIds: roomsToCreate,
          guestId: reservation.guestId,
          ratePlanId: reservation.ratePlanId ?? "",
          checkInDate: baseReservationPayload.checkInDate,
          checkOutDate: baseReservationPayload.checkOutDate,
          numberOfGuests: totalGuestsSelected,
          adultCount,
          childCount,
          status: reservation.status,
          notes: baseReservationPayload.notes,
          bookingDate: reservation.bookingDate,
          source: reservation.source,
          paymentMethod:
            (reservation.paymentMethod as Reservation["paymentMethod"]) ?? "Not specified",
          taxEnabledSnapshot,
          taxRateSnapshot,
          roomOccupancies: newRoomOccupancies,
          customRoomTotals: hasCustomTotals ? customTotalsForNewRooms : undefined,
        });
      }

      await refreshReservations();
      toast.success("Reservation updated successfully.");
      onSuccess?.();
    } catch (error) {
      if (revertStack.length) {
        for (const revert of revertStack.reverse()) {
          try {
            await Promise.resolve(revert());
          } catch {
            // Best-effort rollback; ignore failures while reverting.
          }
        }
      }
      await refreshReservations();

      const isConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "23P01";

      toast.error(
        isConflict ? "Room No Longer Available" : "Failed to update reservation",
        {
          description: isConflict
            ? (error as { message?: string }).message ||
              "One or more rooms are already booked for the selected dates."
            : (error as Error)?.message ?? "We rolled back partial changes. Please try again.",
        },
      );
    }
  };

  const handleCancel = () => {
    form.reset(
      buildDefaultValues(reservation, initialRoomIds, bookingGuestTotals, derivedCustomRates)
    );
    onCancel?.();
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-6 lg:flex-row lg:items-start"
        >
          <div className="flex w-full flex-col gap-6 lg:w-3/5 lg:min-w-0">
            <section className="rounded-2xl border border-border/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guest</p>
                  <p className="text-base font-medium">
                    {guest ? `${guest.firstName} ${guest.lastName}` : reservation.guestName}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{guest?.email}</p>
                  <p>{guest?.phone || "No phone"}</p>
                </div>
              </div>
            </section>

            <section className="space-y-5 rounded-2xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Stay details</p>
                  <h3 className="text-base font-semibold">
                    {watchedDateRange?.from && watchedDateRange?.to
                      ? `${format(watchedDateRange.from, "MMM d, yyyy")} → ${format(
                        watchedDateRange.to,
                        "MMM d, yyyy"
                      )}`
                      : "Select dates"}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "-"}
                </p>
              </div>
              <FormField
                control={form.control}
                name="dateRange"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ReservationDateRangePicker
                        value={field.value as DateRange | undefined}
                        onChange={field.onChange}
                        allowPastDates
                      />
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
                        <Input type="number" min={0} {...field} />
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
                        onValueChange={(value) => field.onChange(value === "__all" ? undefined : value)}
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
              <div className="rounded-xl border border-dashed border-border/50 p-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-foreground">
                    {totalGuests} guest{totalGuests === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground">
                    Capacity after changes: {selectedRoomsCapacity || "-"} / {totalGuests || "-"}
                  </span>
                  {!hasCapacity && totalGuests > 0 && (
                    <span className="text-destructive">Add more rooms or reduce guests.</span>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-5 rounded-2xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Available rooms</p>
                  <h3 className="text-base font-semibold">Select rooms for this stay</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedRoomIds.length > 0
                    ? `${selectedRoomIds.length} selected`
                    : `${pendingRoomEntries.length} pending`}
                </p>
              </div>
              <FormField
                control={form.control}
                name="roomIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Select available rooms</FormLabel>
                    {ratePlanUnavailable && (
                      <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        Assign a rate plan to enable room selection.
                      </p>
                    )}
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {watchedDateRange?.from && watchedDateRange?.to ? (
                        filteredAvailableRooms.length ? (
                          filteredAvailableRooms.map((room) => {
                            const roomType = roomTypeMap.get(room.roomTypeId);
                            const statusLabel = ROOM_STATUS_LABELS[room.status] ?? room.status;
                            const isSelected = selectedRoomIds.includes(room.id);
                            return (
                              <label
                                key={room.id}
                                className={cn(
                                  "flex items-start gap-4 rounded-2xl border px-4 py-3",
                                  isSelected ? "border-primary bg-primary/5" : "border-border/50",
                                  ratePlanUnavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  disabled={ratePlanUnavailable}
                                  onCheckedChange={() => handleRoomToggle(room.id)}
                                />
                                <div className="flex flex-1 flex-col">
                                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                    <span>Room {room.roomNumber}</span>
                                    <Badge variant="outline" className="rounded-full text-xs">
                                      {statusLabel}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {roomType?.name}
                                    {roomType?.maxOccupancy ? ` · ${roomType.maxOccupancy} guests` : ""}
                                  </p>
                                </div>
                              </label>
                            );
                          })
                        ) : (
                          <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                            No rooms match the selected dates or filters.
                          </p>
                        )
                      ) : (
                        <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                          Select dates to see available rooms.
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Custom prices</p>
                  <h3 className="text-base font-semibold">Override nightly rates</h3>
                </div>
                {uniqueSelectedRoomTypes.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {uniqueSelectedRoomTypes.length} room type{uniqueSelectedRoomTypes.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              {uniqueSelectedRoomTypes.length ? (
                uniqueSelectedRoomTypes.map((roomType) => {
                  const overrideValue = customRatesValue[roomType.id];
                  const hasOverride = typeof overrideValue === "number" && overrideValue > 0;
                  const defaultNightlyRate = resolveRoomNightlyRate({
                    roomType,
                    ratePlan,
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
                  Select rooms to unlock per-booking price overrides.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Adjusted prices apply only to this booking and reflect everywhere once saved.
              </p>
            </section>
          </div>

          <div className="flex w-full flex-col gap-6 lg:w-2/5 lg:min-w-0">
            {!reservation.ratePlanId && ratePlan && (
              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-medium">Legacy Reservation</p>
                <p>
                  This reservation was imported without a rate plan. &ldquo;{ratePlan.name}&rdquo; has been automatically assigned for
                  editing purposes.
                </p>
              </section>
            )}
            {ratePlanUnavailable && (
              <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                No rate plan is available for this booking. Configure a rate plan to enable pricing and room assignment changes.
              </section>
            )}
            <section className="space-y-4 rounded-2xl border border-border/60 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                <h3 className="text-base font-semibold">Review before saving</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Guests</span>
                  <span className="font-medium">
                    {totalGuests} ({adults} Adults / {childGuests} Children)
                  </span>
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
                  <span className="text-muted-foreground">Rate Plan</span>
                  <span className={cn("font-medium", ratePlan ? "text-foreground" : "text-destructive")}>
                    {ratePlan?.name ?? "Unavailable"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className={cn("font-medium", hasCapacity ? "text-foreground" : "text-destructive")}>
                    {selectedRoomsCapacity} / {totalGuests}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{pricing ? formatCurrency(pricing.totalCost) : "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxes & Fees</span>
                  <span className="font-semibold">
                    {pricing
                      ? `${pricing.taxRatePercent
                        ? `${pricing.taxRatePercent.toFixed(
                          pricing.taxRatePercent % 1 === 0 ? 0 : 2
                        )}% · `
                        : ""
                      }${formatCurrency(pricing.taxesAndFees)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-medium">Grand Total</span>
                  <span className="font-semibold">{pricing ? formatCurrency(pricing.grandTotal) : "-"}</span>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Rooms</p>
                {selectedRoomIds.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedRoomIds.map((roomId) => {
                      const room = roomMap.get(roomId);
                      return (
                        <Badge key={roomId} variant="secondary" className="rounded-full px-3 py-1">
                          Room {room?.roomNumber ?? "-"}
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No rooms selected.</p>
                )}
              </div>
            </section>

            <div className="rounded-2xl border border-border/60 p-4">
              <div className="flex flex-col gap-3">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : "Save Changes & Update Invoice"}
                </Button>
              </div>
            </div>

            <section className="space-y-4 rounded-2xl border border-border/60 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Booked rooms</p>
                  <h3 className="text-base font-semibold">
                    {pendingRoomEntries.length} room{pendingRoomEntries.length === 1 ? "" : "s"}
                  </h3>
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-border/40 p-3">
                {pendingRoomEntries.length ? (
                  pendingRoomEntries.map((entry) => {
                    const isPrimary = entry.reservation?.id === reservation.id;
                    const dateLine = entry.reservation
                      ? `${format(parseISO(entry.reservation.checkInDate), "MMM d")} → ${format(
                        parseISO(entry.reservation.checkOutDate),
                        "MMM d"
                      )}`
                      : "Will be added after saving";
                    const actionLabel =
                      entry.kind === "kept"
                        ? "Kept"
                        : entry.kind === "new"
                          ? "Will add"
                          : "Will remove";
                    const actionVariant = entry.kind === "removed" ? "outline" : entry.kind === "new" ? "default" : "secondary";
                    return (
                      <div
                        key={entry.key}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2",
                          entry.kind === "new"
                            ? "border-primary/50 bg-primary/5"
                            : entry.kind === "removed"
                              ? "border-border/40 bg-muted/10"
                              : isPrimary
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/50"
                        )}
                      >
                        <div>
                          <p className="font-medium">{entry.roomLabel}</p>
                          <p className="text-xs text-muted-foreground">{dateLine}</p>
                          {entry.roomTypeLabel && (
                            <p className="text-xs text-muted-foreground">
                              {entry.roomTypeLabel}
                              {entry.occupancyLabel ? ` · ${entry.occupancyLabel}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs font-semibold">
                          <Badge variant={actionVariant}>{actionLabel}</Badge>
                          {entry.reservation && (
                            <Badge variant="outline" className="capitalize">
                              {entry.reservation.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                    Select at least one room to preview assignments.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 p-4">
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
            </section>
          </div>
        </form>
      </Form>
    </div>
  );
}

function buildDefaultValues(
  reservation: ReservationWithDetails,
  roomIds: string[],
  guestTotals?: GuestTotals,
  customRates?: Record<string, number>
): EditFormValues {
  const fallbackTotals = resolveReservationGuestTotals(reservation);
  return {
    dateRange: {
      from: parseISO(reservation.checkInDate),
      to: parseISO(reservation.checkOutDate),
    },
    adults: guestTotals?.adults ?? fallbackTotals.adults,
    children: guestTotals?.children ?? fallbackTotals.children,
    roomIds,
    roomTypeId: undefined,
    notes: reservation.notes ?? "",
    customRates: customRates ?? {},
  };
}

function resolveReservationGuestTotals(
  reservation: Pick<Reservation, "adultCount" | "childCount" | "numberOfGuests">
): GuestTotals {
  const children = typeof reservation.childCount === "number" ? reservation.childCount : 0;
  const adults = typeof reservation.adultCount === "number"
    ? reservation.adultCount
    : Math.max((reservation.numberOfGuests ?? 0) - children, 0);

  return {
    adults,
    children,
  };
}
