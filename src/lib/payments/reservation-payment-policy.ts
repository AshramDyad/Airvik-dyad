import type { ReservationPaymentMethod, ReservationStatus } from "@/data/types";

export const NEW_RESERVATION_PAYMENT_METHODS = [
  "UPI Gateway",
  "Cash",
] as const satisfies readonly ReservationPaymentMethod[];

export type NewReservationPaymentMethod =
  (typeof NEW_RESERVATION_PAYMENT_METHODS)[number];

export type RequiredPaymentReservationStatus = Extract<
  ReservationStatus,
  "Room Hold" | "Confirmed"
>;

export function isNewReservationPaymentMethod(
  method: ReservationPaymentMethod
): method is NewReservationPaymentMethod {
  return NEW_RESERVATION_PAYMENT_METHODS.includes(
    method as NewReservationPaymentMethod
  );
}

export function getRequiredReservationStatusForPayment(
  method: NewReservationPaymentMethod
): RequiredPaymentReservationStatus {
  return method === "UPI Gateway" ? "Room Hold" : "Confirmed";
}

export function isCashPaymentMethod(
  method: string | null | undefined
): method is "Cash" {
  return method === "Cash";
}

export function isGatewayPaymentMethod(
  method: string | null | undefined
): method is "UPI Gateway" {
  return method === "UPI Gateway";
}

export function normalizePaymentAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateReservationPaymentAmount(args: {
  amount: number;
  balanceDue: number;
}): string | null {
  const amount = normalizePaymentAmount(args.amount);
  const balanceDue = normalizePaymentAmount(args.balanceDue);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter a valid payment amount.";
  }

  if (balanceDue > 0 && amount > balanceDue) {
    return "Payment amount cannot be more than the balance due.";
  }

  return null;
}
