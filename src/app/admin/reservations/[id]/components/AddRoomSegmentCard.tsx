"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarMonths,
  differenceInDays,
  format,
  formatISO,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReservationDateRangePicker } from "@/components/reservations/date-range-picker";
import { useDataContext } from "@/context/data-context";
import { useMultiMonthAvailability } from "@/hooks/use-monthly-availability";
import { buildRoomOccupancyAssignments } from "@/lib/reservations/guest-allocation";
import { getNewRoomReservationStatusForPayment } from "@/lib/payments/reservation-payment-policy";
import { isBookableRoom } from "@/lib/rooms";
import type {
  AvailabilityDay,
  Reservation,
  ReservationStatus,
  Room,
} from "@/data/types";

interface AddRoomSegmentCardProps {
  bookingId: string;
  guestId: string;
  ratePlanId: string | null;
  paymentMethod: Reservation["paymentMethod"];
  source: Reservation["source"];
  bookingDate: string;
  taxEnabledSnapshot: boolean;
  taxRateSnapshot: number;
  currentStatus: ReservationStatus;
  adultCount: number;
  childCount: number;
  /** ISO date (YYYY-MM-DD) — the latest checkout across the booking's rooms. */
  latestCheckOutDate: string;
}

// The nights [from, to) covered by a range, as YYYY-MM-DD keys (checkout excluded).
function getNightKeys(from: Date, to: Date): string[] {
  const nightCount = Math.max(differenceInDays(to, from), 0);
  return Array.from({ length: nightCount }, (_, index) =>
    formatISO(addDays(from, index), { representation: "date" })
  );
}

// How many calendar months the nights of a stay span (for availability fetching).
function getStayMonthCount(from: Date, to: Date): number {
  const lastNight = addDays(to, -1);
  if (lastNight < from) return 1;
  return (
    differenceInCalendarMonths(startOfMonth(lastNight), startOfMonth(from)) + 1
  );
}

// Bookable rooms that are open and unbooked for every night in `nightKeys`.
function getRoomsFreeForNights(
  rooms: Room[],
  nightKeys: string[],
  availabilityByRoomType: Map<string, Map<string, AvailabilityDay>>
): Room[] {
  if (nightKeys.length === 0) return [];
  return rooms.filter((room) => {
    if (!isBookableRoom(room)) return false;
    const byDate = availabilityByRoomType.get(room.roomTypeId);
    if (!byDate) return false;
    return nightKeys.every((key) => {
      const day = byDate.get(key);
      return Boolean(day && !day.isClosed && !day.roomReservations[room.id]);
    });
  });
}

