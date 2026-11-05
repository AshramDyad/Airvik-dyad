import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";
import { bookingEditInputSchema, bookingEditDbResultSchema, BookingEditError } from "@/lib/reservations/booking-edit";
import { prepareBookingEdit } from "@/server/reservations/booking-edit";
import { RESERVATIONS_CACHE_TAG, RESERVATIONS_COUNT_CACHE_TAG } from "@/server/reservations/cache";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  let rpcDispatched = false;
  try {
    const actor = await requirePermission(request, "update:reservation");
    const { id } = await params;
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) throw new HttpError(400, "Invalid reservation ID.");
    const reservationId = parsedId.data;
    let rawInput: unknown;
    try { rawInput = await request.json(); } catch { throw new HttpError(400, "Invalid request body."); }
    const parsedInput = bookingEditInputSchema.safeParse(rawInput);
    if (!parsedInput.success) throw new HttpError(400, "Invalid booking values.");
    const input = parsedInput.data;
    const plan = await prepareBookingEdit(reservationId, input);
    if (plan.assignments.some((row) => row.reservationId === null) && !actor.permissions.includes("create:reservation")) throw new HttpError(403, "Creating additional rooms requires reservation create permission.");
    rpcDispatched = true;
    const { data, error } = await createServerSupabaseClient().rpc("save_booking_edit", {
      p_reservation_id: reservationId, p_actor_user_id: actor.userId, p_expected: input.expectedReservations, p_plan: plan,
    });
    if (error) {
      if (!error.code) throw new BookingEditError("Couldn't confirm the save. Check the booking before trying again.", 500, "SAVE_UNCONFIRMED");
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 400 : ["PT409", "40001", "23P01", "40P01", "55P03"].includes(error.code) ? 409 : 500;
      throw new BookingEditError(error.message, status, error.code);
    }
    const rawResult: unknown = data;
    const result = bookingEditDbResultSchema.parse(rawResult);
    try {
      revalidateTag(RESERVATIONS_CACHE_TAG);
      revalidateTag(RESERVATIONS_COUNT_CACHE_TAG);
    } catch (error) {
      // The transaction already committed. Never present cache failure as save failure.
      console.error("[BookingEdit] Cache refresh failed", { bookingId: result.bookingId, error });
    }
    console.info("[BookingEdit] Saved", { bookingId: result.bookingId, durationMs: Date.now() - startedAt });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof HttpError || error instanceof BookingEditError) return NextResponse.json({ message: error.message, code: error instanceof BookingEditError ? error.code : "REQUEST_DENIED" }, { status: error.status });
    console.error("[BookingEdit] Save failed", { durationMs: Date.now() - startedAt, error });
    if (rpcDispatched) return NextResponse.json({ message: "Couldn't confirm the save. Check the booking before trying again.", code: "SAVE_UNCONFIRMED" }, { status: 500 });
    return NextResponse.json({ message: "Could not save the booking. Please reload and try again.", code: "SAVE_FAILED" }, { status: 500 });
  }
}
