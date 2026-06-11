"use client";

import * as React from "react";
import { format, parseISO, startOfMonth, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowDownCircle, CalendarIcon, Loader2, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authorizedFetch } from "@/lib/auth/client-session";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import type {
  OwnerLedgerEntry,
  OwnerOverviewSummary,
} from "@/lib/owner-overview/types";

type PresetKey = "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { key: Exclude<PresetKey, "custom">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
];

function presetRange(key: Exclude<PresetKey, "custom">, today: Date): DateRange {
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: subDays(today, 6), to: today };
    case "30d":
      return { from: subDays(today, 29), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
  }
}

function toParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function OwnerOverviewClient() {
  const formatCurrency = useCurrencyFormatter();
  const [preset, setPreset] = React.useState<PresetKey>("today");
  const [range, setRange] = React.useState<DateRange>(() =>
    presetRange("today", new Date())
  );
  const [summary, setSummary] = React.useState<OwnerOverviewSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const from = range.from;
  const to = range.to ?? range.from;

  const load = React.useCallback(
    async (silent: boolean) => {
      if (!from || !to) {
        return;
      }
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      try {
        const params = new URLSearchParams({ from: toParam(from), to: toParam(to) });
        const response = await authorizedFetch(
          `/api/admin/owner-overview?${params.toString()}`,
          { cache: "no-store" }
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(readMessage(body) ?? "Unable to load overview.");
        }
        setSummary(readSummary(body));
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load overview."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [from, to]
  );

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const handlePreset = (key: Exclude<PresetKey, "custom">) => {
    setPreset(key);
    setRange(presetRange(key, new Date()));
  };

  const handleCustomRange = (next: DateRange | undefined) => {
    if (next?.from) {
      setPreset("custom");
      setRange({ from: next.from, to: next.to ?? next.from });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Owner Overview</h1>
          <p className="text-sm text-muted-foreground">
            Pay-ins, settlements and payouts at a glance.
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

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={preset === item.key ? "default" : "outline"}
            onClick={() => handlePreset(item.key)}
          >
            {item.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={preset === "custom" ? "default" : "outline"}
              className="gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {preset === "custom" && from
                ? `${format(from, "dd MMM")} – ${format(to ?? from, "dd MMM")}`
                : "Custom"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-2xl p-3" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={from}
              selected={range}
              onSelect={handleCustomRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Overview unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Period snapshot — follows the date filter above */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Transactions</CardDescription>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {summary ? formatCurrency(summary.transactionsTotal) : "…"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Settled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">
              {summary ? formatCurrency(summary.settledSummary.net) : "…"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Txn.</p>
                <p className="font-medium">
                  {summary ? formatCurrency(summary.settledSummary.gross) : "…"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deduction</p>
                <p className="font-medium text-destructive">
                  {summary ? formatCurrency(summary.settledSummary.fee) : "…"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settled / Settling / Payout */}
      <Tabs defaultValue="settled">
        <TabsList>
          <TabsTrigger value="settled">
            Settled {summary ? `(${summary.settled.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="settling">
            Settling {summary ? `(${summary.settling.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="payout">
            Payout {summary ? `(${summary.payouts.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="settled">
          <LedgerTable
            rows={summary?.settled ?? []}
            isLoading={isLoading}
            emptyLabel="No settled transactions in this period."
            formatCurrency={formatCurrency}
            mode="settled"
          />
        </TabsContent>
        <TabsContent value="settling">
          <LedgerTable
            rows={summary?.settling ?? []}
            isLoading={isLoading}
            emptyLabel="Nothing is currently settling."
            formatCurrency={formatCurrency}
            mode="settling"
          />
        </TabsContent>
        <TabsContent value="payout">
          <LedgerTable
            rows={summary?.payouts ?? []}
            isLoading={isLoading}
            emptyLabel="No payouts in this period."
            formatCurrency={formatCurrency}
            mode="payout"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type LedgerMode = "settled" | "settling" | "payout";

function LedgerTable({
  rows,
  isLoading,
  emptyLabel,
  formatCurrency,
  mode,
}: {
  rows: OwnerLedgerEntry[];
  isLoading: boolean;
  emptyLabel: string;
  formatCurrency: (value: number) => string;
  mode: LedgerMode;
}) {
  const isPayout = mode === "payout";
  const isSettling = mode === "settling";
  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <LoadingState label="Loading transactions" />
        ) : rows.length === 0 ? (
          <EmptyState label={emptyLabel} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                {isSettling && <TableHead>Settles</TableHead>}
                <TableHead className="text-right">
                  {mode === "settled" ? "Amount (after 1% fee)" : "Amount"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.id}-${row.kind}`}>
                  <TableCell className="whitespace-nowrap">
                    {format(parseISO(row.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate" title={row.description}>
                    {row.description || "—"}
                  </TableCell>
                  {isSettling && (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {row.settledOn
                        ? format(parseISO(row.settledOn), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell
                    className={cn(
                      "text-right font-medium whitespace-nowrap",
                      isPayout ? "text-destructive" : "text-emerald-600"
                    )}
                  >
                    {isPayout ? "−" : "+"}
                    {formatCurrency(mode === "settled" ? row.netAmount : row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
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

function readSummary(body: unknown): OwnerOverviewSummary {
  if (
    !isRecord(body) ||
    !Array.isArray(body.settling) ||
    !Array.isArray(body.settled) ||
    !Array.isArray(body.payouts) ||
    !isRecord(body.settledSummary)
  ) {
    throw new Error("Overview response was not valid.");
  }
  return body as unknown as OwnerOverviewSummary;
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
