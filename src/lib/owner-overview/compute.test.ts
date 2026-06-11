import { describe, expect, it } from "vitest";
import { parseISO } from "date-fns";

import type { GoogleSheetTransaction } from "@/data/types";
import { computeOwnerOverview, type OwnerDateRange } from "./compute";

type TxnOverrides = Partial<GoogleSheetTransaction> & {
  account?: string;
  transaction_id?: string;
  credit?: string;
  debit?: string;
};

function makeTxn(overrides: TxnOverrides): GoogleSheetTransaction {
  const { account, transaction_id, credit, debit, ...rest } = overrides;
  const raw: Record<string, string> = {};
  if (account !== undefined) raw.account = account;
  if (transaction_id !== undefined) raw.transaction_id = transaction_id;
  if (credit !== undefined) raw.credit = credit;
  if (debit !== undefined) raw.debit = debit;

  return {
    rowNumber: 1,
    fetchedAt: null,
    date: null,
    amount: null,
    amountText: null,
    description: null,
    payer: null,
    method: null,
    reference: null,
    status: null,
    cells: [],
    ...rest,
    raw,
  };
}

// Noon IST so the "today" key is stable regardless of the CI machine timezone.
const TODAY = new Date("2026-06-09T12:00:00+05:30"); // Tuesday, IST day = 2026-06-09
const RANGE: OwnerDateRange = {
  from: parseISO("2026-06-01"),
  to: parseISO("2026-06-09"),
};

describe("computeOwnerOverview – robust date parsing (DD/MM/YYYY)", () => {
  it("parses DD/MM/YYYY dates instead of dropping them", () => {
    // 05/06/2026 (Fri) + 7 business days = Tue 2026-06-16 → still settling after today.
    const txns = [
      makeTxn({ transaction_id: "ddmmyyyy", date: "05/06/2026", amount: 100, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.settling.map((e) => e.id)).toEqual(["ddmmyyyy"]);
    expect(summary.settling[0].settledOn).toBe("2026-06-16");
  });
});

describe("computeOwnerOverview – transactions card (follows the range)", () => {
  it("sums pay-ins received within the selected range", () => {
    const txns = [
      makeTxn({ transaction_id: "in", date: "09/06/2026", amount: 5000, description: "UPI IN" }),
      makeTxn({ transaction_id: "in2", date: "08/06/2026", amount: 999, description: "UPI IN" }),
      makeTxn({ transaction_id: "out", date: "01/05/2026", amount: 7777, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.transactionsTotal).toBe(5999);
    expect(summary.transactionsCount).toBe(2);
  });

  it("counts only today's pay-ins when the range is just today", () => {
    const today: OwnerDateRange = { from: parseISO("2026-06-09"), to: parseISO("2026-06-09") };
    const txns = [
      makeTxn({ transaction_id: "today", date: "09/06/2026", amount: 5000, description: "UPI IN" }),
      makeTxn({ transaction_id: "yesterday", date: "08/06/2026", amount: 999, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, today, TODAY);
    expect(summary.transactionsTotal).toBe(5000);
    expect(summary.transactionsCount).toBe(1);
    // Today's pay-in is still settling and appears in that tab.
    expect(summary.settling.some((e) => e.id === "today")).toBe(true);
  });
});

describe("computeOwnerOverview – settled card (follows the range)", () => {
  it("reports gross, fee and net of what cleared in the range", () => {
    // 29/05/2026 (Fri) + 7 business days = Tue 2026-06-09 → cleared, inside range.
    const txns = [
      makeTxn({ transaction_id: "cleared", date: "29/05/2026", amount: 100, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.settledSummary).toEqual({ gross: 100, fee: 1, net: 99, count: 1 });
    // It also lands in the settled tab, recorded net of fee.
    expect(summary.settled.map((e) => e.id)).toEqual(["cleared"]);
    expect(summary.settled[0].netAmount).toBe(99);
  });

  it("rounds the fee to paise", () => {
    const txns = [
      makeTxn({ transaction_id: "small", date: "29/05/2026", amount: 1, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.settledSummary.fee).toBe(0.01);
    expect(summary.settledSummary.net).toBe(0.99);
  });
});

describe("computeOwnerOverview – settled tab", () => {
  it("filters by settle date in range and lists newest settlement first", () => {
    const txns = [
      // 28/05/2026 (Thu) + 7 biz = Mon 2026-06-08 (cleared, in range)
      makeTxn({ transaction_id: "older", date: "28/05/2026", amount: 100, description: "UPI IN" }),
      // 29/05/2026 (Fri) + 7 biz = Tue 2026-06-09 (cleared today, in range)
      makeTxn({ transaction_id: "newer", date: "29/05/2026", amount: 100, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.settled.map((e) => e.id)).toEqual(["newer", "older"]);
  });

  it("excludes settlements whose settle date is outside the range", () => {
    // 02/06/2026 + 7 biz = settles 2026-06-11, but the range ends 2026-06-05.
    const narrow: OwnerDateRange = { from: parseISO("2026-06-01"), to: parseISO("2026-06-05") };
    const txns = [
      makeTxn({ transaction_id: "late", date: "02/06/2026", amount: 100, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, narrow, TODAY);
    expect(summary.settled).toHaveLength(0);
  });
});

describe("computeOwnerOverview – settling is global", () => {
  it("shows currently pending pay-ins even when outside the date range", () => {
    // Range is just 06-01..06-05, but a 06-09 pay-in is still pending today.
    const narrow: OwnerDateRange = { from: parseISO("2026-06-01"), to: parseISO("2026-06-05") };
    const txns = [
      makeTxn({ transaction_id: "pending", date: "09/06/2026", amount: 5000, description: "UPI IN" }),
    ];
    const summary = computeOwnerOverview(txns, narrow, TODAY);
    expect(summary.settling.map((e) => e.id)).toEqual(["pending"]);
  });
});

describe("computeOwnerOverview – payouts", () => {
  it("lists payout debits within range and ignores non-payout debits", () => {
    const txns = [
      makeTxn({
        transaction_id: "payout",
        date: "07/06/2026",
        amount: -174000,
        description: "FT IMPS/IFO/615911415404/PUNB0371400/payout",
      }),
      makeTxn({ transaction_id: "atm", date: "06/06/2026", amount: -500, description: "ATM withdrawal" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.payouts.map((e) => e.id)).toEqual(["payout"]);
    expect(summary.payouts[0].amount).toBe(174000);
  });

  it("excludes payouts outside the range", () => {
    const narrow: OwnerDateRange = { from: parseISO("2026-06-01"), to: parseISO("2026-06-05") };
    const txns = [
      makeTxn({ transaction_id: "payout", date: "07/06/2026", amount: -100, description: "payout" }),
    ];
    const summary = computeOwnerOverview(txns, narrow, TODAY);
    expect(summary.payouts).toHaveLength(0);
  });
});

describe("computeOwnerOverview – signed-amount fallback", () => {
  it("derives a signed amount from credit/debit columns when amount is blank", () => {
    const txns = [
      makeTxn({ transaction_id: "c", date: "29/05/2026", amount: null, credit: "1200", description: "UPI IN" }),
      makeTxn({ transaction_id: "p", date: "03/06/2026", amount: null, debit: "300", description: "payout" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.settledSummary.gross).toBe(1200); // the credit cleared in range
    expect(summary.payouts[0].amount).toBe(300);
  });
});
