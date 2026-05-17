import type { ReservationPaymentRequestStatus } from "@/data/types";

const ALLOWED_STATUSES: ReadonlySet<ReservationPaymentRequestStatus> = new Set([
  "requested",
  "partially_paid",
  "paid",
  "expired",
  "cancelled",
]);

export const normalizeReservationPaymentRequestStatus = (
  status: string,
  expiresAt: string | null | undefined,
  now = Date.now()
): ReservationPaymentRequestStatus => {
  const normalizedStatus = ALLOWED_STATUSES.has(status as ReservationPaymentRequestStatus)
    ? (status as ReservationPaymentRequestStatus)
    : ("cancelled" as ReservationPaymentRequestStatus);

  if (
    normalizedStatus !== "requested" &&
    normalizedStatus !== "partially_paid"
  ) {
    return normalizedStatus;
  }

  if (!expiresAt) {
    return normalizedStatus;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return normalizedStatus;
  }

  return expiresAtMs <= now ? "expired" : normalizedStatus;
};
