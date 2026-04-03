"use client";

import * as React from "react";
import { useParams, notFound } from "next/navigation";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  CheckCircle2,
  Globe,
  Hash,
  MapPin,
  Phone,
  Mail,
  User,
  BedDouble,
  CalendarDays,
  IndianRupee,
  Copy,
  Info,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useDataContext } from "@/context/data-context";
import { getGuestById, getReservationById } from "@/lib/api";
import type { Guest, Reservation, RoomType } from "@/data/types";
import { calculateReservationTaxAmount } from "@/lib/reservations/calculate-financials";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { InlineAlert } from "@/components/public/inline-alert";
import { InvoiceDownloadButton } from "@/components/shared/invoice-download-button";

export default function BookingConfirmationPage() {
  const params = useParams<{ id: string }>();
  const reservationIdFromParams = React.useMemo(() => {
    if (!params) return "";
    const value = params.id;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params]);
  const { property, reservations, guests, rooms, roomTypes, ratePlans } =
    useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const [reservationData, setReservationData] =
    React.useState<Reservation | null>(null);
  const [guestData, setGuestData] = React.useState<Guest | null>(null);
  const [isLoadingReservation, setIsLoadingReservation] = React.useState(false);
  const [isLoadingGuest, setIsLoadingGuest] = React.useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = React.useState(false);

  const reservation =
    reservationData ||
    reservations.find((r) => r.id === reservationIdFromParams);
  const guestFromContext = reservation
    ? guests.find((g) => g.id === reservation.guestId)
    : undefined;
  const guest = guestData || guestFromContext;

  // Derive all reservations that belong to the same booking
  const bookingReservations = React.useMemo(() => {
    if (!reservation) return [] as Reservation[];
    const grouped = reservations.filter(
      (r) => r.bookingId === reservation.bookingId
    );
    if (grouped.length > 0) {
      return grouped;
    }
    return [reservation];
  }, [reservation, reservations]);

  // Group booked rooms by room type for display
  type ConfirmedRoomSummary = {
    roomType: RoomType;
    quantity: number;
    guestCount: number;
    totalAmount: number;
  };

  const confirmedRoomSummaries: ConfirmedRoomSummary[] = React.useMemo(() => {
    if (bookingReservations.length === 0) return [];

    const byRoomType = new Map<string, ConfirmedRoomSummary>();

    for (const res of bookingReservations) {
      const room = rooms.find((roomItem) => roomItem.id === res.roomId);
      if (!room) continue;
      const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
      if (!roomType) continue;

      const existing = byRoomType.get(roomType.id);
      if (existing) {
        existing.quantity += 1;
        existing.guestCount += res.numberOfGuests;
        existing.totalAmount += res.totalAmount;
      } else {
        byRoomType.set(roomType.id, {
          roomType,
          quantity: 1,
          guestCount: res.numberOfGuests,
          totalAmount: res.totalAmount,
        });
      }
    }

    return Array.from(byRoomType.values());
  }, [bookingReservations, rooms, roomTypes]);

  const totalRooms = React.useMemo(
    () => confirmedRoomSummaries.reduce((sum, item) => sum + item.quantity, 0),
    [confirmedRoomSummaries]
  );

  const guestBreakdown = React.useMemo(() => {
    if (bookingReservations.length === 0) {
      return { adults: 0, children: 0, total: 0 };
    }

    const sums = bookingReservations.reduce(
      (acc, entry) => {
        acc.adults += entry.adultCount ?? 0;
        acc.children += entry.childCount ?? 0;
        return acc;
      },
      { adults: 0, children: 0 }
    );

    return {
      adults: sums.adults,
      children: sums.children,
      total: sums.adults + sums.children,
    };
  }, [bookingReservations]);

  const primaryRoomType = React.useMemo(() => {
    if (confirmedRoomSummaries.length > 0) {
      return confirmedRoomSummaries[0].roomType;
    }

    if (reservation) {
      const room = rooms.find((roomItem) => roomItem.id === reservation.roomId);
      if (room) {
        return roomTypes.find((rt) => rt.id === room.roomTypeId) ?? null;
      }
    }

    return null;
  }, [confirmedRoomSummaries, reservation, rooms, roomTypes]);

  // Calculate nights based on the reservation dates
  const nights = reservation
    ? differenceInDays(
      parseISO(reservation.checkOutDate),
      parseISO(reservation.checkInDate)
    )
    : 0;

  // Determine the rate plan used for this booking
  const bookingRatePlan = React.useMemo(() => {
    if (bookingReservations.length === 0) return null;
    const ratePlanId = bookingReservations[0].ratePlanId;
    return ratePlans.find((rp) => rp.id === ratePlanId) ?? null;
  }, [bookingReservations, ratePlans]);

  const roomLineItems = React.useMemo(
    () =>
      confirmedRoomSummaries.map((item) => {
        return {
          id: item.roomType.id,
          name: item.roomType.name,
          quantity: item.quantity,
          nights,
          lineBase: item.totalAmount,
        };
      }),
    [confirmedRoomSummaries, nights]
  );

  const bookingTotals = React.useMemo(() => {
    if (bookingReservations.length === 0) {
      return {
        baseTotal: 0,
        taxesTotal: 0,
        grandTotal: 0,
        taxesApplied: false,
        taxRatePercent: null as number | null,
      };
    }

    const baseTotal = bookingReservations.reduce(
      (sum, resItem) => sum + resItem.totalAmount,
      0
    );
    const taxesTotal = bookingReservations.reduce(
      (sum, resItem) => sum + calculateReservationTaxAmount(resItem, property),
      0
    );
    const enabledRates = bookingReservations
      .map((resItem) =>
        resItem.taxEnabledSnapshot ? resItem.taxRateSnapshot ?? 0 : 0
      )
      .filter((rate) => rate > 0);
    const uniqueRates = new Set(enabledRates.map((rate) => rate.toFixed(4)));
    const taxRatePercent =
      uniqueRates.size === 1 && enabledRates.length > 0
        ? enabledRates[0] * 100
        : null;

    return {
      baseTotal,
      taxesTotal,
      grandTotal: baseTotal + taxesTotal,
      taxesApplied: taxesTotal > 0,
      taxRatePercent,
    };
  }, [bookingReservations, property]);

  const formattedTaxRate = React.useMemo(() => {
    if (typeof bookingTotals.taxRatePercent !== "number") {
      return null;
    }
    return bookingTotals.taxRatePercent.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: bookingTotals.taxRatePercent % 1 === 0 ? 0 : 2,
    });
  }, [bookingTotals.taxRatePercent]);

  // Fetch reservation directly if not in context
  React.useEffect(() => {
    if (
      reservationIdFromParams &&
      !reservation &&
      !reservationData &&
      !isLoadingReservation &&
      !hasAttemptedFetch
    ) {
      setIsLoadingReservation(true);
      setHasAttemptedFetch(true);
      getReservationById(reservationIdFromParams)
        .then(({ data }) => {
          if (data) {
            setReservationData(data);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch reservation:", error);
        })
        .finally(() => {
          setIsLoadingReservation(false);
        });
    }
  }, [
    reservationIdFromParams,
    reservation,
    reservationData,
    isLoadingReservation,
    hasAttemptedFetch,
  ]);

  // Always refresh guest data to reflect the latest contact information from Supabase
  React.useEffect(() => {
    const guestId = reservation?.guestId;
    if (!guestId) {
      return;
    }

    let isActive = true;
    setIsLoadingGuest(true);

    getGuestById(guestId)
      .then(({ data }) => {
        if (isActive && data) {
          setGuestData(data);
        }
      })
      .catch((error) => {
        if (isActive) {
          console.error("Failed to fetch guest:", error);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingGuest(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [reservation?.guestId]);

  // Show loading state while fetching data
  if (isLoadingReservation || (!reservation && !hasAttemptedFetch)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            Loading your reservation...
          </p>
        </div>
      </div>
    );
  }

  if (!reservation && hasAttemptedFetch && !isLoadingReservation) {
    return notFound();
  }

  // Ensure reservation exists before proceeding
  if (!reservation) {
    return null; // This should not happen due to the check above
  }

  const fullGuestName = guest
    ? [guest.firstName, guest.lastName].filter(Boolean).join(" ").trim()
    : "";
  const displayGuestName = fullGuestName || guest?.firstName || "Guest";
  const formattedBookingDateTime = reservation.bookingDate
    ? format(parseISO(reservation.bookingDate), "EEE, dd MMM yyyy · h:mm a")
    : null;

  const customerDetails = {
    fullName: displayGuestName,
    email: guest?.email ?? null,
    phone: guest?.phone ?? null,
    address: guest?.address ?? null,
    pincode: guest?.pincode ?? null,
    city: guest?.city ?? null,
    country: guest?.country ?? null,
    bookingTimestamp: formattedBookingDateTime,
  };

  const copyToClipboard = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="bg-muted/40 min-h-screen">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-primary/10 via-background to-background p-8 text-center shadow-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.4em] text-primary/80">
                Reservation confirmed
              </p>
              <h1 className="mt-3 text-4xl font-serif font-bold text-foreground">
                Your stay is ready at {property.name}
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">
                Thanks, {customerDetails.fullName}. We&apos;ve secured your
                rooms and our team is preparing to welcome you.
              </p>
              <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Reservation ID
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {reservation.id}
                </span>
              </div>
              <div className="mx-auto mt-8 max-w-5xl">
                {/* Payment confirmation call and Notes: */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 text-left">
                  {/* English Info Card */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                    <h3 className="mb-4 font-serif text-xl font-semibold text-foreground flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Important Information
                    </h3>
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        Check-In Time: 12:00 PM - Checkout Time: 10:00 AM
                      </div>
                      <p className="leading-relaxed">
                        <strong className="font-semibold text-foreground">Notes:</strong> This ashram is Gujarati. Food is served here in a Gujarati style. Meals are complimentary. This is an ashram. Here you must have to wash your own plates.
                      </p>
                      <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                        <p className="font-medium leading-snug">
                          Without donation/confirmation receipt, booking will not be considered valid.
                        </p>
                      </div>
                      <p className="border-t border-primary/10 pt-4">
                        Our team will contact you shortly to confirm the payment. If you do not receive a call from our side within 30 minutes, you are requested to contact the booking representative at <a href="tel:+918511151708" className="whitespace-nowrap font-bold text-primary hover:underline">+91 8511151708</a> or <a href="tel:+919411109999" className="whitespace-nowrap font-bold text-primary hover:underline">+91 9411109999</a>.
                      </p>
                    </div>
                  </div>

                  {/* Hindi Info Card */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                    <h3 className="mb-4 font-serif text-xl font-semibold text-foreground flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      महत्वपूर्ण जानकारी
                    </h3>
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        चेक-इन समय: दोपहर 12:00 बजे - चेक-आउट: सुबह 10:00 बजे
                      </div>
                      <p className="leading-relaxed">
                        <strong className="font-semibold text-foreground">नोट्स:</strong> यह एक गुजराती आश्रम है। यहाँ गुजराती शैली में भोजन परोसा जाता है। भोजन निःशुल्क है। यह एक आश्रम है, इसलिए यहाँ आपको अपनी प्लेटें स्वयं धोनी होंगी।
                      </p>
                      <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                        <p className="font-medium leading-snug">
                          दान/पुष्टिकरण रसीद के बिना बुकिंग मान्य नहीं मानी जाएगी।
                        </p>
                      </div>
                      <p className="border-t border-primary/10 pt-4">
                        हमारी टीम भुगतान की पुष्टि करने के लिए आपसे शीघ्र ही संपर्क करेगी। यदि आपको 30 मिनट के भीतर हमारी ओर से कोई कॉल प्राप्त नहीं होती है, तो आपसे अनुरोध है कि बुकिंग प्रतिनिधि से <a href="tel:+918511151708" className="whitespace-nowrap font-bold text-primary hover:underline">+91 8511151708</a> या <a href="tel:+919411109999" className="whitespace-nowrap font-bold text-primary hover:underline">+91 9411109999</a> पर संपर्क करें।
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Left column: Guest + Reservation Details */}
            <div className="space-y-6">
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">
                    Guest details
                  </CardTitle>
                  <CardDescription>
                    We&apos;ll reach you on these contacts if we need anything
                    before arrival.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Guest name
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {customerDetails.fullName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-base font-medium text-foreground break-all">
                        {customerDetails.email ?? "Not provided"}
                      </p>
                    </div>
                    {customerDetails.email ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-2 h-7 w-7"
                        aria-label="Copy email address"
                        onClick={() =>
                          copyToClipboard(
                            customerDetails.email ?? "",
                            "Email address"
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Mobile number
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {customerDetails.phone ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="text-base font-medium text-foreground break-words">
                        {customerDetails.address ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Country</p>
                      <p className="text-base font-medium text-foreground">
                        {customerDetails.country ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">City</p>
                      <p className="text-base font-medium text-foreground">
                        {customerDetails.city ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pincode</p>
                      <p className="text-base font-medium text-foreground">
                        {customerDetails.pincode ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Booked on</p>
                      <p className="text-base font-medium text-foreground">
                        {customerDetails.bookingTimestamp ?? "Not available"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground font-serif text-2xl">
                    Your reservation
                  </CardTitle>
                  <CardDescription className="flex flex-col gap-2 pt-1 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2 text-foreground">
                      <span>Reservation ID: {reservation.id}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Copy reservation ID"
                        onClick={() =>
                          copyToClipboard(reservation.id, "Reservation ID")
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <span>
                      Everything about your rooms, dates, and price in one
                      glance.
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {confirmedRoomSummaries.length > 0 && (
                      <div className="space-y-3">
                        {confirmedRoomSummaries.map((item) => {
                          const capacityPerRoom = item.roomType.maxOccupancy;

                          return (
                            <div
                              key={item.roomType.id}
                              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3"
                            >
                              <div className="relative h-16 w-24 overflow-hidden rounded flex-shrink-0">
                                <img
                                  src={
                                    item.roomType.mainPhotoUrl ||
                                    item.roomType.photos?.[0] ||
                                    "/room-placeholder.svg"
                                  }
                                  alt={item.roomType.name}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-base font-medium leading-tight">
                                  {item.roomType.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  x{item.quantity} room
                                  {item.quantity === 1 ? "" : "s"}
                                  {capacityPerRoom
                                    ? ` · up to ${capacityPerRoom} guest${capacityPerRoom === 1 ? "" : "s"
                                    } per room`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                      <span>
                        Total: {totalRooms} room{totalRooms === 1 ? "" : "s"}
                      </span>
                      <span>
                        · {guestBreakdown.total} guest
                        {guestBreakdown.total === 1 ? "" : "s"}
                        {guestBreakdown.total > 0 && (
                          <>
                            {" "}
                            ({guestBreakdown.adults} adult
                            {guestBreakdown.adults === 1 ? "" : "s"}
                            {guestBreakdown.children > 0 && (
                              <>
                                {", "}
                                {guestBreakdown.children} child
                                {guestBreakdown.children === 1 ? "" : "ren"}
                              </>
                            )}
                            )
                          </>
                        )}
                      </span>
                      <span>
                        · {nights} night{nights === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <Separator className="my-6" />
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Check-in
                      </h4>
                      <p className="text-lg font-medium">
                        {format(
                          parseISO(reservation.checkInDate),
                          "E, MMM d, yyyy"
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        From 12:00 PM
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Check-out
                      </h4>
                      <p className="text-lg font-medium">
                        {format(
                          parseISO(reservation.checkOutDate),
                          "E, MMM d, yyyy"
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        before 10:00 AM
                      </p>
                    </div>
                  </div>
                  <Separator className="my-6" />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-primary" />
                      Your total price
                    </h4>
                    <div className="space-y-3 text-sm">
                      {roomLineItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-xs sm:text-sm"
                        >
                          <span>
                            {item.name} · x{item.quantity} room
                            {item.quantity === 1 ? "" : "s"} · {item.nights}{" "}
                            night
                            {item.nights === 1 ? "" : "s"}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(Math.round(item.lineBase))}
                          </span>
                        </div>
                      ))}

                      <Separator className="my-2" />

                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">
                          {bookingTotals.taxesApplied
                            ? "Total (before tax)"
                            : "Subtotal"}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(Math.round(bookingTotals.baseTotal))}
                        </span>
                      </div>
                      {bookingTotals.taxesApplied && (
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">
                            Taxes &amp; fees
                            {formattedTaxRate && (
                              <span> ({formattedTaxRate}%)</span>
                            )}
                          </span>
                          <span className="font-semibold">
                            {formatCurrency(
                              Math.round(bookingTotals.taxesTotal)
                            )}
                          </span>
                        </div>
                      )}

                      <Separator className="my-2" />

                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total</span>
                        <span>
                          {formatCurrency(Math.round(bookingTotals.grandTotal))}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column: Hotel Info & What's Next */}
            <div>
              <Card className="flex h-full flex-col rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground font-serif text-2xl">
                    Hotel information
                  </CardTitle>
                  <CardDescription>
                    Everything you need to reach us with ease.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-base font-semibold text-foreground">
                    SAHAJANAND WELLNESS
                  </p>
                  <div className="flex items-start gap-3 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      Gali No.13, Shisham Jhadi, Muni Ki Reti, Near Ganga Kinare, Rishikesh, Uttarakhand, Pin Code: 249201
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a
                      href={`tel:${property.phone}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {property.phone}
                    </a>
                  </div>
                  <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border">
                    <iframe
                      src={property.google_maps_url}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Hotel location map"
                    ></iframe>
                  </div>
                </CardContent>
                <Separator className="my-4" />
                <CardHeader className="pt-0">
                  <CardTitle className="text-foreground font-serif text-2xl">
                    What&apos;s next?
                  </CardTitle>
                  <CardDescription>
                    Simple steps before you arrive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ol className="space-y-4 text-sm">
                    <li className="flex gap-4">
                      <div className="flex h-10 w-10 items-center flex-shrink-0 justify-center rounded-full bg-primary/10 text-primary">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Reception call for payment
                        </p>
                        <p className="text-muted-foreground">
                          Our reception team will call shortly to complete your
                          UPI transaction and answer any final questions.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="flex h-10 w-10 items-center flex-shrink-0 justify-center rounded-full bg-primary/10 text-primary">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Check your inbox
                        </p>
                        <p className="text-muted-foreground">
                          We sent your confirmation to{" "}
                          {customerDetails.email ?? "your email"}. Save it for
                          quick reference at check-in.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="flex h-10 w-10 items-center flex-shrink-0 justify-center rounded-full bg-primary/10 text-primary">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Plan your arrival
                        </p>
                        <p className="text-muted-foreground">
                          Check-in starts at 12:00 PM; consider your travel time
                          so we can welcome you without delay.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="flex h-10 w-10 items-center flex-shrink-0 justify-center rounded-full bg-primary/10 text-primary">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Need directions?
                        </p>
                        <p className="text-muted-foreground">
                          Use the map above or tap our phone number if you need
                          live guidance from the property.
                        </p>
                      </div>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <InvoiceDownloadButton
              reservations={bookingReservations}
              guest={guest}
              property={property}
              rooms={rooms}
              roomTypes={roomTypes}
              variant="outline"
              size="lg"
              className="h-12 px-10 rounded-lg w-full sm:w-auto"
            />
            <Button asChild size="lg" className="h-12 px-10 rounded-lg w-full sm:w-auto">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
