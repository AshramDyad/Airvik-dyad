import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  summarizeAccountingTransactions,
  type AccountingPaymentMethod,
  type PaymentAccountingTransaction,
} from "@/lib/payments/accounting";

const ACCOUNTING_FOLIO_SELECT = [
  "id",
  "reservation_id",
  "description",
  "amount",
  "timestamp",
  "payment_method",
  "transaction_id",
  "external_source",
  "external_reference",
  "received_by",
  "received_at",
  "reservations(booking_id)",
  "received_by_profile:profiles!folio_items_received_by_fkey(name)",
].join(", ");

export type DailyPaymentAccounting = {
  date: string;
  from: string;
  to: string;
  transactions: PaymentAccountingTransaction[];
  summary: ReturnType<typeof summarizeAccountingTransactions>;
};

type DbAccountingFolioRow = {
  id: string;
  reservation_id: string | null;
  description: string;
  amount: number | string;
  timestamp: string;
  payment_method: string | null;
  transaction_id: string | null;
  external_source: string | null;
  external_reference: string | null;
  received_by: string | null;
  received_at: string | null;
  reservations: { booking_id: string | null } | Array<{ booking_id: string | null }> | null;
  received_by_profile: { name: string | null } | Array<{ name: string | null }> | null;
};

export async function getDailyPaymentAccounting(args: {
  supabase: SupabaseClient;
  date: string;
  timeZone?: string;
}): Promise<DailyPaymentAccounting> {
  const timeZone = args.timeZone ?? "Asia/Kolkata";
  const from = getUtcInstantForTimeZoneDate(args.date, timeZone);
  const to = getUtcInstantForTimeZoneDate(addDays(args.date, 1), timeZone);

  const { data, error } = await args.supabase
    .from("folio_items")
    .select(ACCOUNTING_FOLIO_SELECT)
    .lt("amount", 0)
    .in("payment_method", ["Cash", "UPI Gateway"])
    .gte("timestamp", from.toISOString())
    .lt("timestamp", to.toISOString())
    .order("timestamp", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const transactions = ((data ?? []) as unknown as DbAccountingFolioRow[])
    .map(toAccountingTransaction)
    .filter((transaction): transaction is PaymentAccountingTransaction =>
      Boolean(transaction)
    );

  return {
    date: args.date,
    from: from.toISOString(),
    to: to.toISOString(),
    transactions,
    summary: summarizeAccountingTransactions(transactions),
  };
}

function toAccountingTransaction(
  row: DbAccountingFolioRow
): PaymentAccountingTransaction | null {
  const paymentMethod = toAccountingPaymentMethod(row.payment_method);
  if (!paymentMethod) {
    return null;
  }

  const reservation = firstRelation(row.reservations);
  const profile = firstRelation(row.received_by_profile);

  return {
    id: row.id,
    reservationId: row.reservation_id,
    bookingId: reservation?.booking_id ?? null,
    description: row.description,
    amount: readMoney(row.amount),
    paymentMethod,
    timestamp: row.received_at ?? row.timestamp,
    reference: row.transaction_id ?? row.external_reference,
    receivedBy: row.received_by,
    receivedByName: profile?.name ?? null,
    source: row.external_source,
  };
}

function toAccountingPaymentMethod(
  value: string | null
): AccountingPaymentMethod | null {
  return value === "Cash" || value === "UPI Gateway" ? value : null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function readMoney(value: number | string): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(date: string, days: number): string {
  const parsed = parseDateParts(date);
  const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return [
    utcDate.getUTCFullYear(),
    String(utcDate.getUTCMonth() + 1).padStart(2, "0"),
    String(utcDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getUtcInstantForTimeZoneDate(date: string, timeZone: string): Date {
  const target = parseDateParts(date);
  const guess = new Date(Date.UTC(target.year, target.month - 1, target.day));
  const actual = getTimeZoneParts(guess, timeZone);
  const actualAsUtc = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second
  );
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day);

  return new Date(guess.getTime() - (actualAsUtc - targetAsUtc));
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number.parseInt(value, 10) : 0;
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function parseDateParts(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
  };
}
