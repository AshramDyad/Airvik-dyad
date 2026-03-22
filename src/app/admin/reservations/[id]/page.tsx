"use client";

import * as React from "react";
import { useParams, notFound } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

import { useDataContext } from "@/context/data-context";
import { ReservationHeader } from "./components/ReservationHeader";
import { GuestDetailsCard } from "./components/GuestDetailsCard";
import { StayDetailsCard } from "./components/StayDetailsCard";
import { BillingCard } from "./components/BillingCard";
import { LinkedReservationsCard } from "./components/LinkedReservationsCard";
import { ReservationActivityTimeline } from "./components/ReservationActivityTimeline";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import { calculateReservationTaxAmount } from "@/lib/reservations/calculate-financials";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/admin/permission-gate";
import {
  isActiveReservationStatus,
  resolveAggregateStatus,
} from "@/lib/reservations/status";
import { isReservationRemovedDuringEdit } from "@/lib/reservations/filters";

export default function ReservationDetailsPage() {
  const params = useParams<{ id: string }>();
  const {
    reservations,
    guests,
    rooms,
    property,
    isLoading,
    loadBookingDetails,
    isReservationsInitialLoading,
    isBookingLookupLoading,
    isSessionLoading,
    lookupStatus,
    activeBookingReservations: isolatedBookingReservations,
    bookings,
  } = useDataContext();

  const reservationIdFromParams = React.useMemo(() => {
    const rawId = params?.id;
    if (!rawId) return "";
    return Array.isArray(rawId) ? rawId[0] ?? "" : rawId;
  }, [params]);

  React.useEffect(() => {
    if (reservationIdFromParams) {
      console.log(`[Page] Effect triggered for ID: ${reservationIdFromParams}`);
      loadBookingDetails(reservationIdFromParams);
    }
  }, [reservationIdFromParams, loadBookingDetails]);

  const reservation = React.useMemo(() => {
    const found = isolatedBookingReservations.find((r) => r.id === reservationIdFromParams) ||
                  reservations.find((r) => r.id === reservationIdFromParams) ||
                  bookings.flatMap((b) => b.subRows).find((r) => r.id === reservationIdFromParams);
    console.log(`[Page] Finding reservation for ${reservationIdFromParams}: ${found ? 'Found' : 'Not Found'}`);
    return found;
  }, [reservations, isolatedBookingReservations, bookings, reservationIdFromParams]);

  const isActuallyLoading = 
    isLoading || 
    isSessionLoading || 
    isReservationsInitialLoading || 
    isBookingLookupLoading ||
    (reservationIdFromParams && (!lookupStatus[reservationIdFromParams] || lookupStatus[reservationIdFromParams] === 'pending'));

  console.log(`[Page] Render state: id=${reservationIdFromParams}, loading=${isActuallyLoading}, res=${!!reservation}, status=${reservationIdFromParams ? lookupStatus[reservationIdFromParams] : 'none'}`);

  if (!reservationIdFromParams) {
    if (isActuallyLoading) {
      return (
        <PermissionGate feature="reservations">
          <ReservationDetailsSkeleton />
        </PermissionGate>
      );
    }
    return notFound();
  }

  if (isActuallyLoading && !reservation) {
    return (
      <PermissionGate feature="reservations">
        <ReservationDetailsSkeleton />
      </PermissionGate>
    );
  }

  if (!reservation && !isActuallyLoading && lookupStatus[reservationIdFromParams] === 'error') {
    console.warn(`[Page] Reservation not found for ${reservationIdFromParams}`);
    return (
      <PermissionGate feature="reservations">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-semibold">Reservation not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The reservation you are looking for does not exist or has been removed.
          </p>
        </div>
      </PermissionGate>
    );
  }

  // Ensure TypeScript knows reservation is defined
  if (!reservation) {
    return (
      <PermissionGate feature="reservations">
        <ReservationDetailsSkeleton />
      </PermissionGate>
    );
  }

  const guest = guests.find((g) => g.id === reservation.guestId);

  const bookingReservationsWithDetails: ReservationWithDetails[] = (isolatedBookingReservations.length > 0 ? isolatedBookingReservations : reservations)
    .filter((entry) => entry.bookingId === reservation.bookingId)
    .map((entry) => {
      const entryGuest = guests.find((g) => g.id === entry.guestId);
      const entryRoomNumber =
        rooms.find((room) => room.id === entry.roomId)?.roomNumber || "N/A";
      return {
        ...entry,
        guestName: entryGuest
          ? `${entryGuest.firstName} ${entryGuest.lastName}`
          : "N/A",
        roomNumber: entryRoomNumber,
        nights: differenceInDays(
          parseISO(entry.checkOutDate),
          parseISO(entry.checkInDate)
        ),
      } as ReservationWithDetails;
    });

  const fallbackReservationDetails: ReservationWithDetails = {
    ...reservation,
    guestName: guest ? `${guest.firstName} ${guest.lastName}` : "N/A",
    roomNumber:
      rooms.find((r) => r.id === reservation.roomId)?.roomNumber || "N/A",
    nights: differenceInDays(
      parseISO(reservation.checkOutDate),
      parseISO(reservation.checkInDate)
    ),
  };

  const reservationWithDetails =
    bookingReservationsWithDetails.find((entry) => entry.id === reservation.id) ??
    fallbackReservationDetails;

  const allBookingReservations =
    bookingReservationsWithDetails.length > 0
      ? bookingReservationsWithDetails
      : [reservationWithDetails];

  const retainedBookingReservations = allBookingReservations.filter(
    (entry) => !isReservationRemovedDuringEdit(entry)
  );

  const bookingReservationPool =
    retainedBookingReservations.length > 0
      ? retainedBookingReservations
      : allBookingReservations;

  const activeBookingReservations = bookingReservationPool.filter((entry) =>
    isActiveReservationStatus(entry.status)
  );

  const displayBookingReservations =
    activeBookingReservations.length > 0
      ? activeBookingReservations
      : bookingReservationPool;

  const taxesTotal = displayBookingReservations.reduce(
    (sum, entry) => sum + calculateReservationTaxAmount(entry, property),
    0
  );
  const enabledRates = displayBookingReservations
    .map((entry) => (entry.taxEnabledSnapshot ? entry.taxRateSnapshot ?? 0 : 0))
    .filter((rate) => rate > 0);
  const uniqueRates = new Set(enabledRates.map((rate) => rate.toFixed(4)));
  const hasMixedTaxRates = uniqueRates.size > 1;
  const appliedTaxRate = enabledRates.length === 1 ? enabledRates[0] : 0;

  const groupSummary = {
    reservations: displayBookingReservations,
    roomCount: displayBookingReservations.length,
    totalAmount: displayBookingReservations.reduce(
      (sum, entry) => sum + entry.totalAmount,
      0
    ),
    folio: displayBookingReservations.flatMap((entry) => entry.folio ?? []),
    taxesTotal,
    hasMixedTaxRates,
    appliedTaxRate: hasMixedTaxRates ? null : appliedTaxRate,
  };

  const aggregateCounts = displayBookingReservations.reduce(
    (acc, entry) => {
      acc.guests += entry.numberOfGuests ?? 0;
      acc.adults += entry.adultCount ?? 0;
      acc.children += entry.childCount ?? 0;
      return acc;
    },
    { guests: 0, adults: 0, children: 0 }
  );

  const shouldUseAggregatedCounts =
    displayBookingReservations.length > 1 ||
    aggregateCounts.guests > 0 ||
    aggregateCounts.adults > 0 ||
    aggregateCounts.children > 0;

  const stayDetailsReservation: ReservationWithDetails = {
    ...reservationWithDetails,
    numberOfGuests: shouldUseAggregatedCounts
      ? aggregateCounts.guests
      : reservationWithDetails.numberOfGuests,
    adultCount: shouldUseAggregatedCounts
      ? aggregateCounts.adults
      : reservationWithDetails.adultCount,
    childCount: shouldUseAggregatedCounts
      ? aggregateCounts.children
      : reservationWithDetails.childCount,
  };

  const aggregateStatusSource =
    activeBookingReservations.length > 0
      ? activeBookingReservations
      : bookingReservationPool;

  const bookingAggregateStatus = resolveAggregateStatus(
    aggregateStatusSource.map((entry) => entry.status)
  );

  return (
    <PermissionGate feature="reservations">
      <div className="space-y-6">
        <ReservationHeader
          reservation={reservationWithDetails}
          bookingStatus={bookingAggregateStatus}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <GuestDetailsCard guest={guest} />
            <StayDetailsCard reservation={stayDetailsReservation} />
            <LinkedReservationsCard
              reservations={groupSummary.reservations}
            />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <BillingCard
              reservation={reservationWithDetails}
              groupSummary={groupSummary}
            />
            <ReservationActivityTimeline reservationId={reservation.id} />
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}

function ReservationDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
