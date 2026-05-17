"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Copy, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import type { ReservationPaymentRequest } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";
import {
  calculateRemainingPaymentAmount,
  buildReservationPaymentIntentLink,
  buildReservationPaymentQrUrl,
  buildReservationPaymentUpiLink,
} from "@/lib/payments/upi";

type PaymentProperty = {
  id: string;
  name: string;
  currency: string;
  upiId?: string;
  upiMerchantName?: string;
};

type PaymentReservationSummary = {
  reservationId: string;
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
};

type ReservationPaymentRequestPayload = {
  request: ReservationPaymentRequest;
  property: PaymentProperty | null;
  reservations: PaymentReservationSummary[];
};

type ApiResponse = {
  data?: ReservationPaymentRequestPayload;
  message?: string;
};

const paymentStatusConfig: Record<
  ReservationPaymentRequest["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  requested: { label: "Requested", variant: "secondary" },
  partially_paid: { label: "Partially paid", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  expired: { label: "Expired", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "—";
  }
  try {
    return format(parseISO(value), "MMM d, yyyy, h:mm a");
  } catch {
    return value;
  }
};

const formatDate = (value?: string) => {
  if (!value) {
    return "—";
  }
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
};

export default function PublicReservationPaymentPage() {
  const params = useParams<{ token: string }>();
  const token = React.useMemo(() => {
    const raw = params?.token;
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  }, [params]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [payload, setPayload] =
    React.useState<ReservationPaymentRequestPayload | null>(null);
  const isAndroid = React.useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /android/i.test(navigator.userAgent);
  }, []);

  React.useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setErrorMessage("Missing payment token.");
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setErrorMessage(null);
    setPayload(null);

    const controller = new AbortController();
    const fetchPaymentRequest = async () => {
      try {
        const response = await fetch(`/api/reservation-payment-requests/${token}`, {
          signal: controller.signal,
        });

        const payloadJson = (await response.json()) as ApiResponse;

        if (!response.ok || !payloadJson.data) {
          throw new Error(
            payloadJson.message ||
              `Unable to load payment request (status ${response.status}).`
          );
        }

        if (isActive) {
          setPayload(payloadJson.data);
        }
      } catch (error) {
        if (!isActive || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load payment request."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void fetchPaymentRequest();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [token]);

  const request = payload?.request;
  const property = payload?.property;
  const reservationSummaries = payload?.reservations ?? [];
  const currency = property?.currency || "INR";
  const remainingAmount = request ? calculateRemainingPaymentAmount(request) : 0;
  const requestedAmount = request?.amount ?? 0;
  const statusInfo = request
    ? paymentStatusConfig[request.status]
    : paymentStatusConfig.requested;
  const upiLink = request && property
    ? buildReservationPaymentUpiLink(
      request,
      {
        upiId: property.upiId || "",
        upiMerchantName: property.upiMerchantName || property.name,
      },
      currency
    )
    : null;
  const canPay =
    (request?.status === "requested" || request?.status === "partially_paid") &&
    remainingAmount > 0 &&
    Boolean(upiLink);
  const qrUrl = upiLink ? buildReservationPaymentQrUrl(upiLink, 260) : "";
  const paymentActionLabel = isAndroid
    ? "Open Android payment app"
    : "Open UPI app";
  const paymentLinkLabel = isAndroid ? "Share intent link" : "UPI deep link";
  const paymentLaunchUrl = React.useMemo(() => {
    if (!property || !request || !upiLink || typeof window === "undefined") {
      return null;
    }

    if (!isAndroid) {
      return upiLink;
    }

    const propertyInfo = {
      upiId: property.upiId || "",
      upiMerchantName: property.upiMerchantName || property.name,
    };
    const fallbackUrl = `${window.location.origin}/pay/${request.token}`;
    return (
      buildReservationPaymentIntentLink(
        request,
        propertyInfo,
        fallbackUrl,
        currency
      ) || upiLink
    );
  }, [property, upiLink, isAndroid, request, currency]);
  const downloadQrCode = React.useCallback(async () => {
    if (!qrUrl || !request) {
      return;
    }

    try {
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error("Failed to download QR code.");
      }
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = imageUrl;
      anchor.download = `${request.token}-payment-qr.png`;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(imageUrl);
      toast.success("QR code downloaded.");
    } catch (error) {
      console.error("Failed to download QR code", error);
      toast.error("Failed to download QR code.");
    }
  }, [qrUrl, request]);

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const openPaymentLink = (link: string, label: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.href = link;
    toast.success(`Opened ${label}.`);
  };

  if (!token) {
    notFound();
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading payment request...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !request || !property) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <p className="text-lg font-semibold text-destructive">
            {errorMessage || "Payment request not found."}
          </p>
          <p className="mt-2 text-sm text-destructive/80">
            Please check the payment link or contact support.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-serif">
                  Reservation payment
                </CardTitle>
                <CardDescription className="mt-1">
                  Pay the remaining amount for {property?.name || "your reservation"}.
                </CardDescription>
              </div>
              <Badge variant={statusInfo.variant}>
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Request Amount:</span>{" "}
                <span className="font-semibold">
                  {formatCurrency(requestedAmount, currency)}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Already Paid:</span>{" "}
                <span className="font-semibold">
                  {formatCurrency(request.paidAmount, currency)}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Remaining Amount:</span>{" "}
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(remainingAmount, currency)}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Request Token:</span>{" "}
                <span className="font-mono text-sm">{request.token}</span>
              </p>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Requested on:</span>{" "}
                {formatDateTime(request.requestedAt)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Reservations:</span>{" "}
                {request.reservationIds.length} reservation
                {request.reservationIds.length === 1 ? "" : "s"}
              </p>
              {request.expiresAt ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Expires:</span>{" "}
                  {formatDateTime(request.expiresAt)}
                </p>
              ) : null}
              {request.paidAt ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Paid on:</span>{" "}
                  {formatDateTime(request.paidAt)}
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Booking and guest details
              </p>
              <div className="space-y-2">
                {reservationSummaries.length > 0 ? (
                  reservationSummaries.map((reservation) => (
                    <div
                      key={reservation.reservationId}
                      className="rounded-xl border border-border/40 bg-muted/20 p-3"
                    >
                      <p className="text-sm">
                        <span className="text-muted-foreground">Reservation:</span>{" "}
                        <span className="font-medium">{reservation.reservationId}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Booking ID:</span>{" "}
                        <span className="font-mono text-xs">{reservation.bookingId}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Guest:</span>{" "}
                        {reservation.guestName}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Check-in:</span>{" "}
                        {formatDate(reservation.checkInDate)}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Check-out:</span>{" "}
                        {formatDate(reservation.checkOutDate)}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {reservation.guestEmail || "Not provided"}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        {reservation.guestPhone || "Not provided"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Guest details are unavailable for this request.
                  </p>
                )}
              </div>
            </div>

            {request.notes ? (
              <p className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                {request.notes}
              </p>
            ) : null}

            <div className="space-y-3">
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">Payment app tip</p>
                <p>
                  {isAndroid
                    ? "On Android, use the UPI button below. If it does not open, copy the link and try again after selecting a UPI app manually."
                    : "On iOS and other devices, some browsers block automatic app launches. If payment does not open, copy the payment link and open it from your preferred UPI app or from your messaging app."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={canPay ? "default" : "outline"}
                  onClick={() => {
                    if (paymentLaunchUrl) {
                      openPaymentLink(paymentLaunchUrl, "UPI app");
                      return;
                    }
                    toast.error("UPI payment link is not available.");
                  }}
                  disabled={!canPay}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  {canPay ? paymentActionLabel : "Unavailable"}
                </Button>
                {upiLink ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      void copyToClipboard(upiLink, "UPI link");
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy {paymentLinkLabel}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (qrUrl) {
                      void downloadQrCode();
                    }
                  }}
                  disabled={!qrUrl}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Download QR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (typeof window === "undefined") {
                      return;
                    }
                    void copyToClipboard(
                      `${window.location.origin}/pay/${request.token}`,
                      "Payment page link"
                    );
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy payment page link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void copyToClipboard(request.token, "Request token");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy request token
                </Button>
                <Button asChild variant="outline">
                  <Link href="/" className="no-underline">
                    Back home
                  </Link>
                </Button>
              </div>

              {upiLink ? (
                <div className="rounded-lg border border-border/60 bg-white p-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Scan to pay. If your banking app does not open, copy the link and paste it manually.
                  </p>
                  <img
                    src={qrUrl}
                    alt={`UPI QR code for request ${request.token}`}
                    className="h-56 w-56 rounded-lg"
                  />
                </div>
              ) : (
                <p className="rounded-lg border border-amber-300/80 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
                  UPI is not available for this property at the moment.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
