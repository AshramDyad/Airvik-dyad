"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Clock3, Download, Loader2, RefreshCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { ReservationPaymentRequest } from "@/data/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddChargeDialog } from "@/app/admin/reservations/components/add-charge-dialog";
import { RecordPaymentDialog } from "@/app/admin/reservations/components/record-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import {
  calculateReservationFinancials,
  resolveReservationTaxConfig,
} from "@/lib/reservations/calculate-financials";
import {
  calculateRemainingPaymentAmount,
  buildReservationPaymentIntentLink,
  buildReservationPaymentQrUrl,
  buildReservationPaymentUpiLink,
} from "@/lib/payments/upi";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { useDataContext } from "@/context/data-context";

interface BillingCardProps {
  reservation: ReservationWithDetails;
  groupSummary: {
    reservations: ReservationWithDetails[];
    roomCount: number;
    totalAmount: number;
    folio: ReservationWithDetails["folio"];
    taxesTotal: number;
    hasMixedTaxRates: boolean;
    appliedTaxRate: number | null;
  };
}

type PaymentRequestStatusVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

const paymentRequestStatusConfig: Record<
  ReservationPaymentRequest["status"],
  { label: string; variant: PaymentRequestStatusVariant }
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

export function BillingCard({ reservation, groupSummary }: BillingCardProps) {
  const {
    property,
    reservationPaymentRequests,
    loadReservationPaymentRequests,
    createReservationPaymentRequest,
    updateReservationPaymentRequest,
    applyManualPaymentToReservationPaymentRequests,
    addFolioItem,
  } = useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const [isRefreshingRequests, setIsRefreshingRequests] = React.useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = React.useState(false);
  const [requestEntryMode, setRequestEntryMode] = React.useState<"amount" | "percentage">(
    "amount"
  );
  const [requestAmount, setRequestAmount] = React.useState("");
  const [requestNotes, setRequestNotes] = React.useState("");
  const [requestPercentage, setRequestPercentage] = React.useState("");
  const [requestError, setRequestError] = React.useState<string>("");
  const [manualPaymentAmounts, setManualPaymentAmounts] = React.useState<
    Record<string, string>
  >({});
  const [manualPaymentReferences, setManualPaymentReferences] = React.useState<
    Record<string, string>
  >({});
  const [manualPaymentErrors, setManualPaymentErrors] = React.useState<
    Record<string, string>
  >({});
  const [confirmingRequestId, setConfirmingRequestId] = React.useState<string | null>(
    null
  );

  const baseTaxConfig = resolveReservationTaxConfig(reservation, property);
  const hasGroupData = groupSummary.roomCount > 0;
  const folioEntries = hasGroupData && groupSummary.folio.length > 0
    ? groupSummary.folio
    : reservation.folio;
  const billingSource: Pick<ReservationWithDetails, "folio" | "totalAmount"> = {
    totalAmount: hasGroupData ? groupSummary.totalAmount : reservation.totalAmount,
    folio: folioEntries,
  };
  const summaryTaxConfig = hasGroupData
    ? {
        enabled: groupSummary.taxesTotal > 0,
        percentage:
          groupSummary.hasMixedTaxRates
            ? baseTaxConfig.percentage
            : groupSummary.appliedTaxRate ?? baseTaxConfig.percentage,
        taxesOverride: groupSummary.taxesTotal,
      }
    : baseTaxConfig;
  const sortedFolio = [...folioEntries].sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  const roomCountLabel = groupSummary.roomCount === 1
    ? "Totals include 1 room in this booking"
    : `Totals include ${groupSummary.roomCount} rooms in this booking`;

  const {
    roomCharges,
    additionalCharges,
    taxesAndFees,
    totalCharges,
    totalPaid,
    balance,
  } = calculateReservationFinancials(billingSource, summaryTaxConfig);

  const derivedTaxRate = taxesAndFees > 0 && billingSource.totalAmount > 0
    ? taxesAndFees / billingSource.totalAmount
    : null;
  const effectiveTaxRate = !hasGroupData || !groupSummary.hasMixedTaxRates
    ? (summaryTaxConfig.percentage > 0
      ? summaryTaxConfig.percentage
      : derivedTaxRate && derivedTaxRate > 0
        ? derivedTaxRate
        : null)
    : null;
  const taxPercentDisplay = typeof effectiveTaxRate === "number"
    ? effectiveTaxRate * 100
    : null;

  const upiPropertyConfig = React.useMemo(
    () => ({
      upiId: property?.upi_id?.trim() || "",
      upiMerchantName:
        property?.upi_merchant_name?.trim() || property?.name || "Hotel",
    }),
    [property]
  );

  const outstandingBalance = Math.max(balance, 0);
  const normalizedOutstandingBalance = Number(outstandingBalance.toFixed(2));
  const parsedRequestAmount = Number(requestAmount);
  const normalizedRequestAmount = Number.isFinite(parsedRequestAmount)
    ? Number(requestAmount === "" ? "0" : parsedRequestAmount.toFixed(2))
    : NaN;
  const parsedRequestPercentage = Number(requestPercentage);
  const isValidRequestPercentage =
    Number.isFinite(parsedRequestPercentage) &&
    parsedRequestPercentage > 0 &&
    parsedRequestPercentage <= 100;
  const requestedAmountFromPercentage = isValidRequestPercentage
    ? Number(
        ((normalizedOutstandingBalance * parsedRequestPercentage) / 100).toFixed(2)
      )
    : 0;
  const calculatedRequestAmount =
    requestEntryMode === "percentage"
      ? requestedAmountFromPercentage
      : normalizedRequestAmount;

  const paymentRequests = React.useMemo(
    () =>
      reservationPaymentRequests
        .filter((request) => request.reservationIds.includes(reservation.id))
        .sort(
          (a, b) =>
            new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        ),
    [reservationPaymentRequests, reservation.id]
  );

  const isAndroid = React.useCallback(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /android/i.test(navigator.userAgent);
  }, []);

  const copyToClipboard = React.useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard.`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  }, []);

  const shareLink = React.useCallback(
    async (label: string, url: string) => {
      const canShare = typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      if (canShare) {
        try {
          await navigator.share({
            title: "Reservation payment request",
            text: `${label}: ${url}`,
            url,
          });
          return;
        } catch (error) {
          console.error("Unable to share payment link", error);
        }
      }

      await copyToClipboard(url, label);
      toast.info("Share is not supported in this browser; link copied instead.");
    },
    [copyToClipboard]
  );

  const handleRefreshRequests = React.useCallback((): void => {
    setIsRefreshingRequests(true);
    void loadReservationPaymentRequests(reservation.id)
      .catch((error) => {
        console.error("Failed to load reservation payment requests", error);
        toast.error("Failed to load payment requests.");
      })
      .finally(() => {
        setIsRefreshingRequests(false);
      });
  }, [loadReservationPaymentRequests, reservation.id]);

  const handleCreateRequest = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setRequestError("");

      const requestedAmount = calculatedRequestAmount;
      const normalizedAmount = Number.isFinite(requestedAmount)
        ? Number(requestedAmount.toFixed(2))
        : NaN;

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        setRequestError(
          requestEntryMode === "percentage"
            ? "Please enter a valid percentage between 0.1 and 100."
            : "Please enter a valid amount greater than 0."
        );
        return;
      }

      if (normalizedAmount > outstandingBalance) {
        setRequestError(
          `Amount cannot exceed outstanding balance ${formatCurrency(
            outstandingBalance
          )}.`
        );
        return;
      }

      try {
        setIsCreatingRequest(true);
        await createReservationPaymentRequest({
          reservationIds: [reservation.id],
          amount: normalizedAmount,
          notes: requestNotes.trim() || undefined,
          paymentMethod: "UPI",
        });
        toast.success("Payment request created successfully.");
        setRequestAmount("");
        setRequestNotes("");
        setRequestPercentage("");
        setRequestEntryMode("amount");
        setRequestError("");
      } catch (error) {
        console.error("Failed to create payment request", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to create payment request."
        );
      } finally {
        setIsCreatingRequest(false);
      }
    },
    [
      createReservationPaymentRequest,
      calculatedRequestAmount,
      outstandingBalance,
      reservation.id,
      requestNotes,
      requestEntryMode,
      formatCurrency,
    ]
  );

  const buildLaunchLink = React.useCallback(
    (request: ReservationPaymentRequest) => {
      if (!window?.location?.origin) {
        return buildReservationPaymentUpiLink(
          request,
          upiPropertyConfig,
          property.currency || "INR"
        );
      }

      const fallbackUrl = `${window.location.origin}/pay/${request.token}`;
      const intentLink = buildReservationPaymentIntentLink(
        request,
        upiPropertyConfig,
        fallbackUrl,
        property.currency || "INR"
      );

      if (isAndroid()) {
        return intentLink
          ?? buildReservationPaymentUpiLink(
            request,
            upiPropertyConfig,
            property.currency || "INR"
          );
      }

      return buildReservationPaymentUpiLink(
        request,
        upiPropertyConfig,
        property.currency || "INR"
      );
    },
    [isAndroid, property.currency, upiPropertyConfig]
  );

  const downloadRequestQr = React.useCallback(
    async (fileName: string, qrUrl: string) => {
      try {
        const response = await fetch(qrUrl);
        if (!response.ok) {
          throw new Error("Unable to download QR image.");
        }
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = imageUrl;
        anchor.download = fileName;
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(imageUrl);
        toast.success("QR downloaded.");
      } catch (error) {
        console.error("Failed to download QR image", error);
        toast.error("Failed to download QR image.");
      }
    },
    []
  );

  const openUpiLink = React.useCallback((link: string, label: string) => {
    if (typeof window === "undefined") return;
    try {
      const openedWindow = window.open(link, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        window.location.href = link;
      }
    } catch (error) {
      console.error("Failed to launch UPI link", error);
      window.location.href = link;
    }
    toast.success(`Opened ${label}.`);
  }, []);

  const clearManualPaymentError = React.useCallback((requestId: string) => {
    setManualPaymentErrors((previous) => {
      if (!previous[requestId]) {
        return previous;
      }

      const nextErrors = { ...previous };
      delete nextErrors[requestId];
      return nextErrors;
    });
  }, []);

  const handleManualRequestPayment = React.useCallback(
    async (request: ReservationPaymentRequest) => {
      const remainingAmount = calculateRemainingPaymentAmount(request);
      const canCollectPayment =
        (request.status === "requested" || request.status === "partially_paid") &&
        remainingAmount > 0;
      const amountInput = manualPaymentAmounts[request.id] ?? "";
      const transactionReference = (manualPaymentReferences[request.id] ?? "").trim();
      const parsedAmount = Number(amountInput);
      const normalizedAmount = Number.isFinite(parsedAmount)
        ? Number(parsedAmount.toFixed(2))
        : NaN;

      if (!canCollectPayment) {
        setManualPaymentErrors((previous) => ({
          ...previous,
          [request.id]: "This request is not open for manual confirmation.",
        }));
        return;
      }

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        setManualPaymentErrors((previous) => ({
          ...previous,
          [request.id]: "Enter a valid positive amount.",
        }));
        return;
      }

      if (normalizedAmount > remainingAmount) {
        setManualPaymentErrors((previous) => ({
          ...previous,
          [request.id]: "Amount cannot exceed remaining request amount.",
        }));
        return;
      }

      if (!transactionReference) {
        setManualPaymentErrors((previous) => ({
          ...previous,
          [request.id]: "Transaction reference is required.",
        }));
        return;
      }

      clearManualPaymentError(request.id);
      setConfirmingRequestId(request.id);

      try {
        await addFolioItem(
          reservation.id,
          {
            description: `Manual payment for request #${request.token}`,
            amount: -normalizedAmount,
            paymentMethod: "Manual",
            transactionId: transactionReference,
          },
          {
            autoApplyToReservationPaymentRequests: false,
          }
        );

        const appliedAmount = await applyManualPaymentToReservationPaymentRequests(
          reservation.id,
          normalizedAmount,
          {
            requestIds: [request.id],
          }
        );

        if (appliedAmount < normalizedAmount) {
          throw new Error("Unable to apply this payment to the selected request.");
        }

        await updateReservationPaymentRequest(request.id, {
          paymentReference: transactionReference,
        });

        setManualPaymentAmounts((previous) => ({
          ...previous,
          [request.id]: "",
        }));
        setManualPaymentReferences((previous) => ({
          ...previous,
          [request.id]: "",
        }));
        toast.success("Payment confirmed and added to reservation folio.");
      } catch (error) {
        console.error("Failed to confirm manual payment", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to confirm manual payment."
        );
      } finally {
        setConfirmingRequestId(null);
      }
    },
    [
      addFolioItem,
      applyManualPaymentToReservationPaymentRequests,
      clearManualPaymentError,
      manualPaymentAmounts,
      manualPaymentReferences,
      reservation.id,
      updateReservationPaymentRequest,
    ]
  );

  React.useEffect(() => {
    setRequestAmount("");
    setRequestPercentage("");
    setRequestEntryMode("amount");
    setRequestNotes("");
    setRequestError("");
    setManualPaymentAmounts({});
    setManualPaymentReferences({});
    setManualPaymentErrors({});
    setConfirmingRequestId(null);
  }, [reservation.id]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="font-serif text-lg font-semibold">
              Billing & Folio
            </CardTitle>
            <CardDescription>
              Charges and payments for this booking.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RecordPaymentDialog
              reservationId={reservation.id}
              billingSource={billingSource}
              taxConfig={summaryTaxConfig}
            >
              <Button variant="outline" size="sm">
                Record Payment
              </Button>
            </RecordPaymentDialog>
            <AddChargeDialog reservationId={reservation.id}>
              <Button variant="outline" size="sm">
                Add Charge
              </Button>
            </AddChargeDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border border-border/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px]">Method</TableHead>
                <TableHead className="w-[140px]">Transaction ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFolio.map((item) => {
                const displayDate = item.timestamp
                  ? format(parseISO(item.timestamp), "MMM d, yyyy")
                  : "-";

                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {displayDate}
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.paymentMethod || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.transactionId || "-"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        item.amount < 0 ? "text-emerald-600" : "text-foreground"
                      )}
                    >
                      {item.amount < 0
                        ? `- ${formatCurrency(Math.abs(item.amount))}`
                        : formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedFolio.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No charges or payments posted yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-dashed border-border/50 p-4 text-sm space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pricing Summary
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{roomCountLabel}</p>
            {taxesAndFees > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>
                  Taxes &amp; Fees Charged
                  {typeof taxPercentDisplay === "number" && !Number.isNaN(taxPercentDisplay) && (
                    <>
                      {" "}
                      (
                      {taxPercentDisplay.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: taxPercentDisplay % 1 === 0 ? 0 : 2,
                      })}
                      %)
                    </>
                  )}
                </span>
                <span className="text-foreground">{formatCurrency(taxesAndFees)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total (before tax)</span>
            <span className="font-medium">{formatCurrency(roomCharges)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Additional Charges</span>
            <span className="font-medium">{formatCurrency(additionalCharges)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-semibold">{formatCurrency(totalCharges)}</span>
          </div>
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payments Recorded</span>
              <span className="font-medium text-emerald-600">
                {totalPaid === 0 ? "-" : formatCurrency(totalPaid)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-medium text-primary">Balance Due (Total)</span>
              <span
                className={cn(
                  "font-semibold",
                  balance > 0 ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {formatCurrency(balance)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/50 p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reservation Payment Requests
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a request and share the payment link/QR with the guest.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleRefreshRequests();
              }}
              disabled={isRefreshingRequests}
              className="self-start"
            >
              {isRefreshingRequests ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <form
            className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3"
            onSubmit={handleCreateRequest}
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <ToggleGroup
                  type="single"
                  value={requestEntryMode}
                  onValueChange={(value) => {
                    setRequestEntryMode((value === "percentage" ? "percentage" : "amount"));
                    setRequestError("");
                    if (value === "percentage") {
                      setRequestAmount("");
                    } else {
                      setRequestPercentage("");
                    }
                  }}
                  className="gap-2"
                  disabled={isCreatingRequest}
                >
                  <ToggleGroupItem value="amount">Amount</ToggleGroupItem>
                  <ToggleGroupItem value="percentage">Percentage (%)</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {requestEntryMode === "amount" ? (
                <div className="grid gap-3 lg:grid-cols-[170px_1fr]">
                  <div className="space-y-2">
                    <label
                      htmlFor="reservation-payment-amount"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Amount
                    </label>
                    <Input
                      id="reservation-payment-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={requestAmount}
                      onChange={(event) => setRequestAmount(event.target.value)}
                      placeholder={
                        outstandingBalance > 0 ? outstandingBalance.toFixed(2) : "0.00"
                      }
                      disabled={isCreatingRequest}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter amount directly to share with the guest.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="reservation-payment-percentage"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Percentage of outstanding
                  </label>
                  <Input
                    id="reservation-payment-percentage"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={requestPercentage}
                    onChange={(event) => setRequestPercentage(event.target.value)}
                    placeholder="e.g. 50"
                    disabled={isCreatingRequest}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will create a payment request for{" "}
                    <span className="font-semibold">
                      {formatCurrency(requestedAmountFromPercentage)}
                    </span>{" "}
                    of the outstanding amount.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label
                  htmlFor="reservation-payment-summary"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Final request amount
                </label>
                <Input
                  id="reservation-payment-summary"
                  value={
                    Number.isFinite(calculatedRequestAmount)
                      ? calculatedRequestAmount.toFixed(2)
                      : ""
                  }
                  readOnly
                  className="bg-muted"
                  disabled={isCreatingRequest}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="reservation-payment-notes"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Notes (optional)
                </label>
                <Textarea
                  id="reservation-payment-notes"
                  value={requestNotes}
                  onChange={(event) => setRequestNotes(event.target.value)}
                  placeholder="Enter notes for the guest..."
                  rows={2}
                  disabled={isCreatingRequest}
                />
              </div>
            </div>
            <Button
                    type="submit"
              variant="outline"
              size="sm"
              disabled={
                isCreatingRequest ||
                outstandingBalance <= 0 ||
                (requestEntryMode === "amount"
                  ? !Number.isFinite(normalizedRequestAmount) || normalizedRequestAmount <= 0
                  : !isValidRequestPercentage)
              }
            >
              {isCreatingRequest ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="mr-2 h-4 w-4" />
              )}
              Create request
            </Button>
            {requestError ? (
              <p className="text-xs text-destructive">{requestError}</p>
            ) : null}
          </form>

          <div className="space-y-3">
            {paymentRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                No payment requests created yet for this reservation.
              </p>
            ) : (
              paymentRequests.map((request) => {
                const remainingAmount = calculateRemainingPaymentAmount(request);
                const upiLink = buildReservationPaymentUpiLink(
                  request,
                  upiPropertyConfig,
                  property.currency || "INR"
                );
                const qrUrl = upiLink ? buildReservationPaymentQrUrl(upiLink, 190) : "";
                const pageLink = `${window.location.origin}/pay/${request.token}`;
                const canCollectPayment =
                  (request.status === "requested" ||
                    request.status === "partially_paid") &&
                  remainingAmount > 0;
                const statusConfig =
                  paymentRequestStatusConfig[request.status] ?? {
                    label: request.status,
                    variant: "outline" as const,
                  };

                return (
                  <div
                    key={request.id}
                    className="rounded-xl border border-border/60 bg-background p-4 space-y-3"
                  >
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Request #{request.token}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDateTime(request.requestedAt)}
                        </p>
                      </div>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 text-sm">
                      <p>
                        <span className="text-muted-foreground">Requested:</span>{" "}
                        {formatCurrency(request.amount)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Paid:</span>{" "}
                        {formatCurrency(request.paidAmount)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Remaining:</span>{" "}
                        {formatCurrency(remainingAmount)}
                      </p>
                      {request.expiresAt ? (
                        <p className="text-muted-foreground">
                          Expires {formatDateTime(request.expiresAt)}
                        </p>
                      ) : null}
                      {request.paidAt ? (
                        <p className="text-muted-foreground">
                          Paid {formatDateTime(request.paidAt)}
                        </p>
                      ) : null}
                    </div>
                    {request.notes ? (
                      <p className="text-sm text-muted-foreground">
                        Notes: {request.notes}
                      </p>
                    ) : null}

                    <Separator />

                    {upiLink ? (
                      <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-start">
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Use the payment link or QR code below.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/pay/${request.token}`}>Open payment page</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (canCollectPayment) {
                                  const launchLink = buildLaunchLink(request);
                                  if (!launchLink) {
                                    toast.error("UPI payment link is not available.");
                                    return;
                                  }
                                  openUpiLink(launchLink, "UPI link");
                                  return;
                                }
                                toast.info("This request cannot be paid right now.");
                              }}
                              disabled={!canCollectPayment}
                              className="whitespace-nowrap"
                            >
                              {canCollectPayment ? (
                                <Wallet className="mr-2 h-4 w-4" />
                              ) : (
                                <Clock3 className="mr-2 h-4 w-4" />
                              )}
                              {canCollectPayment ? "Pay via UPI" : "Payment not active"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void copyToClipboard(upiLink, "UPI link");
                              }}
                            >
                              Copy payment link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void copyToClipboard(pageLink, "Payment page link");
                              }}
                            >
                              Copy payment page link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void shareLink("Payment page link", pageLink);
                              }}
                              disabled={!canCollectPayment}
                            >
                              Share payment page link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!qrUrl) {
                                  toast.error("QR code is not available.");
                                  return;
                                }
                                void downloadRequestQr(
                                  `${request.token}-upi-payment-qr.png`,
                                  qrUrl
                                );
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download QR
                            </Button>
                          </div>
                        </div>
                        <div className="mx-auto rounded-lg border border-border/60 bg-white p-2">
                          <img
                            src={qrUrl}
                            alt={`UPI QR for request ${request.token}`}
                            className="h-44 w-44 object-cover"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                        UPI is not configured for this property. Set UPI ID and merchant
                        name in property settings.
                      </div>
                    )}

                    {canCollectPayment ? (
                      <div className="space-y-3 rounded-xl bg-muted/30 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Confirm payment manually
                        </p>
                        <div className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
                          <div className="space-y-2">
                            <label
                              htmlFor={`manual-payment-amount-${request.id}`}
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Amount
                            </label>
                            <Input
                              id={`manual-payment-amount-${request.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={manualPaymentAmounts[request.id] || ""}
                              onChange={(event) => {
                                clearManualPaymentError(request.id);
                                setManualPaymentAmounts((previous) => ({
                                  ...previous,
                                  [request.id]: event.target.value,
                                }));
                              }}
                              placeholder="Enter paid amount"
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor={`manual-payment-reference-${request.id}`}
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Transaction reference
                            </label>
                            <Input
                              id={`manual-payment-reference-${request.id}`}
                              value={manualPaymentReferences[request.id] || ""}
                              onChange={(event) => {
                                clearManualPaymentError(request.id);
                                setManualPaymentReferences((previous) => ({
                                  ...previous,
                                  [request.id]: event.target.value,
                                }));
                              }}
                              placeholder="Txn ID / UPI reference"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              className="w-full"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void handleManualRequestPayment(request);
                              }}
                              disabled={confirmingRequestId === request.id}
                            >
                              {confirmingRequestId === request.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Wallet className="mr-2 h-4 w-4" />
                              )}
                              Confirm manual payment
                            </Button>
                          </div>
                        </div>
                        {manualPaymentErrors[request.id] ? (
                          <p className="text-xs text-destructive">
                            {manualPaymentErrors[request.id]}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          You can allocate up to {formatCurrency(remainingAmount)} for this
                          request.
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
