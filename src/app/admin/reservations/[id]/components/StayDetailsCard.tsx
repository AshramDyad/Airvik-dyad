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
import type { RatePlan } from "@/data/types";
import {
  DEFAULT_BOOKING_ID_FALLBACK,
  formatBookingCode,
} from "@/lib/reservations/formatting";

interface StayDetailsCardProps {
  reservation: ReservationWithDetails;
  ratePlans: RatePlan[];
}

export function StayDetailsCard({ reservation, ratePlans }: StayDetailsCardProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>Stay Details</CardTitle>
        <CardDescription>
          Information about the guest&apos;s stay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-3 text-base">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">
            {format(parseISO(reservation.checkInDate), "MMM d, yyyy")}
          </span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="font-semibold">
            {format(parseISO(reservation.checkOutDate), "MMM d, yyyy")}
          </span>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span>{reservation.nights} nights</span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              {reservation.numberOfGuests} guests ({reservation.adultCount} adults · {reservation.childCount} children)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            <span>{ratePlanLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>{reservation.paymentMethod || "Payment on file"}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div className="flex items-center gap-3">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span>
                Booking ID: <span className="font-mono text-xs">{bookingIdLabel}</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
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
            <div>
              <h4 className="mb-2 font-serif text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Guest Notes
              </h4>
              <p className="whitespace-pre-wrap text-muted-foreground">{reservation.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
