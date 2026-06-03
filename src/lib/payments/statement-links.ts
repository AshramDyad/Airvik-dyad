// One incoming statement transaction (identified by its bank reference) that has been
// recorded as a UPI Gateway payment on a booking — auto-matched or manually attached.
export type StatementBookingLink = {
  reference: string;
  reservationId: string;
  bookingId: string | null;
};
