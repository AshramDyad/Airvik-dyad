"use client";

import { format, parseISO } from "date-fns";
import {
  BedDouble,
  CalendarDays,
  Moon,
  Users,
  CreditCard,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import { useDataContext } from "@/context/data-context";
import {
  DEFAULT_BOOKING_ID_FALLBACK,
  formatBookingCode,
} from "@/lib/reservations/formatting";

interface StayDetailsCardProps {
  reservation: ReservationWithDetails;
}

export function StayDetailsCard({ reservation }: StayDetailsCardProps) {
  const { ratePlans } = useDataContext();
  const ratePlan = reservation.ratePlanId
    ? ratePlans.find((rp) => rp.id === reservation.ratePlanId)
    : null;
  const ratePlanLabel = ratePlan
    ? ratePlan.name
    : reservation.externalSource === "vikbooking"
    ? "Imported from VikBooking"
    : "Not assigned";

  const bookingIdLabel = formatBookingCode(reservation.bookingId);
  const canCopyBookingId = bookingIdLabel !== DEFAULT_BOOKING_ID_FALLBACK;
  const handleCopyBookingId = async (): Promise<void> => {
    if (!canCopyBookingId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(bookingIdLabel);
      toast.success("Booking ID copied.");
    } catch {
      toast.error("Failed to copy Booking ID.");
    }
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Stay Details</CardTitle>
        <CardDescription>
          Information about the guest&apos;s stay.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5 text-sm">
        <div className="flex min-w-0 items-start gap-3 text-base">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap font-semibold">
              {format(parseISO(reservation.checkInDate), "MMM d, yyyy")}
            </span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="whitespace-nowrap font-semibold">
              {format(parseISO(reservation.checkOutDate), "MMM d, yyyy")}
            </span>
          </div>
        </div>
        <Separator />
        <div className="grid min-w-0 gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Moon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{reservation.nights} nights</span>
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">
              {reservation.numberOfGuests} guests ({reservation.adultCount} adults · {reservation.childCount} children)
            </span>
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{ratePlanLabel}</span>
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">
              {reservation.paymentMethod || "Payment on file"}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">
                Booking ID:{" "}
                <span className="font-mono text-xs">{bookingIdLabel}</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="self-start"
              onClick={() => {
                void handleCopyBookingId();
              }}
              disabled={!canCopyBookingId}
            >
              Copy
            </Button>
          </div>
        </div>
        {reservation.notes?.trim() && (
          <>
            <Separator />
            <div className="min-w-0">
              <h4 className="mb-2 font-serif text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Guest Notes
              </h4>
              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                {reservation.notes}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
