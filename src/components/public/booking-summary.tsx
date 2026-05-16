"use client";

import { useRouter } from "next/navigation";
import { X, Trash2, IndianRupee } from "lucide-react";
import { differenceInDays, format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RatePlan, RoomType, SeasonalPrice } from "@/data/types";
import type { EnhancedBookingSearchFormValues } from "./booking-widget";
import { useDataContext } from "@/context/data-context";
import { calculateMultipleRoomPricing } from "@/lib/pricing-calculator";
import { useCurrencyFormatter } from "@/hooks/use-currency";

interface BookingSummaryProps {
  selection: RoomType[];
  searchValues: EnhancedBookingSearchFormValues;
  ratePlan: RatePlan | null;
  seasonalPrices: SeasonalPrice[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

export function BookingSummary({
  selection,
  searchValues,
  ratePlan,
  seasonalPrices,
  onRemove,
  onClear,
}: BookingSummaryProps) {
  const router = useRouter();
  const { property } = useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const { dateRange } = searchValues;
  const requestedRooms = searchValues.roomOccupancies.length;

  if (selection.length === 0 || !dateRange?.from || !dateRange?.to) {
    return null;
  }

  const nights = differenceInDays(dateRange.to, dateRange.from);
  const taxConfig = {
    enabled: Boolean(property.tax_enabled),
    percentage: property.tax_percentage ?? 0,
  };
  
  const checkInDate = format(dateRange.from!, "yyyy-MM-dd");

  // Use shared pricing calculation utility
  const pricing = calculateMultipleRoomPricing({
    roomTypes: selection,
    ratePlan,
    nights,
    taxConfig,
    seasonalPrices,
    checkInDate,
  });
  
  const { totalCost, taxesAndFees, grandTotal, taxesApplied, taxRatePercent } = pricing;
  const formattedTaxRate = taxRatePercent.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: taxRatePercent % 1 === 0 ? 0 : 2,
  });
  
  // Calculate individual room costs for display
  const individualRoomCosts = selection.map((roomType) => {
    const roomPricing = calculateMultipleRoomPricing({
      roomTypes: [roomType],
      ratePlan,
      nights,
      seasonalPrices,
      checkInDate,
    });
    return roomPricing.totalCost;
  });

  const handleProceed = () => {
    const adults = searchValues.roomOccupancies.reduce(
      (sum, room) => sum + room.adults,
      0,
    );
    const children = searchValues.roomOccupancies.reduce(
      (sum, room) => sum + room.children,
      0,
    );
    const totalGuests = adults + children;
    const rooms = selection.length;
    
    const query = new URLSearchParams();
    selection.forEach((rt) => query.append("roomTypeId", rt.id));
    query.set("from", format(dateRange.from!, "yyyy-MM-dd"));
    query.set("to", format(dateRange.to!, "yyyy-MM-dd"));
    query.set("guests", totalGuests.toString());
    query.set("children", children.toString());
    query.set("rooms", rooms.toString());

    router.push(`/book/review?${query.toString()}`);
  };

  const totalGuests = searchValues.roomOccupancies.reduce(
    (sum, room) => sum + room.adults + room.children,
    0,
  );

  const totalSelectedCapacity = selection.reduce(
    (sum, roomType) => sum + roomType.maxOccupancy,
    0,
  );

  const hasSelection = selection.length > 0;
  const coversGuests = totalSelectedCapacity >= totalGuests;
  const canProceed = hasSelection && coversGuests;

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-sm z-50">
      <Card className="shadow-2xl bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex justify-between items-center text-foreground font-serif">
            <span>Your Booking</span>
            <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear booking">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
            {selection.map((roomType, index) => (
              <div
                key={`${roomType.id}-${index}`}
                className="flex justify-between items-center text-sm"
              >
                <span>{roomType.name}</span>
                <div className="flex items-center gap-2">
                  <span>{formatCurrency(individualRoomCosts[index])}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${roomType.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="text-sm">
            <p>
              Selected: {selection.length} room
              {selection.length === 1 ? "" : "s"}
              {requestedRooms > 0 && (
                <>
                  {" "}
                  (you requested {requestedRooms} room
                  {requestedRooms === 1 ? "" : "s"})
                </>
              )}
            </p>
            <p>
              Capacity: {totalSelectedCapacity} guest
              {totalSelectedCapacity === 1 ? "" : "s"} for {totalGuests} guest
              {totalGuests === 1 ? "" : "s"}
            </p>
            {!coversGuests && hasSelection && (
              <p className="mt-1 text-xs text-destructive">
                Selected rooms do not yet cover all guests. Add more rooms so
                the total capacity is at least {totalGuests} guest
                {totalGuests === 1 ? "" : "s"} to continue.
              </p>
            )}
            <p>{nights} night(s)</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(totalCost)}</span>
            </div>
            {taxesApplied && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxes &amp; fees ({formattedTaxRate}%)</span>
                <span className="text-foreground">{formatCurrency(taxesAndFees)}</span>
              </div>
            )}
          </div>
          <Separator />
          <div className="flex justify-between items-center font-bold text-lg">
            <span>Grand Total</span>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-5 w-5" aria-hidden="true" />
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleProceed}
            disabled={!canProceed}
          >
            {canProceed
              ? "Proceed to Book"
              : "Select enough rooms to cover all guests"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
