import { describe, expect, it } from "vitest";
import { parseISO } from "date-fns";

import type { GoogleSheetTransaction } from "@/data/types";
import { computeOwnerOverview, type OwnerDateRange } from "./compute";

type TxnOverrides = Partial<GoogleSheetTransaction> & {
  balance?: string;
  account?: string;
  transaction_id?: string;
  credit?: string;
  debit?: string;
};

function makeTxn(overrides: TxnOverrides): GoogleSheetTransaction {
  const { balance, account, transaction_id, credit, debit, ...rest } = overrides;
  const raw: Record<string, string> = {};
  if (balance !== undefined) raw.balance = balance;
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

const TODAY = parseISO("2026-06-08"); // Monday
const RANGE: OwnerDateRange = {
  from: parseISO("2026-06-01"),
  to: parseISO("2026-06-08"),
};

describe("computeOwnerOverview – settlement split (4 working days, weekends skipped)", () => {
  it("keeps a fresh credit pending and clears an older one into settled", () => {
    const txns = [
      // Mon 06-08 + 4 business days = Fri 06-12 → still pending (after today 06-08)
      makeTxn({ transaction_id: "fresh", date: "2026-06-08", amount: 5000, description: "UPI IN" }),
      // Mon 06-01 + 4 business days = Fri 06-05 → cleared (<= today)
      makeTxn({ transaction_id: "old", date: "2026-06-01", amount: 3000, description: "UPI IN" }),
    ];

    const summary = computeOwnerOverview(txns, RANGE, TODAY);

    expect(summary.settlement.map((e) => e.id)).toEqual(["fresh"]);
    expect(summary.settled.map((e) => e.id)).toEqual(["old"]);
    expect(summary.settlement[0].settledOn).toBe("2026-06-12");
  });
});

describe("computeOwnerOverview – payout detection", () => {
  it("treats only debits whose description contains 'payout' as payouts", () => {
    const txns = [
      makeTxn({
        transaction_id: "payout",
        date: "2026-06-07",
        amount: -174000,
        description: "FT IMPS/IFO/615911415404/PUNB0371400/payout",
      }),
      makeTxn({
        transaction_id: "atm",
        date: "2026-06-06",
        amount: -500,
        description: "ATM withdrawal",
      }),
      // Credit that happens to mention payout must NOT be a payout (amount > 0).
      makeTxn({
        transaction_id: "refund",
        date: "2026-06-05",
        amount: 100,
        description: "payout refund",
      }),
    ];

    const summary = computeOwnerOverview(txns, RANGE, TODAY);

    expect(summary.payoutTotal).toBe(174000);
    expect(summary.debitTotal).toBe(174500); // payout + atm
    expect(summary.creditTotal).toBe(100); // the refund
    const settledPayouts = summary.settled.filter((e) => e.kind === "payout");
    expect(settledPayouts.map((e) => e.id)).toEqual(["payout"]);
  });
});

describe("computeOwnerOverview – parked amount drives the fee tier", () => {
  function tierFor(creditAmount: number, payoutAmount: number) {
    const txns = [
      makeTxn({ date: "2026-06-02", amount: creditAmount, description: "UPI IN" }),
      makeTxn({ date: "2026-06-03", amount: -payoutAmount, description: "payout" }),
    ];
    return computeOwnerOverview(txns, RANGE, TODAY);
  }

  it("is 1% below ₹3L, with ₹3L as the next reward", () => {
    const summary = tierFor(299999, 0);
    expect(summary.parkedNet).toBe(299999);
    expect(summary.feeTier.ratePercent).toBe(1);
    expect(summary.feeTier.nextThreshold).toBe(300000);
    expect(summary.feeTier.nextRatePercent).toBe(0.7);
  });

  it("is 0.7% at exactly ₹3L parked (credits − payouts)", () => {
    const summary = tierFor(474000, 174000); // 300000 parked
    expect(summary.parkedNet).toBe(300000);
    expect(summary.feeTier.ratePercent).toBe(0.7);
    expect(summary.feeTier.nextThreshold).toBe(600000);
  });

  it("is 0.3% at ₹6L with no further tier", () => {
    const summary = tierFor(600000, 0);
    expect(summary.feeTier.ratePercent).toBe(0.3);
    expect(summary.feeTier.nextThreshold).toBeNull();
    expect(summary.feeTier.nextRatePercent).toBeNull();
  });

  it("computes the tier over the trailing window, not the selected range", () => {
    // Big credit on 06-02 — inside the trailing 30 days, but outside a "Today" range.
    const txns = [makeTxn({ date: "2026-06-02", amount: 600000, description: "UPI IN" })];
    const todayRange: OwnerDateRange = {
      from: parseISO("2026-06-08"),
      to: parseISO("2026-06-08"),
    };
    const summary = computeOwnerOverview(txns, todayRange, TODAY);
    expect(summary.parkedNet).toBe(0); // nothing within "Today"
    expect(summary.maintainedParked).toBe(600000); // within trailing 30 days
    expect(summary.feeTier.ratePercent).toBe(0.3); // tier holds regardless of range
  });
});

describe("computeOwnerOverview – minimum balance + floor", () => {
  it("ignores blank balances and flags below the ₹1L floor", () => {
    const txns = [
      makeTxn({ date: "2026-06-02", amount: 1000, description: "UPI IN", balance: "150000" }),
      makeTxn({ date: "2026-06-03", amount: -500, description: "fee", balance: "" }),
      makeTxn({ date: "2026-06-04", amount: 1000, description: "UPI IN", balance: "345.07" }),
    ];

    const summary = computeOwnerOverview(txns, RANGE, TODAY);

    expect(summary.minimumBalance).toBe(345.07);
    expect(summary.belowFloor).toBe(true);
  });

  it("does not flag when every balance stays at or above the floor", () => {
    const txns = [
      makeTxn({ date: "2026-06-02", amount: 1000, description: "UPI IN", balance: "150000" }),
      makeTxn({ date: "2026-06-03", amount: 1000, description: "UPI IN", balance: "200000" }),
    ];

    const summary = computeOwnerOverview(txns, RANGE, TODAY);

    expect(summary.minimumBalance).toBe(150000);
    expect(summary.belowFloor).toBe(false);
  });

  it("returns null minimum when no row carries a balance", () => {
    const txns = [makeTxn({ date: "2026-06-02", amount: 1000, description: "UPI IN" })];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.minimumBalance).toBeNull();
    expect(summary.belowFloor).toBe(false);
  });
});

