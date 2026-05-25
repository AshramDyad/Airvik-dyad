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
import { resolveBookingGroup } from "@/lib/reservations/resolve-booking-group";
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

  const resolvedBookingGroup = React.useMemo(
    () =>
      resolveBookingGroup({
        reservationId: reservationIdFromParams,
        activeBookingReservations: isolatedBookingReservations,
        reservations,
        bookings,
      }),
    [bookings, isolatedBookingReservations, reservationIdFromParams, reservations]
  );

  const reservation = resolvedBookingGroup.selectedReservation;
  const lookupState = reservationIdFromParams
    ? lookupStatus[reservationIdFromParams]
    : undefined;
  const isBookingLookupPending =
    Boolean(reservationIdFromParams) &&
    (isBookingLookupLoading || !lookupState || lookupState === "pending");
  const isBaseDataLoading =
    isLoading || isSessionLoading || isReservationsInitialLoading;
  const shouldWaitForCompleteGroup =
    Boolean(reservation) &&
    !resolvedBookingGroup.hasCompleteGroup &&
    (isBaseDataLoading || isBookingLookupPending);

  const isActuallyLoading = isBaseDataLoading || isBookingLookupPending;

  console.log(
    `[Page] Render state: id=${reservationIdFromParams}, loading=${isActuallyLoading}, res=${!!reservation}, status=${lookupState ?? "none"}, source=${resolvedBookingGroup.source}, completeGroup=${resolvedBookingGroup.hasCompleteGroup}`
  );

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

  if (shouldWaitForCompleteGroup) {
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

  const resolvedBookingReservations =
    resolvedBookingGroup.hasCompleteGroup &&
    resolvedBookingGroup.bookingReservations.length > 0
      ? resolvedBookingGroup.bookingReservations
      : [reservation];

  const bookingReservationsWithDetails: ReservationWithDetails[] =
    resolvedBookingReservations.map((entry) => {
      const entryGuest = guests.find((g) => g.id === entry.guestId);
      const entryRoomNumber =
        rooms.find((room) => room.id === entry.roomId)?.roomNumber;
      const existingGuestName =
        "guestName" in entry && typeof entry.guestName === "string"
          ? entry.guestName
          : undefined;
      const existingRoomNumber =
        "roomNumber" in entry && typeof entry.roomNumber === "string"
          ? entry.roomNumber
          : undefined;
      const existingNights =
        "nights" in entry && typeof entry.nights === "number"
          ? entry.nights
          : undefined;

      return {
        ...entry,
        guestName: entryGuest
          ? `${entryGuest.firstName} ${entryGuest.lastName}`
          : existingGuestName ?? "N/A",
        roomNumber: entryRoomNumber ?? existingRoomNumber ?? "N/A",
        nights:
          existingNights ??
          differenceInDays(
            parseISO(entry.checkOutDate),
            parseISO(entry.checkInDate)
          ),
      };
    });

  const reservationWithDetails =
    bookingReservationsWithDetails.find((entry) => entry.id === reservation.id) ??
    bookingReservationsWithDetails[0];

  if (!reservationWithDetails) {
    return (
      <PermissionGate feature="reservations">
        <ReservationDetailsSkeleton />
      </PermissionGate>
    );
  }

  const allBookingReservations = bookingReservationsWithDetails;

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
      <div className="min-w-0 space-y-6">
        <ReservationHeader
          reservation={reservationWithDetails}
          bookingStatus={bookingAggregateStatus}
          bookingReservations={displayBookingReservations}
        />
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <GuestDetailsCard guest={guest} />
            <StayDetailsCard reservation={stayDetailsReservation} />
            <LinkedReservationsCard
              reservations={groupSummary.reservations}
            />
          </div>
          <div className="min-w-0 space-y-6">
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
    <div className="min-w-0 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="min-w-0 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
