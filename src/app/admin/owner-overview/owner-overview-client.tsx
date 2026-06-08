"use client";

import * as React from "react";
import {
  differenceInBusinessDays,
  format,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  AlertTriangle,
  ArrowDownCircle,
  CalendarIcon,
  Landmark,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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

const CHART_CONFIG: ChartConfig = {
  credit: { label: "Credit", color: "hsl(142 71% 45%)" },
  debit: { label: "Debit", color: "hsl(var(--destructive))" },
};

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
  const [preset, setPreset] = React.useState<PresetKey>("30d");
  const [range, setRange] = React.useState<DateRange>(() =>
    presetRange("30d", new Date())
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
            {summary?.account ? (
              <span className="inline-flex items-center gap-1">
                <Landmark className="h-3.5 w-3.5" /> {summary.account}
              </span>
            ) : (
              "Pay-ins, settlements and payouts at a glance."
            )}
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

      {/* Payout + flow cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Payouts</CardDescription>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {summary ? formatCurrency(summary.payoutTotal) : "…"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Money transferred to your account this period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credit / Debit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 text-lg font-semibold">
              <span className="text-emerald-600">
                {summary ? formatCurrency(summary.creditTotal) : "…"}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-destructive">
                {summary ? formatCurrency(summary.debitTotal) : "…"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">In vs out this period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Settling now</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {summary ? summary.settlement.length : "…"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pay-ins clearing over the next working days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fee incentive + floor */}
      <FeeIncentiveCard summary={summary} formatCurrency={formatCurrency} />

      {/* Daily credit vs debit */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Daily money flow</CardTitle>
          <CardDescription>Credit vs debit for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary && summary.dailyCreditDebit.length > 0 ? (
            <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
              <BarChart
                data={summary.dailyCreditDebit.map((point) => ({
                  date: format(parseISO(point.date), "dd MMM"),
                  credit: point.credit,
                  debit: point.debit,
                }))}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value) =>
                    formatCurrency(value as number, { notation: "compact" })
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  }
                  cursor={{ fill: "hsl(var(--accent))" }}
                />
                <Bar dataKey="credit" fill="var(--color-credit)" radius={4} />
                <Bar dataKey="debit" fill="var(--color-debit)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState label="No money movement in this period." />
          )}
        </CardContent>
      </Card>

      {/* Settlement / Settled */}
      <Tabs defaultValue="settled">
        <TabsList>
          <TabsTrigger value="settled">
            Settled {summary ? `(${summary.settled.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="settlement">
            Settlement {summary ? `(${summary.settlement.length})` : ""}
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
        <TabsContent value="settlement">
          <LedgerTable
            rows={summary?.settlement ?? []}
            isLoading={isLoading}
            emptyLabel="Nothing is currently settling."
            formatCurrency={formatCurrency}
            mode="settlement"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeeIncentiveCard({
  summary,
  formatCurrency,
}: {
  summary: OwnerOverviewSummary | null;
  formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  if (!summary) {
    return null;
  }
  const {
    feeTier,
    maintainedParked,
    maintainedWindowDays,
    minimumBalance,
    belowFloor,
    floor,
  } = summary;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-sans text-lg">Your gateway fee</CardTitle>
        <CardDescription>
          The more you keep in our system, the less you pay on each transaction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          Kept in our system (last {maintainedWindowDays} days):{" "}
          <span className="font-semibold">{formatCurrency(maintainedParked)}</span> —
          you&apos;re on the{" "}
          <span className="font-semibold">{feeTier.ratePercent}%</span> gateway fee.
        </p>
        {feeTier.nextThreshold !== null && feeTier.nextRatePercent !== null ? (
          <p className="text-muted-foreground">
            Keep {formatCurrency(feeTier.nextThreshold)} to drop to{" "}
            <span className="font-medium text-emerald-600">
              {feeTier.nextRatePercent}%
            </span>{" "}
            — you save more the longer it stays.
          </p>
        ) : (
          <p className="text-emerald-600">You&apos;re on the best available rate.</p>
        )}
        <p className="text-muted-foreground">
          Lowest bank balance this period:{" "}
          <span className="font-medium text-foreground">
            {minimumBalance !== null ? formatCurrency(minimumBalance) : "—"}
          </span>
        </p>
        {belowFloor && (
          <p className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Below the {formatCurrency(floor)} bank minimum — penalty risk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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
  mode: "settled" | "settlement";
}) {
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
                <TableHead>
                  {mode === "settlement" ? "Settles" : "Type"}
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
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
                  <TableCell className="whitespace-nowrap">
                    {mode === "settlement" ? (
                      <SettlesHint settledOn={row.settledOn} />
                    ) : (
                      <Badge
                        variant={row.kind === "payout" ? "destructive" : "secondary"}
                      >
                        {row.kind === "payout" ? "Payout" : "Credit"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium whitespace-nowrap",
                      row.kind === "payout" ? "text-destructive" : "text-emerald-600"
                    )}
                  >
                    {row.kind === "payout" ? "−" : "+"}
                    {formatCurrency(row.amount)}
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

function SettlesHint({ settledOn }: { settledOn: string | null }) {
  if (!settledOn) {
    return <span className="text-muted-foreground">—</span>;
  }
  const target = parseISO(settledOn);
  const daysLeft = Math.max(0, differenceInBusinessDays(target, new Date()));
  return (
    <span className="text-muted-foreground">
      {format(target, "dd MMM")}
      {daysLeft > 0 ? ` · ${daysLeft} working day${daysLeft === 1 ? "" : "s"}` : " · soon"}
    </span>
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
    !Array.isArray(body.settlement) ||
    !Array.isArray(body.settled) ||
    !Array.isArray(body.dailyCreditDebit) ||
    !isRecord(body.feeTier)
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
