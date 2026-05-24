"use client";

import { format, parseISO } from "date-fns";
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
import { ReservationPaymentRequestsPanel } from "./ReservationPaymentRequestsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import {
  calculateReservationFinancials,
  resolveReservationTaxConfig,
} from "@/lib/reservations/calculate-financials";
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

export function BillingCard({ reservation, groupSummary }: BillingCardProps) {
  const { guests, property } = useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const guest = guests.find((entry) => entry.id === reservation.guestId);
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
  const isGatewayReservation = reservation.paymentMethod === "UPI Gateway";

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
            {!isGatewayReservation && (
              <RecordPaymentDialog
                reservationId={reservation.id}
                billingSource={billingSource}
                taxConfig={summaryTaxConfig}
              >
                <Button variant="outline" size="sm">
                  Record Cash
                </Button>
              </RecordPaymentDialog>
            )}
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
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No folio entries yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            {roomCountLabel}
            {groupSummary.hasMixedTaxRates && (
              <span className="mt-1 block">
                Multiple tax rates apply across rooms; tax total is calculated from
                each reservation snapshot.
              </span>
            )}
          </div>
          <div className="rounded-2xl border border-border/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Room Charges</span>
              <span className="font-medium">{formatCurrency(roomCharges)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Additional Charges</span>
              <span className="font-medium">{formatCurrency(additionalCharges)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">
                Taxes & Fees
                {taxPercentDisplay !== null && (
                  <span> ({taxPercentDisplay.toFixed(2)}%)</span>
                )}
              </span>
              <span className="font-medium">{formatCurrency(taxesAndFees)}</span>
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Charges</span>
                <span className="font-semibold">{formatCurrency(totalCharges)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
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
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">UPI Gateway Payments</h3>
            <p className="text-xs text-muted-foreground">
              Generate a linked QR and auto-record the payment when it is received.
            </p>
          </div>
          <ReservationPaymentRequestsPanel
            reservationId={reservation.id}
            guest={guest}
            balanceDue={Math.max(balance, 0)}
            currency={property?.currency || "INR"}
            logoUrl={property?.logo_url || "/logo.png"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