describe("computeOwnerOverview – range filter, daily buckets, signed-amount fallback", () => {
  it("excludes transactions outside the range from totals", () => {
    const txns = [
      makeTxn({ date: "2026-06-03", amount: 1000, description: "UPI IN" }),
      makeTxn({ date: "2026-05-01", amount: 9999, description: "UPI IN" }), // before range
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.creditTotal).toBe(1000);
  });

  it("buckets multiple same-day transactions together", () => {
    const txns = [
      makeTxn({ date: "2026-06-03", amount: 1000, description: "UPI IN" }),
      makeTxn({ date: "2026-06-03", amount: 500, description: "UPI IN" }),
      makeTxn({ date: "2026-06-03", amount: -200, description: "fee" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    const day = summary.dailyCreditDebit.find((p) => p.date === "2026-06-03");
    expect(day).toEqual({ date: "2026-06-03", credit: 1500, debit: 200 });
  });

  it("derives a signed amount from credit/debit columns when amount is blank", () => {
    const txns = [
      makeTxn({ date: "2026-06-02", amount: null, credit: "1200", description: "UPI IN" }),
      makeTxn({ date: "2026-06-03", amount: null, debit: "300", description: "payout" }),
    ];
    const summary = computeOwnerOverview(txns, RANGE, TODAY);
    expect(summary.creditTotal).toBe(1200);
    expect(summary.payoutTotal).toBe(300);
  });
});
