"use client";

import * as React from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

import { useDataContext } from "@/context/data-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReservationEditForm } from "@/app/admin/reservations/components/reservation-edit-form";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReservationEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    reservations,
    guests,
    rooms,
    isLoading,
    loadBookingDetails,
    isReservationsInitialLoading,
    isBookingLookupLoading,
    isSessionLoading,
    lookupStatus,
    activeBookingReservations,
    bookings,
  } = useDataContext();

  const raw = params?.id;
  const reservationId = raw ? (Array.isArray(raw) ? raw[0] ?? "" : raw) : "";

  React.useEffect(() => {
    if (reservationId) {
      console.log(`[EditPage] Effect triggered for ID: ${reservationId}`);
      loadBookingDetails(reservationId);
    }
  }, [reservationId, loadBookingDetails]);

  const reservation = React.useMemo(() => {
    const found = activeBookingReservations.find((entry) => entry.id === reservationId) ||
                  reservations.find((entry) => entry.id === reservationId) ||
                  bookings.flatMap((b) => b.subRows).find((entry) => entry.id === reservationId);
    console.log(`[EditPage] Finding reservation for ${reservationId}: ${found ? 'Found' : 'Not Found'}`);
    return found;
  }, [reservations, activeBookingReservations, bookings, reservationId]);

  const isActuallyLoading = 
    isLoading || 
    isSessionLoading || 
    isReservationsInitialLoading || 
    isBookingLookupLoading ||
    (reservationId && (!lookupStatus[reservationId] || lookupStatus[reservationId] === 'pending'));

  console.log(`[EditPage] Render state: id=${reservationId}, loading=${isActuallyLoading}, res=${!!reservation}, status=${reservationId ? lookupStatus[reservationId] : 'none'}`);

  if (!reservationId) {
    if (isActuallyLoading) {
      return <ReservationEditSkeleton />;
    }
    return notFound();
  }

  if (isActuallyLoading && !reservation) {
    return <ReservationEditSkeleton />;
  }

  if (!reservation && !isActuallyLoading && lookupStatus[reservationId] === 'error') {
    console.warn(`[EditPage] Reservation not found for ${reservationId}`);
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold">Reservation not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The reservation you are looking for does not exist or has been removed.
        </p>
      </div>
    );
  }

  // Ensure TypeScript knows reservation is defined
  if (!reservation) {
    return <ReservationEditSkeleton />;
  }

  const guest = guests.find((g) => g.id === reservation.guestId);
  const guestName = guest ? `${guest.firstName} ${guest.lastName}` : "Guest";
  const roomNumber = rooms.find((room) => room.id === reservation.roomId)?.roomNumber ?? "N/A";
  const nights = Math.max(
    differenceInDays(parseISO(reservation.checkOutDate), parseISO(reservation.checkInDate)),
    1
  );
  const reservationWithDetails: ReservationWithDetails = {
    ...reservation,
    guestName: guest ? `${guest.firstName} ${guest.lastName}` : "N/A",
    roomNumber,
    nights,
    folio: reservation.folio ?? [],
    numberOfGuests:
      reservation.numberOfGuests ?? reservation.adultCount + reservation.childCount,
    taxEnabledSnapshot: reservation.taxEnabledSnapshot ?? false,
    taxRateSnapshot: reservation.taxRateSnapshot ?? 0,
  };

  const handleCancel = () => {
    router.push(`/admin/reservations/${reservation.id}`);
  };

  const handleSuccess = () => {
    router.replace(`/admin/reservations/${reservation.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/reservations/${reservation.id}`} prefetch={false}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to details
          </Link>
        </Button>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
          {reservation.status}
        </Badge>
      </div>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Editing reservation
        </p>
        <h1 className="text-2xl font-serif font-semibold">{guestName}</h1>
        <p className="text-sm text-muted-foreground">Booking #{reservation.bookingId}</p>
      </div>
      <ReservationEditForm
        reservation={reservationWithDetails}
        onCancel={handleCancel}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

function ReservationEditSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[520px] w-full rounded-2xl lg:col-span-3" />
        <Skeleton className="h-[520px] w-full rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}
