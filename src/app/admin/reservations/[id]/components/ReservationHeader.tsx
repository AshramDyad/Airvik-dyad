"use client";

import { ArrowLeft, LogIn, LogOut, XCircle, Edit } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataContext } from "@/context/data-context";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import type { ReservationStatus } from "@/data/types";
import { CancelReservationDialog } from "@/app/admin/reservations/components/cancel-reservation-dialog";
import { InvoiceDownloadButton } from "@/components/shared/invoice-download-button";
import { SendInvoiceWhatsAppButton } from "@/components/shared/send-invoice-whatsapp-button";
import * as React from "react";

interface ReservationHeaderProps {
  reservation: ReservationWithDetails;
  bookingStatus?: ReservationStatus;
  bookingReservations?: ReservationWithDetails[];
}

export function ReservationHeader({
  reservation,
  bookingStatus,
  bookingReservations: resolvedBookingReservations,
}: ReservationHeaderProps) {
  const { updateReservationStatus, updateBookingReservationStatus, guests, rooms, roomTypes, property, reservations } = useDataContext();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const isNewlyCreated = searchParams?.get("createdBooking") === "1";

  // Get all reservations for this booking
  const bookingReservations = React.useMemo(() => {
    if (resolvedBookingReservations && resolvedBookingReservations.length > 0) {
      return resolvedBookingReservations;
    }

    return reservations.filter((r) => r.bookingId === reservation.bookingId);
  }, [reservation.bookingId, reservations, resolvedBookingReservations]);

  // Get guest for this reservation
  const guest = React.useMemo(() => {
    return guests.find((g) => g.id === reservation.guestId);
  }, [guests, reservation.guestId]);

  const handleStatusUpdate = async (
    status: "Checked-in" | "Checked-out" | "Cancelled"
  ) => {
    if (status === "Cancelled") {
      await updateBookingReservationStatus(reservation.bookingId, "Cancelled");
      toast.success("All rooms for this booking have been cancelled.");
      setIsCancelDialogOpen(false);
      return;
    }

    await updateReservationStatus(reservation.id, status);
    toast.success(`Reservation status updated to ${status}.`);
  };

  const effectiveStatus = bookingStatus ?? reservation.status;

  const canBeModified = !["Checked-out", "Cancelled", "No-show"].includes(
    reservation.status
  );
  const canBeCancelled = !["Cancelled", "Checked-out", "No-show"].includes(
    reservation.status
  );
  const canBeCheckedIn = reservation.status === "Confirmed";
  const canBeCheckedOut = reservation.status === "Checked-in";

  return (
    <>
      <div className="mb-6 min-w-0 rounded-2xl border border-border/40 bg-card/80 px-4 py-3 shadow-sm">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl border-border/50"
              asChild
            >
              <Link href="/admin/reservations">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <h1 className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Reservation Details
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Badge
              variant="outline"
              className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium"
            >
              {effectiveStatus}
            </Badge>
            {isNewlyCreated && (
              <Badge
                variant="secondary"
                className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-primary"
              >
                Just created
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!canBeModified}
            asChild={canBeModified}
          >
            {canBeModified ? (
              <Link href={`/admin/reservations/${reservation.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </>
            )}
          </Button>
          <InvoiceDownloadButton
            reservations={bookingReservations}
            guest={guest}
            property={property}
            rooms={rooms}
            roomTypes={roomTypes}
            invoiceType="invoice"
            variant="outline"
            size="sm"
            className="shrink-0"
          />
          <SendInvoiceWhatsAppButton
            reservations={bookingReservations}
            guest={guest}
            property={property}
            rooms={rooms}
            roomTypes={roomTypes}
            variant="outline"
            size="sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void handleStatusUpdate("Checked-in");
            }}
            disabled={!canBeCheckedIn}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Check-in
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void handleStatusUpdate("Checked-out");
            }}
            disabled={!canBeCheckedOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Check-out
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setIsCancelDialogOpen(true)}
            disabled={!canBeCancelled}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
      <CancelReservationDialog
        isOpen={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        onConfirm={() => {
          void handleStatusUpdate("Cancelled");
        }}
      />
    </>
  );
}
