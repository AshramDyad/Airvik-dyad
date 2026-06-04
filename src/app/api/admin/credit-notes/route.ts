import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";
import type { CreditNote, CreditNoteStatus } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body sent when issuing a credit note for a cancelled booking.
const IssueCreditNoteSchema = z.object({
  bookingId: z.string().trim().min(1),
  guestId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  notes: z.string().trim().max(500).optional(),
});

type DbCreditNoteRow = {
  id: string;
  guest_id: string;
  source_booking_id: string;
  original_amount: number | string;
  remaining_amount: number | string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DbReservationRow = {
  id: string;
  guest_id: string;
};

type DbFolioRow = {
  amount: number | string;
  external_source: string | null;
};

// POST /api/admin/credit-notes
// Issue a credit note. The amount can never exceed what the guest actually
// paid for the booking; that cap is recomputed here on the server.
export async function POST(request: Request) {
  try {
    const profile = await requirePermission(request, "update:reservation");
    const payload = IssueCreditNoteSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    // 1) Find the reservations for this booking (multi-room bookings share a
    //    bookingId). We do NOT filter out cancelled rows here: issuing happens
    //    on a cancelled booking, so its payments must still count.
    const { data: reservationRows, error: reservationError } = await supabase
      .from("reservations")
      .select("id, guest_id")
      .eq("booking_id", payload.bookingId);

    if (reservationError) {
      throw new Error(reservationError.message);
    }

    const reservations = (reservationRows ?? []) as DbReservationRow[];
    if (reservations.length === 0) {
      return noStoreJson({ message: "Booking not found." }, { status: 404 });
    }

    const guestId = reservations[0].guest_id;
    const reservationIds = reservations.map((row) => row.id);

    // 2) Sum the money actually received for the booking. A payment is a folio
    //    item with a negative amount. We exclude credit-funded payments so
    //    spent credit can never be re-minted into a new credit note.
    const { data: folioRows, error: folioError } = await supabase
      .from("folio_items")
      .select("amount, external_source")
      .in("reservation_id", reservationIds);

    if (folioError) {
      throw new Error(folioError.message);
    }

    const received = (folioRows ?? []).reduce((sum: number, row: DbFolioRow) => {
      if (row.external_source === "credit_redemption") {
        return sum;
      }
      const amount = readMoney(row.amount);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    const receivedRounded = roundMoney(received);
    const amount = roundMoney(payload.amount);

    if (amount > receivedRounded) {
      return noStoreJson(
        {
          message: `Credit amount cannot exceed the amount received (${receivedRounded}).`,
        },
        { status: 409 }
      );
    }

    // 3) Create the credit note. The UNIQUE(source_booking_id) constraint
    //    rejects a second note for the same booking (also stops double-clicks).
    const { data: inserted, error: insertError } = await supabase
      .from("credit_notes")
      .insert({
        guest_id: guestId,
        source_booking_id: payload.bookingId,
        original_amount: amount,
        remaining_amount: amount,
        status: "active",
        notes: payload.notes ?? null,
        created_by: profile.userId,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return noStoreJson(
          { message: "A credit note already exists for this booking." },
          { status: 409 }
        );
      }
      throw new Error(insertError.message);
    }

    return noStoreJson(
      { creditNote: mapCreditNote(inserted as DbCreditNoteRow) },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/admin/credit-notes?guestId=...
// List a guest's credit notes (active and redeemed) for the apply dialog and
// the guest profile.
export async function GET(request: Request) {
  try {
    await requirePermission(request, "read:payment");
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId")?.trim();

    if (!guestId) {
      return noStoreJson({ message: "guestId is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("credit_notes")
      .select("*")
      .eq("guest_id", guestId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const creditNotes = (data ?? []).map((row) =>
      mapCreditNote(row as DbCreditNoteRow)
    );
    return noStoreJson({ creditNotes });
  } catch (error) {
    return handleApiError(error);
  }
}

function mapCreditNote(row: DbCreditNoteRow): CreditNote {
  return {
    id: row.id,
    guestId: row.guest_id,
    sourceBookingId: row.source_booking_id,
    originalAmount: readMoney(row.original_amount),
    remainingAmount: readMoney(row.remaining_amount),
    status: normalizeStatus(row.status),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeStatus(status: string): CreditNoteStatus {
  return status === "redeemed" ? "redeemed" : "active";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function readMoney(value: number | string): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return noStoreJson(
      { message: "Invalid credit note request.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson({ message: "Unable to process credit note." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}
