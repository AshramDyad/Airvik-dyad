import type { Reservation } from "@/data/types";
import {
  calculateReservationFinancials,
  resolveReservationTaxConfig,
} from "@/lib/reservations/calculate-financials";

/**
 * The fields each reservation must carry to compute its balance due. A website
 * booking can span several rooms (reservations sharing one `bookingId`); a single
 * UPI payment request covers the whole booking, so we sum every room's balance.
 */
export type BookingBalanceReservation = Pick<
  Reservation,
  "folio" | "totalAmount" | "taxEnabledSnapshot" | "taxRateSnapshot"
>;

/**
 * Total rupees still owed across an entire booking (rooms + taxes − payments).
 *
 * Each reservation carries its own tax snapshot, so tax is resolved per room via
 * `resolveReservationTaxConfig`. Already-paid or credited rooms contribute 0
 * (never a negative), and the result is rounded to paise so it is a clean amount
 * to hand to `createPaymentRequest` (which then adds its unique paise suffix).
 */
export function computeBookingBalanceDue(
  reservations: BookingBalanceReservation[]
): number {
  const total = reservations.reduce((sum, reservation) => {
    const taxConfig = resolveReservationTaxConfig(reservation);
    const { balance } = calculateReservationFinancials(reservation, taxConfig);
    return sum + Math.max(balance, 0);
  }, 0);

  return Math.round(total * 100) / 100;
}
