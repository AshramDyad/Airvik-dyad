"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import type { DonationReceipt } from "@/lib/donations/receipt-storage";
import { getDonationReceipt } from "@/lib/donations/receipt-storage";

type DonationSuccessCardProps = {
  donationId: string;
  fallbackCurrency: string;
};

export function DonationSuccessCard({ donationId, fallbackCurrency }: DonationSuccessCardProps) {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "missing";
    receipt?: DonationReceipt;
  }>({ status: "loading" });

  useEffect(() => {
    const receipt = getDonationReceipt(donationId);
    if (receipt) {
      setState({ status: "ready", receipt });
    } else {
      setState({ status: "missing" });
    }
  }, [donationId]);

  if (state.status === "loading") {
    return (
      <div className="rounded-3xl border border-border bg-white/80 p-8 shadow">
        <p className="text-center text-sm text-muted-foreground">Preparing your receipt…</p>
      </div>
    );
  }

  if (state.status === "missing" || !state.receipt) {
    return (
      <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-center">
        <p className="text-sm text-destructive">We couldn’t locate the receipt details for this donation.</p>
        <p className="mt-2 text-xs text-destructive/80">
          Please check your email for the official Razorpay receipt or contact seva@sahajanand.org with your
          payment reference.
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <a href="/donate">Return to donations</a>
        </Button>
      </div>
    );
  }

  const receipt = state.receipt;
  const resolvedCurrency = receipt.currency || fallbackCurrency;
  const frequencyLabel = receipt.frequency === "monthly" ? "Monthly" : "One-time";
  const formattedAmount = formatCurrency(receipt.amountInMinor / 100, resolvedCurrency);

  return (
    <div className="rounded-3xl border border-border bg-white/90 p-8 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Thank you</p>
      <h1 className="mt-3 text-3xl font-serif font-bold text-foreground">Your kindness sustains the ashram</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A receipt has been emailed to {receipt.email ?? "your inbox"}. If you need to update details, write to
        seva@sahajanand.org with your Razorpay reference.
      </p>

      <dl className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <dt className="text-sm text-muted-foreground">Amount</dt>
          <dd className="text-xl font-semibold text-foreground">{formattedAmount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm text-muted-foreground">Frequency</dt>
          <dd className="font-medium text-foreground">{frequencyLabel}</dd>
        </div>
        {receipt.message && (
          <div>
            <dt className="text-sm text-muted-foreground">Message</dt>
            <dd className="mt-1 rounded-2xl bg-muted/60 p-3 text-sm text-foreground">{receipt.message}</dd>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Reference ID</span>
          <span className="font-mono">{receipt.paymentId ?? donationId}</span>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <a href="/donate">Make another donation</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/">Back to homepage</a>
        </Button>
      </div>
    </div>
  );
}
