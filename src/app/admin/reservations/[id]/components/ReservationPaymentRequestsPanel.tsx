"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataContext } from "@/context/data-context";
import { useAuthContext } from "@/context/auth-context";
import type { Guest, PaymentRequest, PaymentRequestStatus } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { validateReservationPaymentAmount } from "@/lib/payments/reservation-payment-policy";
import { getPaymentRequestCode } from "@/lib/payments/payment-request-matching";
import {
  createPaymentQrBlob,
  createShareablePaymentQrImage,
  downloadDataUrl,
} from "@/lib/payments/payment-qr-client";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_MS = 60_000;
const EMPTY_REQUESTS: PaymentRequest[] = [];

type ReservationPaymentRequestsPanelProps = {
  reservationId: string;
  guest: Guest | null | undefined;
  balanceDue: number;
  currency: string;
  logoUrl: string;
};

export function ReservationPaymentRequestsPanel({
  reservationId,
  guest,
  balanceDue,
  currency,
  logoUrl,
}: ReservationPaymentRequestsPanelProps) {
  const { refreshReservations, loadBookingDetails } = useDataContext();
  const { hasPermission } = useAuthContext();
  const [amount, setAmount] = React.useState("");
  const [overrideAmount, setOverrideAmount] = React.useState("");
  const [overrideReference, setOverrideReference] = React.useState("");
  const [overrideReason, setOverrideReason] = React.useState("");
  const [requests, setRequests] = React.useState<PaymentRequest[]>(EMPTY_REQUESTS);
  const [activeRequest, setActiveRequest] = React.useState<PaymentRequest | null>(null);
  const [siteUrl, setSiteUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = React.useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = React.useState(false);
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = React.useState<string | null>(null);
  const [isPreparingQr, setIsPreparingQr] = React.useState(false);
  const [isSendingQr, setIsSendingQr] = React.useState(false);
  const [isOverriding, setIsOverriding] = React.useState(false);
  const requestsRef = React.useRef<PaymentRequest[]>(EMPTY_REQUESTS);

  const defaultAmount = Math.max(balanceDue, 0);
  const canOverridePayment = hasPermission("update:payment");

  React.useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  React.useEffect(() => {
    setSiteUrl(window.location.origin);
  }, []);

  React.useEffect(() => {
    if (amount.trim()) {
      return;
    }

    if (defaultAmount > 0) {
      setAmount(defaultAmount.toFixed(2));
      setOverrideAmount(defaultAmount.toFixed(2));
    }
  }, [amount, defaultAmount]);

  const loadRequests = React.useCallback(
    async (sync = false) => {
      setIsRefreshing(true);
      try {
        const params = new URLSearchParams({ reservationId });
        if (sync) {
          params.set("sync", "1");
        }

        const response = await authorizedFetch(
          `/api/admin/payment-requests?${params.toString()}`,
          { cache: "no-store" }
        );
        const body: unknown = await response.json();

        if (!response.ok) {
          throw new Error(readMessage(body) ?? "Unable to load reservation payments.");
        }

        const next = readRequests(body);
        const hadPaidRequest = requestsRef.current.some(
          (request) => request.status === "paid"
        );
        const hasNewPaidRequest = next.some((request) => request.status === "paid");

        setRequests(next);
        setActiveRequest((current) => {
          if (!current) {
            return next[0] ?? null;
          }
          return next.find((request) => request.id === current.id) ?? current;
        });
        setError(null);

        if (sync && hasNewPaidRequest && !hadPaidRequest) {
          await refreshReservations();
          await loadBookingDetails(reservationId);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load reservation payments."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadBookingDetails, refreshReservations, reservationId]
  );

  React.useEffect(() => {
    void loadRequests(true);
  }, [loadRequests]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadRequests(true);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [loadRequests]);

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number.parseFloat(amount);
    const amountError = validateReservationPaymentAmount({
      amount: parsedAmount,
      balanceDue: defaultAmount,
    });

    if (amountError) {
      setError(amountError);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await authorizedFetch("/api/admin/payment-requests", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          reservationId,
        }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Unable to generate payment QR.");
      }

      const created = readRequest(body);
      setActiveRequest(created);
      setQrPreviewDataUrl(null);
      setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : "");
      await loadRequests(false);
      toast.success("Payment QR generated.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to generate payment QR."
      );
    } finally {
      setIsCreating(false);
    }
  }

  const prepareQrImage = React.useCallback(
    async (request: PaymentRequest): Promise<string> => {
      setIsPreparingQr(true);
      try {
        const dataUrl = await createShareablePaymentQrImage({
          request,
          currency,
          logoUrl,
          siteUrl,
        });
        setQrPreviewDataUrl(dataUrl);
        return dataUrl;
      } finally {
        setIsPreparingQr(false);
      }
    },
    [currency, logoUrl, siteUrl]
  );

  async function handleViewQr(request: PaymentRequest) {
    setActiveRequest(request);
    setIsQrDialogOpen(true);
    setError(null);
    try {
      await prepareQrImage(request);
    } catch (viewError) {
      setError(
        viewError instanceof Error
          ? viewError.message
          : "Unable to prepare QR preview."
      );
    }
  }

  async function handleDownloadQr(request: PaymentRequest) {
    setActiveRequest(request);
    setError(null);
    try {
      const dataUrl = await prepareQrImage(request);
      downloadDataUrl(dataUrl, `payment-${request.identifier}.png`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download QR."
      );
    }
  }

  async function handleSendQr(request: PaymentRequest) {
    if (!guest?.phone) {
      toast.error("Guest has no phone number.");
      return;
    }

    setActiveRequest(request);
    setIsSendingQr(true);
    setError(null);

    try {
      const blob = await createPaymentQrBlob({
        request,
        currency,
        logoUrl,
        siteUrl,
      });
      const formData = new FormData();
      formData.append("phone", guest.phone);
      formData.append("image", blob, `payment-${request.identifier}.png`);
      formData.append(
        "caption",
        `Payment QR ${getPaymentRequestCode(request.identifier)} for ${formatCurrency(request.amount, currency)}.`
      );

      const response = await authorizedFetch("/api/admin/send-payment-qr-whatsapp", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(readMessage(body) ?? "Unable to send QR on WhatsApp.");
      }

      toast.success("Payment QR sent on WhatsApp.");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send QR on WhatsApp."
      );
    } finally {
      setIsSendingQr(false);
    }
  }

  async function handleOverridePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number.parseFloat(overrideAmount);
    const amountError = validateReservationPaymentAmount({
      amount: parsedAmount,
      balanceDue: defaultAmount,
    });

    if (amountError) {
      setError(amountError);
      return;
    }

    if (!overrideReason.trim()) {
      setError("Enter an admin override reason.");
      return;
    }

    setIsOverriding(true);
    setError(null);

    try {
      const response = await authorizedFetch(
        `/api/admin/reservations/${reservationId}/payment-override`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parsedAmount,
            reference: overrideReference.trim() || null,
            reason: overrideReason.trim(),
          }),
        }
      );
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Unable to confirm payment override.");
      }

      setIsOverrideDialogOpen(false);
      setOverrideReason("");
      setOverrideReference("");
      await refreshReservations();
      await loadBookingDetails(reservationId);
      await loadRequests(true);
      toast.success("Payment override recorded and booking confirmed.");
    } catch (overrideError) {
      setError(
        overrideError instanceof Error
          ? overrideError.message
          : "Unable to confirm payment override."
      );
    } finally {
      setIsOverriding(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/40 p-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment QR unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <form onSubmit={handleCreatePayment} className="grid flex-1 gap-3 sm:grid-cols-[minmax(180px,260px)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="reservation-payment-amount">UPI Gateway Amount</Label>
            <Input
              id="reservation-payment-amount"
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter amount"
              disabled={defaultAmount <= 0}
            />
          </div>
          <Button type="submit" disabled={isCreating || defaultAmount <= 0}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate QR
          </Button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row">
          {canOverridePayment && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOverrideDialogOpen(true)}
              disabled={defaultAmount <= 0}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Confirm
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadRequests(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading payment requests
        </div>
      ) : requests.length === 0 ? (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
          No payment QR created for this reservation.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">QR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-mono font-semibold">
                  {getPaymentRequestCode(request.identifier)}
                </TableCell>
                <TableCell>{formatCurrency(request.amount, currency)}</TableCell>
                <TableCell>
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell>{formatDateTime(request.expiresAt)}</TableCell>
                <TableCell>
                  <span className="block max-w-[180px] truncate">
                    {request.paymentReference ?? "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleViewQr(request)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDownloadQr(request)}
                      disabled={isPreparingQr}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSendQr(request)}
                      disabled={isSendingQr || !guest?.phone}
                      title={!guest?.phone ? "Guest has no phone number" : undefined}
                    >
                      {isSendingQr && activeRequest?.id === request.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="max-w-[520px] p-6">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">Payment QR</DialogTitle>
            <DialogDescription>
              Share this QR with the guest for the selected reservation payment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            {qrPreviewDataUrl ? (
              <div
                role="img"
                aria-label="Payment QR with amount, identifier, expiry, and UPI details"
                className="h-[70vh] max-h-[660px] w-full max-w-[492px] rounded-lg border bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${qrPreviewDataUrl}")` }}
              />
            ) : (
              <div className="flex h-[420px] w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing QR
              </div>
            )}
          </div>
          {activeRequest ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => void handleDownloadQr(activeRequest)}
                disabled={isPreparingQr}
              >
                <Download className="h-4 w-4" />
                Download QR
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => void handleSendQr(activeRequest)}
                disabled={isSendingQr || !guest?.phone}
              >
                <Send className="h-4 w-4" />
                Send WhatsApp
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">
              Admin Payment Override
            </DialogTitle>
            <DialogDescription>
              Use only when the UPI payment is verified outside auto-match.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOverridePayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="override-amount">Paid Amount</Label>
              <Input
                id="override-amount"
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={overrideAmount}
                onChange={(event) => setOverrideAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reference">Reference</Label>
              <Input
                id="override-reference"
                value={overrideReference}
                onChange={(event) => setOverrideReference(event.target.value)}
                placeholder="Optional bank / UPI reference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Why auto-match did not confirm this payment"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isOverriding}>
                {isOverriding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Confirm Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  const Icon = status === "paid" ? CheckCircle2 : Clock3;

  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "paid" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
        status === "expired" && "border-slate-200 bg-slate-50 text-slate-600",
        status === "cancelled" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </Badge>
  );
}

function readRequests(body: unknown): PaymentRequest[] {
  if (!isRecord(body) || !Array.isArray(body.requests)) {
    return EMPTY_REQUESTS;
  }

  return body.requests.filter(isPaymentRequest);
}

function readRequest(body: unknown): PaymentRequest {
  if (!isRecord(body) || !isPaymentRequest(body.request)) {
    throw new Error("Payment request response was not valid.");
  }

  return body.request;
}

function readMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function isPaymentRequest(value: unknown): value is PaymentRequest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.identifier === "string" &&
    (typeof value.reservationId === "string" || value.reservationId === null) &&
    (typeof value.folioItemId === "string" || value.folioItemId === null) &&
    typeof value.amount === "number" &&
    typeof value.status === "string" &&
    typeof value.upiUri === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
