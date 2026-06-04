"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useDataContext } from "@/context/data-context";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { authorizedFetch } from "@/lib/auth/client-session";
import type { CreditNote } from "@/data/types";

// Money received for a booking = sum of payments (negative folio amounts),
// excluding credit-funded payments. This is the same rule the server uses to
// cap how much credit can be issued. The caller passes folio entries that are
// actually loaded (the reservation detail page hydrates folio for the viewed
// booking); the server recomputes the real cap regardless.
export function calculateReceivedForBooking(
  folioAmounts: Array<{ amount: number; externalSource?: string | null }>
): number {
  const total = folioAmounts.reduce((sum, item) => {
    if (item.externalSource === "credit_redemption") {
      return sum;
    }
    return item.amount < 0 ? sum + Math.abs(item.amount) : sum;
  }, 0);
  return Math.round(total * 100) / 100;
}

function readMessage(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Issue a credit note (shown on a cancelled booking)
// ---------------------------------------------------------------------------
interface IssueCreditNoteDialogProps {
  bookingId: string;
  guestId: string;
  // Amount already paid for this booking (computed by the caller from the
  // loaded folio). The server re-checks this cap, so this is for display only.
  received: number;
  children: React.ReactNode;
}

export function IssueCreditNoteDialog({
  bookingId,
  guestId,
  received,
  children,
}: IssueCreditNoteDialogProps) {
  const formatCurrency = useCurrencyFormatter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Default the amount to the full received amount each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setAmount(received > 0 ? String(received) : "");
      setNotes("");
    }
  }, [open, received]);

  const parsedAmount = Number(amount);
  const isAmountValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= received;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isAmountValid) {
      toast.error("Enter an amount between 0 and the received amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authorizedFetch("/api/admin/credit-notes", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          guestId,
          amount: parsedAmount,
          notes: notes.trim() ? notes.trim() : undefined,
        }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Failed to issue credit note.");
      }

      toast.success("Credit note issued.");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to issue credit note", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Credit Note</DialogTitle>
          <DialogDescription>
            Give the guest credit for this cancelled booking. The amount cannot be
            more than what they already paid.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Received on this booking: {formatCurrency(received)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-amount">Credit amount</Label>
            <Input
              id="credit-amount"
              type="number"
              step="0.01"
              min={0}
              max={received}
              value={amount}
              disabled={isSubmitting || received <= 0}
              onChange={(event) => setAmount(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Maximum {formatCurrency(received)}. Enter less to keep a cancellation fee.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-notes">Notes (optional)</Label>
            <Textarea
              id="credit-notes"
              rows={2}
              placeholder="Reason for this credit note"
              value={notes}
              disabled={isSubmitting}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
            <Button type="submit" disabled={isSubmitting || !isAmountValid}>
              {isSubmitting
                ? "Issuing..."
                : received <= 0
                  ? "Nothing received"
                  : "Issue Credit Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Apply (redeem) a credit note toward this reservation
// ---------------------------------------------------------------------------
interface ApplyCreditNoteDialogProps {
  reservationId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  balanceDue: number;
  children: React.ReactNode;
}

export function ApplyCreditNoteDialog({
  reservationId,
  guestId,
  guestName,
  guestPhone,
  balanceDue,
  children,
}: ApplyCreditNoteDialogProps) {
  const { refreshReservations, loadBookingDetails, notifyReservationsChanged } =
    useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [notes, setNotes] = React.useState<CreditNote[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");

  const selectedNote = React.useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const loadNotes = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authorizedFetch(
        `/api/admin/credit-notes?guestId=${encodeURIComponent(guestId)}`,
        { cache: "no-store" }
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Failed to load credit notes.");
      }
      const list =
        body && typeof body === "object" && "creditNotes" in body
          ? ((body as { creditNotes: CreditNote[] }).creditNotes ?? [])
          : [];
      // Only notes that still have money to use.
      setNotes(list.filter((note) => note.status === "active" && note.remainingAmount > 0));
    } catch (error) {
      toast.error("Failed to load credit notes", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [guestId]);

  React.useEffect(() => {
    if (open) {
      setSelectedId(null);
      setAmount("");
      void loadNotes();
    }
  }, [open, loadNotes]);

  // When a note is picked, default the amount to whatever covers the balance.
  React.useEffect(() => {
    if (selectedNote) {
      const suggested = Math.min(selectedNote.remainingAmount, Math.max(balanceDue, 0));
      setAmount(suggested > 0 ? String(Math.round(suggested * 100) / 100) : "");
    }
  }, [selectedNote, balanceDue]);

  const parsedAmount = Number(amount);
  const maxApplicable = selectedNote
    ? Math.min(selectedNote.remainingAmount, Math.max(balanceDue, 0))
    : 0;
  const isAmountValid =
    selectedNote !== null &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= maxApplicable;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedNote || !isAmountValid) {
      toast.error("Select a credit note and a valid amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authorizedFetch(
        `/api/admin/reservations/${reservationId}/redeem-credit-note`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creditNoteId: selectedNote.id,
            amount: parsedAmount,
          }),
        }
      );
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Failed to apply credit note.");
      }

      await refreshReservations();
      await loadBookingDetails(reservationId);
      notifyReservationsChanged({ reservationId });
      toast.success("Credit note applied.");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to apply credit note", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Credit Note</DialogTitle>
          <DialogDescription>
            Credit shown below belongs to{" "}
            <span className="font-medium text-foreground">{guestName}</span>
            {guestPhone ? ` (${guestPhone})` : ""}. Make sure this is the same guest.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Balance due: {formatCurrency(Math.max(balanceDue, 0))}
          </div>

          <div className="space-y-2">
            <Label>Available credit notes</Label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This guest has no available credit notes.
              </p>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedId(note.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                      selectedId === note.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:bg-muted/50"
                    )}
                  >
                    <span className="font-medium tabular-nums">
                      {formatCurrency(note.remainingAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      from booking {note.sourceBookingId}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedNote && (
            <div className="space-y-2">
              <Label htmlFor="apply-amount">Amount to apply</Label>
              <Input
                id="apply-amount"
                type="number"
                step="0.01"
                min={0}
                max={maxApplicable}
                value={amount}
                disabled={isSubmitting}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Up to {formatCurrency(maxApplicable)} (limited by the credit left and
                the balance due).
              </p>
            </div>
          )}

          <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
            <Button type="submit" disabled={isSubmitting || !isAmountValid}>
              {isSubmitting ? "Applying..." : "Apply Credit Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
