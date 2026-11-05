import { z } from "zod";
import type { FolioItem, Reservation } from "@/data/types";

export const reservationStatusSchema = z.enum([
  "Pending", "Room Hold", "Standby", "Confirmed", "Checked-in", "Checked-out", "Cancelled", "No-show",
]);
export const reservationPaymentMethodSchema = z.enum([
  "Not specified", "Bank/IMPS", "Cash", "UPI", "UPI Gateway", "Bhagat Ji", "Anurag Ji",
]);

const dbFolioItemSchema = z.object({
  id: z.string(), reservation_id: z.string(), description: z.string(), amount: z.number().finite(),
  timestamp: z.string(), payment_method: z.string().nullable(), transaction_id: z.string().nullable(),
  external_source: z.string().nullable(), external_reference: z.string().nullable(),
  external_metadata: z.record(z.unknown()).nullable(), received_by: z.string().nullable(), received_at: z.string().nullable(),
});

export const dbReservationSchema = z.object({
  id: z.string(), booking_id: z.string(), guest_id: z.string(), room_id: z.string(),
  rate_plan_id: z.string().nullable(), check_in_date: z.string(), check_out_date: z.string(),
  number_of_guests: z.number(), status: reservationStatusSchema, notes: z.string().nullish(),
  folio: z.array(dbFolioItemSchema).nullish(), total_amount: z.number().finite(), booking_date: z.string(),
  source: z.enum(["website", "reception", "vikbooking"]),
  payment_method: reservationPaymentMethodSchema.nullable(), adult_count: z.number().nullable(), child_count: z.number().nullable(),
  hold_expires_at: z.string().nullable(), tax_enabled_snapshot: z.boolean().nullable(), tax_rate_snapshot: z.number().nullable(),
  external_source: z.string().nullable(), external_id: z.string().nullable(), external_metadata: z.record(z.unknown()).nullable(),
  guest: z.object({ first_name: z.string().nullable(), last_name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() }).nullish(),
});

export type DbFolioItem = z.infer<typeof dbFolioItemSchema>;
export type DbReservation = z.infer<typeof dbReservationSchema>;

export const fromDbFolioItem = (row: DbFolioItem): FolioItem => ({
  id: row.id, description: row.description, amount: Number(row.amount), timestamp: row.timestamp,
  paymentMethod: row.payment_method ?? undefined, transactionId: row.transaction_id ?? undefined,
  externalSource: row.external_source ?? undefined, externalReference: row.external_reference ?? undefined,
  externalMetadata: row.external_metadata ?? undefined, receivedBy: row.received_by ?? undefined, receivedAt: row.received_at ?? undefined,
});

// Shared with the existing API: the new save response uses the same UI shape.
export const fromDbReservation = (row: DbReservation): Reservation => ({
  id: row.id, bookingId: row.booking_id, guestId: row.guest_id, roomId: row.room_id,
  ratePlanId: row.rate_plan_id ?? null, checkInDate: row.check_in_date, checkOutDate: row.check_out_date,
  numberOfGuests: row.number_of_guests, status: row.status, notes: row.notes ?? undefined,
  folio: row.folio?.map(fromDbFolioItem) ?? [], totalAmount: row.total_amount, bookingDate: row.booking_date,
  source: row.source, paymentMethod: row.payment_method ?? "Not specified",
  adultCount: typeof row.adult_count === "number" ? row.adult_count : row.number_of_guests,
  childCount: typeof row.child_count === "number" ? row.child_count : 0, holdExpiresAt: row.hold_expires_at,
  taxEnabledSnapshot: Boolean(row.tax_enabled_snapshot ?? false), taxRateSnapshot: row.tax_rate_snapshot ?? 0,
  externalSource: row.external_source ?? undefined, externalId: row.external_id, externalMetadata: row.external_metadata ?? undefined,
  guestSnapshot: row.guest ? { firstName: row.guest.first_name, lastName: row.guest.last_name, email: row.guest.email, phone: row.guest.phone } : undefined,
});
