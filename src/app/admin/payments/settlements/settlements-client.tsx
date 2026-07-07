"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authorizedFetch } from "@/lib/auth/client-session";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import type {
  PayoutAllocationLine,
  PayoutWithAllocations,
  SettlementView,
} from "@/lib/settlements/types";

export function SettlementsClient() {
  const formatCurrency = useCurrencyFormatter();
  const [view, setView] = React.useState<SettlementView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async (silent: boolean) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const response = await authorizedFetch("/api/admin/settlements", {
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Unable to load settlements.");
      }
      setView(readView(body));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load settlements."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const summary = view?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Settlements</h1>
          <p className="text-sm text-muted-foreground">
            Each payout and the settled bookings it covered (oldest first).
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load(true)}
          disabled={isRefreshing || isLoading}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Settlements unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Payout list */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>
            Payouts {view ? `(${view.payouts.length})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <LoadingState label="Loading settlements" />
          ) : !view || view.payouts.length === 0 ? (
            <EmptyState label="No payouts recorded yet." />
          ) : (
            <div className="space-y-3">
              {view.payouts.map((payout) => (
                <PayoutRow
                  key={payout.id}
                  payout={payout}
                  isOpen={expanded.has(payout.id)}
                  onToggle={() => toggle(payout.id)}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settled but not yet paid out */}
      {summary && summary.pendingLines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Pending payout — settled money not yet paid out (
              {summary.pendingLines.length})
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <AllocationTable
              lines={summary.pendingLines}
              formatCurrency={formatCurrency}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PayoutRow({
  payout,
  isOpen,
  onToggle,
  formatCurrency,
}: {
  payout: PayoutWithAllocations;
  isOpen: boolean;
  onToggle: () => void;
  formatCurrency: (value: number) => string;
}) {
  const isRefund = payout.isRefund;
  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium">
            {format(parseISO(payout.date), "dd MMM yyyy")}
            {isRefund && (
              <Badge variant="outline" className="text-xs font-normal">
                Refund
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground" title={payout.description}>
            {isRefund
              ? payout.description || "Payout"
              : `${payout.description || "Payout"} · ${payout.lines.length} booking${
                  payout.lines.length === 1 ? "" : "s"
                }`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-destructive whitespace-nowrap">
            −{formatCurrency(payout.amount)}
          </p>
          {payout.unmatchedAmount > 0 && !isRefund && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {formatCurrency(payout.unmatchedAmount)} unmatched
            </p>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-border/60 px-4 py-3">
          {isRefund ? (
            <div className="text-sm">
              <span className="font-medium">Refund</span>
              <span className="text-muted-foreground"> · {payout.description || "Guest refund"}</span>
            </div>
          ) : (
            <AllocationTable lines={payout.lines} formatCurrency={formatCurrency} />
          )}
        </div>
      )}
    </div>
  );
}

function AllocationTable({
  lines,
  formatCurrency,
}: {
  lines: PayoutAllocationLine[];
  formatCurrency: (value: number) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Settled</TableHead>
          <TableHead>Booking / Receipt</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => (
          <TableRow key={`${line.settledEntryId}-${index}`}>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {format(parseISO(line.settledOn), "dd MMM yyyy")}
            </TableCell>
            <TableCell>
              <span className="font-medium">{labelFor(line)}</span>
              {line.isPartial && (
                <Badge variant="outline" className="ml-2 align-middle text-xs">
                  partial
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right font-medium whitespace-nowrap">
              {formatCurrency(line.allocatedAmount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function labelFor(line: PayoutAllocationLine): string {
  if (line.bookingCode) {
    return line.bookingCode;
  }
  if (line.receiptSlipNo !== null) {
    return `MR-${line.receiptSlipNo}`;
  }
  return "— (unlinked)";
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function readView(body: unknown): SettlementView {
  if (
    !isRecord(body) ||
    !Array.isArray(body.payouts) ||
    !isRecord(body.summary) ||
    !Array.isArray((body.summary as Record<string, unknown>).pendingLines)
  ) {
    throw new Error("Settlements response was not valid.");
  }
  return body as unknown as SettlementView;
}

function readMessage(body: unknown): string | null {
  if (isRecord(body) && typeof body.message === "string") {
    return body.message;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
