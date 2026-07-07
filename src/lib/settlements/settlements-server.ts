import "server-only";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { fetchGoogleSheetTransactions } from "@/lib/google-sheets/transactions";
import { computeOwnerOverview } from "@/lib/owner-overview/compute";
import { getStatementBookingLinks } from "@/lib/payments/statement-links-server";
import { formatBookingCode } from "@/lib/reservations/formatting";
import { allocatePayouts } from "./allocate";
import type { PayoutAllocationLine, SettlementView } from "./types";

// A settled credit's booking code / receipt number is looked up by its bank reference.
type LabelMaps = {
  bookings: Map<string, string>; // reference (lowercased) -> booking code
  receipts: Map<string, number>; // reference (lowercased) -> receipt slip number
};

type DbReceiptRow = {
  slip_no: number;
  transaction_id: string | null;
};

function refKey(reference: string): string {
  return reference.trim().toLowerCase();
}

/**
 * Assemble the Settlements view: read the bank sheet, compute the full settled + payout
 * pools (owner-overview compute, called with an all-time range so nothing is sliced off),
 * FIFO-allocate payouts to settled bookings, then label each line with its booking code or
 * manual-receipt number. All reads are over existing helpers; nothing is written.
 */
export async function getSettlementView(): Promise<SettlementView> {
  const supabase = createServerSupabaseClient();

  const [payload, links, receipts] = await Promise.all([
    fetchGoogleSheetTransactions(),
    getStatementBookingLinks({ supabase }),
    loadReceiptSlips(supabase),
  ]);

  // All-time range so we get every settled credit and every payout (FIFO needs the full
  // history for the carry-forward and Outstanding figures to be correct).
  const summary = computeOwnerOverview(
    payload.rows,
    { from: new Date(0), to: new Date() },
    new Date(),
  );

  const labels: LabelMaps = { bookings: new Map(), receipts };
  for (const link of links) {
    if (link.bookingId) {
      labels.bookings.set(refKey(link.reference), formatBookingCode(link.bookingId));
    }
  }

  const view = allocatePayouts(summary.settled, summary.payouts);
  return {
    payouts: view.payouts.map((payout) => ({
      ...payout,
      lines: payout.lines.map((line) => labelLine(line, labels)),
    })),
    summary: {
      ...view.summary,
      pendingLines: view.summary.pendingLines.map((line) => labelLine(line, labels)),
    },
  };
}

async function loadReceiptSlips(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("manual_receipts")
    .select("slip_no, transaction_id");

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, number>();
  for (const row of (data ?? []) as unknown as DbReceiptRow[]) {
    const reference = row.transaction_id?.trim();
    if (reference) {
      map.set(refKey(reference), row.slip_no);
    }
  }
  return map;
}

function labelLine(line: PayoutAllocationLine, labels: LabelMaps): PayoutAllocationLine {
  const key = refKey(line.reference);
  return {
    ...line,
    bookingCode: labels.bookings.get(key) ?? null,
    receiptSlipNo: labels.receipts.get(key) ?? null,
  };
}
