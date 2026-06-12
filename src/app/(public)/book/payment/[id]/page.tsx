"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Loader2,
  Phone,
  Smartphone,
  TimerReset,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useDataContext } from "@/context/data-context";
import type { PaymentRequest } from "@/data/types";
import {
  createShareablePaymentQrImage,
  downloadDataUrl,
} from "@/lib/payments/payment-qr-client";
import { getPaymentRequestDisplayCode } from "@/lib/payments/payment-request-matching";

// How long the "confirming your payment" animation runs before we surface the
// reception-contact panel. The room is held longer (30 min) and we keep polling
// in the background, so this is purely the on-screen reassurance window.
const TIMER_SECONDS = 5 * 60;
// Each poll triggers a fresh Google Sheet read (the transactions fetch is
// `cache: "no-store"`), so we keep the interval modest. Bank payments surface in
// ~1-2 min, so a 12s cadence still confirms within seconds of the money landing.
const POLL_INTERVAL_MS = 12_000;
const REDIRECT_DELAY_MS = 1_500;

const RECEPTION_PHONES = ["+91 8511151708", "+91 9411109999"];

type PaymentRequestResponse =
  | { status: "confirmed" }
  | { status: "pending"; paymentRequest: PaymentRequest };

type PaymentStatusResponse = {
  status: "pending" | "confirmed" | "expired";
  serverTime: string;
  expiresAt: string | null;
};

type Phase = "loading" | "awaiting" | "timeout" | "confirmed" | "expired" | "error";

function formatExactCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function BookingPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { property } = useDataContext();

  const reservationId = React.useMemo(() => {
    if (!params) return "";
    const value = params.id;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params]);

  const currency = property?.currency || "INR";
  const logoUrl = property?.logo_url || "/logo.png";

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [paymentRequest, setPaymentRequest] =
    React.useState<PaymentRequest | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(TIMER_SECONDS);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const phaseRef = React.useRef<Phase>("loading");
  phaseRef.current = phase;

  // Holds the single in-flight create call so one page visit can never mint two
  // payment requests (React double-invokes effects in dev; re-renders happen).
  const requestPromiseRef = React.useRef<Promise<PaymentRequestResponse> | null>(
    null
  );

  const goToConfirmation = React.useCallback(() => {
    router.push(`/book/confirmation/${reservationId}`);
  }, [router, reservationId]);

  // 1. Create (or fetch) the payment request once on load.
  React.useEffect(() => {
    if (!reservationId) {
      setPhase("error");
      setErrorMessage("This payment link is missing a booking reference.");
      return;
    }

    let active = true;

    // Start the create call once and reuse the same promise across re-renders /
    // React's double-invoked effects, so the booking gets exactly one request.
    if (!requestPromiseRef.current) {
      requestPromiseRef.current = fetch("/api/book/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        return response.json() as Promise<PaymentRequestResponse>;
      });
    }

    requestPromiseRef.current
      .then((data) => {
        if (!active) return;

        if (data.status === "confirmed") {
          setPhase("confirmed");
          window.setTimeout(goToConfirmation, REDIRECT_DELAY_MS);
          return;
        }

        setPaymentRequest(data.paymentRequest);
        setPhase("awaiting");
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to start payment", error);
        requestPromiseRef.current = null; // let a fresh mount retry
        setPhase("error");
        setErrorMessage("We couldn't start your payment. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [reservationId, goToConfirmation]);

  // 2. Build the branded, downloadable QR image once we have the request.
  React.useEffect(() => {
    if (!paymentRequest) return;

    let active = true;
    const siteUrl =
      typeof window !== "undefined" ? window.location.origin : "";

    createShareablePaymentQrImage({
      request: paymentRequest,
      currency,
      logoUrl,
      siteUrl,
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch((error) => {
        console.error("Failed to render QR", error);
      });

    return () => {
      active = false;
    };
  }, [paymentRequest, currency, logoUrl]);

  // 3. Countdown for the on-screen reassurance window.
  React.useEffect(() => {
    if (phase !== "awaiting") return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(intervalId);
          // Keep polling; just switch the screen to the reception panel.
          if (phaseRef.current === "awaiting") {
            setPhase("timeout");
          }
          return 0;
        }
        return previous - 1;
      });
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [phase]);

  // 4. Poll booking status until confirmed or expired (survives the timeout).
  React.useEffect(() => {
    if (!reservationId) return;
    if (phase !== "awaiting" && phase !== "timeout") return;

    let active = true;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/book/payment-status?reservationId=${reservationId}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;

        const data = (await response.json()) as PaymentStatusResponse;
        if (!active) return;

        if (data.status === "confirmed") {
          setPhase("confirmed");
          window.setTimeout(goToConfirmation, REDIRECT_DELAY_MS);
        } else if (data.status === "expired") {
          setPhase("expired");
        }
      } catch (error) {
        // A transient network/sheet hiccup must not break the loop.
        console.error("Payment status check failed", error);
      }
    };

    void poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [reservationId, phase, goToConfirmation]);

  const handleDownload = React.useCallback(() => {
    if (!qrDataUrl || !paymentRequest) return;
    downloadDataUrl(qrDataUrl, `booking-payment-${paymentRequest.identifier}.png`);
  }, [qrDataUrl, paymentRequest]);

  const progressValue = Math.round((secondsLeft / TIMER_SECONDS) * 100);

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Complete your payment
          </h1>
          <p className="mt-2 text-muted-foreground">
            Scan the QR with any UPI app to confirm your booking at{" "}
            {property?.name ?? "our property"}.
          </p>
        </div>

        {phase === "loading" && <CenteredSpinner label="Preparing your payment…" />}

        {phase === "error" && (
          <Card className="mx-auto max-w-lg rounded-2xl border-destructive/30">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <TriangleAlert className="h-10 w-10 text-destructive" />
              <p className="text-base text-foreground">
                {errorMessage ?? "Something went wrong."}
              </p>
              <Button asChild variant="outline">
                <Link href="/book">Back to booking</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "confirmed" && (
          <Card className="mx-auto max-w-lg rounded-2xl border-primary/30">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-14 w-14 text-primary" />
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Payment received!
              </h2>
              <p className="text-muted-foreground">
                Your booking is confirmed. Taking you to your confirmation…
              </p>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {phase === "expired" && (
          <Card className="mx-auto max-w-lg rounded-2xl border-amber-300/60">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <TimerReset className="h-12 w-12 text-amber-600" />
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Your hold has expired
              </h2>
              <p className="text-muted-foreground">
                We didn&apos;t receive the payment in time, so the room was
                released. Please make a new booking — your money was not taken.
              </p>
              <Button asChild>
                <Link href="/book">Book again</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(phase === "awaiting" || phase === "timeout") && paymentRequest && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* QR + pay actions */}
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-2xl">
                  Scan &amp; pay
                </CardTitle>
                <CardDescription>
                  Pay the exact amount shown — it confirms your booking
                  automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex justify-center">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="UPI payment QR code"
                      className="w-full max-w-[320px] rounded-xl border border-border/60"
                    />
                  ) : (
                    <div className="flex h-[320px] w-full max-w-[320px] items-center justify-center rounded-xl border border-dashed border-border/60">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/60 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Amount to pay</p>
                  <p className="text-3xl font-bold text-foreground">
                    {formatExactCurrency(paymentRequest.amount, currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Payment code: {getPaymentRequestDisplayCode(paymentRequest)}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    asChild
                    className="w-full"
                    aria-label="Open a UPI app to pay"
                  >
                    <a href={paymentRequest.upiUri}>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Pay in UPI app
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleDownload}
                    disabled={!qrDataUrl}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  UPI: {paymentRequest.upiId}
                </p>
              </CardContent>
            </Card>

            {/* Status / reassurance */}
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-2xl">
                  {phase === "awaiting"
                    ? "Confirming your payment"
                    : "Still confirming"}
                </CardTitle>
                <CardDescription>
                  {phase === "awaiting"
                    ? "Keep this page open — we confirm automatically the moment your payment arrives."
                    : "This is taking a little longer than usual. We're still watching for your payment."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {phase === "awaiting" ? (
                  <div className="flex flex-col items-center gap-5 py-4">
                    <div className="relative flex h-24 w-24 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20" />
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                    <div className="w-full space-y-2">
                      <Progress value={progressValue} />
                      <p className="text-center text-sm text-muted-foreground">
                        Waiting for confirmation · {formatClock(secondsLeft)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        We&apos;re still checking for your payment in the
                        background.
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Phone className="h-4 w-4 text-primary" />
                        Already paid? Call reception to confirm:
                      </p>
                      <div className="flex flex-col gap-2">
                        {RECEPTION_PHONES.map((phone) => (
                          <a
                            key={phone}
                            href={`tel:${phone.replace(/\s+/g, "")}`}
                            className="rounded-lg border border-border/60 px-4 py-2 text-center font-semibold text-primary hover:bg-primary/5"
                          >
                            {phone}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
