"use client";

import * as React from "react";
import {
  Banknote,
  CreditCard,
  Loader2,
  RefreshCw,
  UserRound,
  WalletCards,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  CashReceiverSummary,
  PaymentAccountingSummary,
  PaymentAccountingTransaction,
} from "@/lib/payments/accounting";
import { authorizedFetch } from "@/lib/auth/client-session";
import { useCurrencyFormatter } from "@/hooks/use-currency";

type AccountsPayload = {
  date: string;
  transactions: PaymentAccountingTransaction[];
  summary: PaymentAccountingSummary;
};

export function AccountsClient() {
  const { property } = useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const [date, setDate] = React.useState(() => getTodayDate());
  const [payload, setPayload] = React.useState<AccountsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const timeZone = property?.timezone || "Asia/Kolkata";

  const loadAccounts = React.useCallback(
    async (nextDate: string, silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          date: nextDate,
          timeZone,
        });
        const response = await authorizedFetch(`/api/admin/accounts?${params}`, {
          cache: "no-store",
        });
        const body: unknown = await response.json();

        if (!response.ok) {
          throw new Error(readMessage(body) ?? "Unable to load accounts.");
        }

        setPayload(readAccountsPayload(body));
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load accounts."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [timeZone]
  );

  React.useEffect(() => {
    void loadAccounts(date);
  }, [date, loadAccounts]);

  const summary = payload?.summary;
  const transactions = payload?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Daily online and cash collection from reservation payments.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full sm:w-[170px]"
          />
          <Button
            variant="outline"
            onClick={() => void loadAccounts(date, true)}
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

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Accounts unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={CreditCard}
          label="Online"
          value={summary ? formatCurrency(summary.onlineTotal) : "..."}
          detail={`${summary?.onlineCount ?? 0} UPI Gateway payments`}
        />
        <SummaryCard
          icon={Banknote}
          label="Cash"
          value={summary ? formatCurrency(summary.cashTotal) : "..."}
          detail={`${summary?.cashCount ?? 0} cash payments`}
        />
        <SummaryCard
          icon={WalletCards}
          label="Total"
          value={summary ? formatCurrency(summary.total) : "..."}
          detail="Online plus cash"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <CashReceiverCard
          rows={summary?.cashByReceiver ?? []}
          formatCurrency={formatCurrency}
          isLoading={isLoading}
        />
        <TransactionsCard
          rows={transactions}
          formatCurrency={formatCurrency}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CashReceiverCard({
  rows,
  formatCurrency,
  isLoading,
}: {
  rows: CashReceiverSummary[];
  formatCurrency: (value: number) => string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-sans text-lg">Cash By Reception</CardTitle>
        <CardDescription>Use this for end-of-day handover.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <LoadingState label="Loading cash totals" />
        ) : rows.length === 0 ? (
          <EmptyState label="No cash received for this date." />
        ) : (
          rows.map((row) => (
            <div
              key={row.receivedBy ?? "unassigned"}
              className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.receivedByName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.count} payments
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold">
                {formatCurrency(row.amount)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TransactionsCard({
  rows,
  formatCurrency,
  isLoading,
}: {
  rows: PaymentAccountingTransaction[];
  formatCurrency: (value: number) => string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-sans text-lg">Transactions</CardTitle>
        <CardDescription>Official reservation payments for the day.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Loading transactions" />
        ) : rows.length === 0 ? (
          <EmptyState label="No transactions for this date." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatTime(row.timestamp)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.bookingId ?? "-"}
                  </TableCell>
                  <TableCell>{row.paymentMethod}</TableCell>
                  <TableCell>{row.receivedByName ?? "-"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Math.abs(row.amount))}
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

function readAccountsPayload(body: unknown): AccountsPayload {
  if (!isRecord(body) || !isRecord(body.summary) || !Array.isArray(body.transactions)) {
    throw new Error("Accounts response was not valid.");
  }

  return body as AccountsPayload;
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

function getTodayDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
