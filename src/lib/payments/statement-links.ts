// One incoming statement transaction (identified by its bank reference) that has been
// recorded as a UPI Gateway payment on a booking — auto-matched or manually attached.
export type StatementBookingLink = {
  reference: string;
  reservationId: string;
  bookingId: string | null;
  // The folio row this link came from — the row an unattach deletes.
  folioItemId: string;
  // Only payments recorded by the Attach button can be unattached. Auto-matched
  // rows would be re-attached by the background reconcile, and legacy admin
  // overrides are not statement attachments at all.
  canUnattach: boolean;
};
