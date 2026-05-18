"use client";

import * as React from "react";
import {
  AlertTriangle,
  Banknote,
  Clock3,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataContext } from "@/context/data-context";
import type {
  GoogleSheetTransaction,
  GoogleSheetTransactionsApiResponse,
} from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_MS = 60_000;
const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const EMPTY_ROWS: GoogleSheetTransaction[] = [];
const CREDITED_STATUS_PATTERN =
  /\b(credit|credited|success|successful|paid|received|complete|completed|captured|settled)\b/i;
const EXCLUDED_STATUS_PATTERN =
  /\b(cancel|cancelled|canceled|chargeback|debit|debited|declined|fail|failed|failure|pending|refund|refunded|reversal|reversed|unpaid|void|withdrawn)\b/i;

type LoadOptions = {
  force?: boolean;
  silent?: boolean;
};

export function PaymentsClient() {
  const { property } = useDataContext();
  const [payload, setPayload] =
    React.useState<GoogleSheetTransactionsApiResponse | null>(null);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const payloadRef =
    React.useRef<GoogleSheetTransactionsApiResponse | null>(null);

  const currency = property?.currency || "INR";
  const timeZone = property?.timezone || DEFAULT_TIME_ZONE;

  React.useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  const loadTransactions = React.useCallback(async (options: LoadOptions = {}) => {
    const { force = false, silent = false } = options;
    const hasPayload = Boolean(payloadRef.current);

    if (!silent) {
      if (hasPayload) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }
    }

    try {
      const response = await authorizedFetch(
        `/api/admin/google-sheet-transactions${force ? "?refresh=1" : ""}`,
        { cache: "no-store" }
      );
      const body: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Unable to load payments.");
      }

      const nextPayload = body as GoogleSheetTransactionsApiResponse;
      payloadRef.current = nextPayload;
      setPayload(nextPayload);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payments."
      );
    } finally {
      if (!silent) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTransactions({ silent: true });
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [loadTransactions]);

  const rows = payload?.rows ?? EMPTY_ROWS;
  const orderedRows = React.useMemo(
    () => [...rows].sort(compareTransactionsByLatest),
    [rows]
  );
  const filteredRows = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return orderedRows;
    }

    return orderedRows.filter((row) =>
      getSearchText(row).toLowerCase().includes(normalizedQuery)
    );
  }, [orderedRows, query]);

  const todayCollection = React.useMemo(
    () => getTodayCreditedTotal(rows, timeZone),
    [rows, timeZone]
  );
  const latestTransaction = orderedRows[0] ?? null;
  const lastRefresh = payload ? formatDateTime(payload.fetchedAt) : "Not loaded";

  const showEmptyState = !isInitialLoading && rows.length === 0 && !error;
  const showErrorEmptyState = !isInitialLoading && rows.length === 0 && Boolean(error);
  const showNoSearchResults =
    !isInitialLoading && rows.length > 0 && filteredRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            View the latest private Google Sheet transactions without syncing them into Supabase.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void loadTransactions({ force: true })}
            disabled={isInitialLoading || isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Last refresh: {lastRefresh}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payments unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {payload?.stale && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Showing stale data</AlertTitle>
          <AlertDescription>
            {payload.message ??
              "Google Sheets could not be refreshed, so the last successful result is shown."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          icon={ReceiptText}
          label="Last transaction amount"
          value={
            latestTransaction
              ? getAmountDisplay(latestTransaction, currency)
              : isInitialLoading
                ? "..."
                : "None"
          }
          detail={latestTransaction ? "Latest by fetched_at" : "No transaction rows"}
        />
        <SummaryCard
          icon={Banknote}
          label="Today collection"
          value={
            isInitialLoading
              ? "..."
              : formatCurrency(todayCollection, currency)
          }
          detail="Credited payments today"
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle>Sheet Transactions</CardTitle>
              <CardDescription>
                Display-only data from the configured private spreadsheet.
              </CardDescription>
            </div>
            {payload && (
              <Badge variant={payload.stale ? "outline" : "secondary"}>
                {payload.stale ? "Stale" : "Live cache"}
              </Badge>
            )}
          </div>

          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search payments"
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isInitialLoading ? (
            <div className="flex h-56 items-center justify-center text-muted-foreground">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payments
              </span>
            </div>
          ) : showErrorEmptyState ? (
            <EmptyState title="Resolve the Google Sheets error to load payments" />
          ) : showEmptyState ? (
            <EmptyState title="No transactions found" />
          ) : showNoSearchResults ? (
            <EmptyState title="No matching transactions" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">Date</TableHead>
                  <TableHead className="min-w-[260px]">Description/Payer</TableHead>
                  <TableHead className="min-w-[130px]">Amount</TableHead>
                  <TableHead className="min-w-[120px]">Method</TableHead>
                  <TableHead className="min-w-[160px]">Reference</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[80px] text-right">Row</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell className="font-medium">
                      {getTransactionDateDisplay(row)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[320px] space-y-1">
                        <p className="truncate font-medium text-foreground">
                          {getPrimaryDescription(row)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getSecondaryDescription(row)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getAmountDisplay(row, currency)}
                    </TableCell>
                    <TableCell>{row.method ?? "-"}</TableCell>
                    <TableCell>
                      <span className="block max-w-[180px] truncate">
                        {row.reference ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.status ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "max-w-[150px] truncate",
                            getStatusClassName(row.status)
                          )}
                        >
                          {row.status}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type SummaryCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
};

function SummaryCard({ icon: Icon, label, value, detail }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-semibold tracking-tight">
          {value}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
      {title}
    </div>
  );
}

function readMessage(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return null;
}

function getSearchText(row: GoogleSheetTransaction): string {
  return [
    row.date,
    row.fetchedAt,
    row.description,
    row.payer,
    row.amountText,
    row.method,
    row.reference,
    row.status,
    row.rowNumber,
    ...Object.values(row.raw),
  ]
    .filter((value): value is string | number => value !== null && value !== undefined)
    .join(" ");
}

function parseDate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareTransactionsByLatest(
  left: GoogleSheetTransaction,
  right: GoogleSheetTransaction
): number {
  const leftTimestamp = parseDate(left.fetchedAt ?? left.date);
  const rightTimestamp = parseDate(right.fetchedAt ?? right.date);

  if (leftTimestamp !== null && rightTimestamp !== null) {
    const timestampOrder = rightTimestamp - leftTimestamp;
    if (timestampOrder !== 0) {
      return timestampOrder;
    }
  } else if (leftTimestamp !== null) {
    return -1;
  } else if (rightTimestamp !== null) {
    return 1;
  }

  return right.rowNumber - left.rowNumber;
}

function getTodayCreditedTotal(
  rows: GoogleSheetTransaction[],
  timeZone: string
): number {
  const todayDateKey = getDateKeyForDate(new Date(), timeZone);
  if (!todayDateKey) {
    return 0;
  }

  return rows.reduce((total, row) => {
    if (!isCreditedTransaction(row)) {
      return total;
    }

    const rowDateKey = getTransactionDateKey(row, timeZone);
    if (rowDateKey !== todayDateKey) {
      return total;
    }

    return total + (row.amount ?? 0);
  }, 0);
}

function isCreditedTransaction(row: GoogleSheetTransaction): boolean {
  if (row.amount === null || row.amount <= 0) {
    return false;
  }

  const status = row.status?.trim() ?? "";
  if (!status || EXCLUDED_STATUS_PATTERN.test(status)) {
    return false;
  }

  return CREDITED_STATUS_PATTERN.test(status);
}

function getTransactionDateKey(
  row: GoogleSheetTransaction,
  timeZone: string
): string | null {
  return getDateKeyFromValue(row.fetchedAt ?? row.date, timeZone);
}

function getDateKeyFromValue(
  value: string | null,
  timeZone: string
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const timestamp = parseDate(trimmed);
  if (timestamp === null) {
    return null;
  }

  return getDateKeyForDate(new Date(timestamp), timeZone);
}

function getDateKeyForDate(date: Date, timeZone: string): string | null {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    getDateKeyForDateInTimeZone(date, timeZone) ??
    getDateKeyForDateInTimeZone(date, DEFAULT_TIME_ZONE)
  );
}

function getDateKeyForDateInTimeZone(
  date: Date,
  timeZone: string
): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
      return null;
    }

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function getTransactionDateDisplay(row: GoogleSheetTransaction): string {
  return row.date ?? row.fetchedAt ?? "-";
}

function getPrimaryDescription(row: GoogleSheetTransaction): string {
  return row.description ?? row.payer ?? getRawPreview(row) ?? `Row ${row.rowNumber}`;
}

function getSecondaryDescription(row: GoogleSheetTransaction): string {
  if (row.description && row.payer) {
    return row.payer;
  }

  return getRawPreview(row) ?? "Raw sheet row";
}

function getRawPreview(row: GoogleSheetTransaction): string | null {
  const value = row.cells.find((cell) => cell.trim().length > 0);
  return value ?? null;
}

function getAmountDisplay(
  row: GoogleSheetTransaction,
  currency: string
): string {
  if (row.amount !== null) {
    return formatCurrency(row.amount, currency);
  }

  return row.amountText ?? "-";
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClassName(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("success") || normalized.includes("paid")) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  }

  if (normalized.includes("fail") || normalized.includes("cancel")) {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  if (normalized.includes("pending")) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  }

  return "";
}
