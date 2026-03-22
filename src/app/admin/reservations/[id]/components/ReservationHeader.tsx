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
}

export function ReservationHeader({ reservation, bookingStatus }: ReservationHeaderProps) {
  const { updateReservationStatus, updateBookingReservationStatus, guests, rooms, roomTypes, property, reservations } = useDataContext();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const isNewlyCreated = searchParams?.get("createdBooking") === "1";

  // Get all reservations for this booking
  const bookingReservations = React.useMemo(() => {
    return reservations.filter((r) => r.bookingId === reservation.bookingId);
  }, [reservations, reservation.bookingId]);

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
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-card/80 px-4 py-3 shadow-sm">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50" asChild>
          <Link href="/admin/reservations" prefetch={false}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="flex-1 text-base font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          Reservation Details
        </h1>
        <Badge variant="outline" className="ml-auto rounded-full px-3 py-1 text-xs font-medium sm:ml-0">
          {effectiveStatus}
        </Badge>
        {isNewlyCreated && (
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold text-primary">
            Just created
          </Badge>
        )}
        <div className="hidden items-center gap-2 md:ml-auto md:flex">
          <Button
            variant="outline"
            size="sm"
            disabled={!canBeModified}
            asChild={canBeModified}
          >
            {canBeModified ? (
              <Link href={`/admin/reservations/${reservation.id}/edit`} prefetch={false}>
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
