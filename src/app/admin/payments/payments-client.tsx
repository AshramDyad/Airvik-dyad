"use client";

import * as React from "react";
import {
  AlertTriangle,
  Banknote,
  Clock3,
  Download,
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
  const creditedRows = React.useMemo(
    () => rows.filter(isCreditedTransaction),
    [rows]
  );
  const filteredRows = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return creditedRows;
    }

    return creditedRows.filter((row) =>
      getSearchText(row).toLowerCase().includes(normalizedQuery)
    );
  }, [creditedRows, query]);

  const todayCollection = React.useMemo(
    () => getTodayCreditedTotal(creditedRows, timeZone),
    [creditedRows, timeZone]
  );
  const latestTransaction = creditedRows[0] ?? null;
  const lastRefresh = payload ? formatDateTime(payload.fetchedAt) : "Not loaded";
  const todayDisplay = formatTodayDate(timeZone);

  const showEmptyState = !isInitialLoading && creditedRows.length === 0 && !error;
  const showErrorEmptyState =
    !isInitialLoading && rows.length === 0 && Boolean(error);
  const showNoSearchResults =
    !isInitialLoading && creditedRows.length > 0 && filteredRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a
                href="/Sahajanand-wellness-qr.png"
                download="Sahajanand-wellness-qr.png"
              >
                <Download className="h-4 w-4" />
                Download QR
              </a>
            </Button>
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
          </div>
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
          detail={latestTransaction ? undefined : "No credited transactions"}
        />
        <SummaryCard
          icon={Banknote}
          label="Today collection"
          labelDetail={todayDisplay}
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
            <EmptyState title="No credited transactions found" />
          ) : showNoSearchResults ? (
            <EmptyState title="No matching transactions" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">Date</TableHead>
                  <TableHead className="min-w-[260px]">Description/Payer</TableHead>
                  <TableHead className="min-w-[130px]">Amount</TableHead>
                  <TableHead className="min-w-[160px]">Reference</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const transactionStatus = getTransactionStatus(row);

                  return (
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
                      <TableCell>
                        <span className="block max-w-[180px] truncate">
                          {row.reference ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {transactionStatus ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "max-w-[150px] truncate",
                              getStatusClassName(transactionStatus)
                            )}
                          >
                            {transactionStatus}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
  labelDetail?: string;
  value: string;
  detail?: string;
};

function SummaryCard({
  icon: Icon,
  label,
  labelDetail,
  value,
  detail,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardDescription>
          {label}
          {labelDetail ? (
            <span className="ml-1 text-[11px] text-muted-foreground">
              ({labelDetail})
            </span>
          ) : null}
        </CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-semibold tracking-tight">
          {value}
        </div>
        {detail ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
        ) : null}
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

  const trimmed = value.trim();
  const slashDateTimestamp = parseSeparatedDate(trimmed);
  if (slashDateTimestamp !== null) {
    return slashDateTimestamp;
  }

  const compactDateTimestamp = parseCompactDate(trimmed);
  if (compactDateTimestamp !== null) {
    return compactDateTimestamp;
  }

  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseSeparatedDate(value: string): number | null {
  const match = value.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?/
  );
  if (!match) {
    return null;
  }

  const first = Number.parseInt(match[1], 10);
  const second = Number.parseInt(match[2], 10);
  const yearPart = Number.parseInt(match[3], 10);
  const hours = match[4] ? Number.parseInt(match[4], 10) : 0;
  const minutes = match[5] ? Number.parseInt(match[5], 10) : 0;
  const seconds = match[6] ? Number.parseInt(match[6], 10) : 0;
  const year = yearPart < 100 ? 2000 + yearPart : yearPart;
  const day = first > 12 ? first : second > 12 ? second : first;
  const month = first > 12 ? second : second > 12 ? first : second;

  return buildLocalDateTimestamp(year, month, day, hours, minutes, seconds);
}

function parseCompactDate(value: string): number | null {
  const match = value.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const yearPart = Number.parseInt(match[3], 10);
  const year = yearPart < 100 ? 2000 + yearPart : yearPart;

  return buildLocalDateTimestamp(year, month, day, 0, 0, 0);
}

function buildLocalDateTimestamp(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number
): number | null {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
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
  if (status) {
    if (EXCLUDED_STATUS_PATTERN.test(status)) {
      return false;
    }

    return CREDITED_STATUS_PATTERN.test(status);
  }

  return isCreditRow(row);
}

function isCreditRow(row: GoogleSheetTransaction): boolean {
  const credit = getRawAmountByHeader(row, "credit");
  if (credit !== null) {
    return credit > 0;
  }

  const debit = getRawAmountByHeader(row, "debit");
  if (debit !== null && debit > 0) {
    return false;
  }

  return row.amount !== null && row.amount > 0;
}

function getRawAmountByHeader(
  row: GoogleSheetTransaction,
  header: string
): number | null {
  const entry = Object.entries(row.raw).find(
    ([key, value]) =>
      normalizeLabel(key) === header && value.trim().length > 0
  );
  if (!entry) {
    return null;
  }

  return parseSheetAmount(entry[1]);
}

function parseSheetAmount(value: string): number | null {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function getTransactionStatus(row: GoogleSheetTransaction): string | null {
  const debit = getRawAmountByHeader(row, "debit");
  if (debit !== null && debit !== 0) {
    return "Debit";
  }

  const credit = getRawAmountByHeader(row, "credit");
  if (credit !== null && credit !== 0) {
    return "Credit";
  }

  if (row.amount !== null && row.amount < 0) {
    return "Debit";
  }

  if (row.amount !== null && row.amount > 0) {
    return "Credit";
  }

  return row.status;
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

function formatTodayDate(timeZone: string): string {
  return formatDateForTimeZone(new Date(), timeZone) ?? formatDateForTimeZone(
    new Date(),
    DEFAULT_TIME_ZONE
  ) ?? "";
}

function formatDateForTimeZone(date: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}

function getStatusClassName(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("credit")) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  }

  if (normalized.includes("debit")) {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

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