export function AddRoomSegmentCard({
  bookingId,
  guestId,
  ratePlanId,
  paymentMethod,
  source,
  bookingDate,
  taxEnabledSnapshot,
  taxRateSnapshot,
  currentStatus,
  adultCount,
  childCount,
  latestCheckOutDate,
}: AddRoomSegmentCardProps) {
  const { rooms, roomTypes, addRoomsToBooking, notifyReservationsChanged } =
    useDataContext();

  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedRoomId, setSelectedRoomId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Default the new segment to a single night starting where the booking ends,
  // so a "move to another room for the next night" is one click away.
  const defaultRange = React.useMemo<DateRange>(() => {
    const start = parseISO(latestCheckOutDate);
    return { from: start, to: addDays(start, 1) };
  }, [latestCheckOutDate]);

  const [dateRange, setDateRange] = React.useState<DateRange>(defaultRange);

  React.useEffect(() => {
    setDateRange(defaultRange);
  }, [defaultRange]);

  const hasRange = Boolean(dateRange.from && dateRange.to);

  const nightKeys = React.useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    return getNightKeys(dateRange.from, dateRange.to);
  }, [dateRange.from, dateRange.to]);

  const availabilityStartMonth = React.useMemo(
    () => startOfMonth(dateRange.from ?? new Date()),
    [dateRange.from]
  );
  const availabilityMonthCount = React.useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 1;
    return getStayMonthCount(dateRange.from, dateRange.to);
  }, [dateRange.from, dateRange.to]);

  const {
    dataByMonth,
    isLoading: isAvailabilityLoading,
    error: availabilityError,
  } = useMultiMonthAvailability(availabilityStartMonth, availabilityMonthCount);

  const availabilityByRoomType = React.useMemo(() => {
    const next = new Map<string, Map<string, AvailabilityDay>>();
    Object.values(dataByMonth).forEach((monthAvailability) => {
      monthAvailability.forEach((roomTypeAvailability) => {
        const dateMap =
          next.get(roomTypeAvailability.roomType.id) ??
          new Map<string, AvailabilityDay>();
        roomTypeAvailability.availability.forEach((day) => {
          dateMap.set(day.date, day);
        });
        next.set(roomTypeAvailability.roomType.id, dateMap);
      });
    });
    return next;
  }, [dataByMonth]);

  const availableRooms = React.useMemo(() => {
    if (isAvailabilityLoading || availabilityError) return [];
    return getRoomsFreeForNights(rooms, nightKeys, availabilityByRoomType);
  }, [rooms, nightKeys, availabilityByRoomType, isAvailabilityLoading, availabilityError]);

  // Drop the chosen room if it stops being available.
  React.useEffect(() => {
    if (selectedRoomId && !availableRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId("");
    }
  }, [selectedRoomId, availableRooms]);

  const roomTypeName = React.useCallback(
    (roomTypeId: string) => roomTypes.find((rt) => rt.id === roomTypeId)?.name,
    [roomTypes]
  );

  const handleAddRoom = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error("Select the dates for the new room.");
      return;
    }
    if (!selectedRoomId) {
      toast.error("Choose a room for these dates.");
      return;
    }

    const checkInDate = formatISO(dateRange.from, { representation: "date" });
    const checkOutDate = formatISO(dateRange.to, { representation: "date" });

    setIsSubmitting(true);
    try {
      await addRoomsToBooking({
        bookingId,
        roomIds: [selectedRoomId],
        guestId,
        ratePlanId: ratePlanId ?? "",
        checkInDate,
        checkOutDate,
        numberOfGuests: adultCount + childCount,
        adultCount,
        childCount,
        status: getNewRoomReservationStatusForPayment({
          paymentMethod,
          currentStatus,
        }),
        bookingDate,
        source,
        paymentMethod,
        taxEnabledSnapshot,
        taxRateSnapshot,
        roomOccupancies: buildRoomOccupancyAssignments(
          [selectedRoomId],
          adultCount,
          childCount
        ),
      });

      notifyReservationsChanged({ bookingId });
      toast.success("Room added to this booking for the selected dates.");
      setSelectedRoomId("");
      setIsOpen(false);
    } catch (error) {
      const isConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "23P01";
      toast.error(
        isConflict ? "Room No Longer Available" : "Could not add the room",
        {
          description: isConflict
            ? (error as { message?: string }).message ||
              "That room was just booked for these dates. Pick another room."
            : (error as Error).message,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="font-serif text-lg font-semibold">
          Add Room for Other Dates
        </CardTitle>
        <CardDescription>
          Keep the guest in this booking but move them to another room for part
          of the stay (e.g. the last night). Added as a room in this same
          booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOpen ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setIsOpen(true)}
          >
            Add another room
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Dates for the new room
              </label>
              <ReservationDateRangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range ?? { from: undefined, to: undefined })}
                allowPastDates
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Room available for these dates
              </label>
              {!hasRange ? (
                <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  Select dates to see available rooms.
                </p>
              ) : isAvailabilityLoading ? (
                <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  Checking available rooms...
                </p>
              ) : availabilityError ? (
                <p className="rounded-lg border border-dashed border-destructive/50 px-3 py-2 text-xs text-destructive">
                  Could not check availability. Try again.
                </p>
              ) : availableRooms.length ? (
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((room) => {
                      const typeName = roomTypeName(room.roomTypeId);
                      return (
                        <SelectItem key={room.id} value={room.id}>
                          Room {room.roomNumber}
                          {typeName ? ` · ${typeName}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  No rooms are free for these dates.
                </p>
              )}
            </div>

            {hasRange && dateRange.from && dateRange.to && (
              <p className="text-xs text-muted-foreground">
                {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d")} ·{" "}
                {nightKeys.length} {nightKeys.length === 1 ? "night" : "nights"}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={handleAddRoom}
                disabled={isSubmitting || !selectedRoomId}
              >
                {isSubmitting ? "Adding..." : "Add room to booking"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpen(false);
                  setSelectedRoomId("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
