import type { FolioItem } from "@/data/types";

// A booking is several room reservations sharing one booking_id. Each room's
// payments live in its folio (folio items with a negative amount). When a room
// is removed from a booking during an edit, the room's reservation is soft-
// cancelled — but the money already paid belongs to the whole booking and must
// not be stranded on the removed room.
//
// This helper collects the PAYMENT folio rows from the rooms being removed so
// the caller can re-home them onto a surviving room. Charges (positive amounts)
// belong to the removed room and are intentionally left behind. Each entry also
// records the room it came from, so the move can be reverted if the edit fails.

type ReservationWithFolio = { id: string; folio?: FolioItem[] | null };

export interface FolioReassignment {
  folioItemId: string;
  fromReservationId: string;
}

export function collectPaymentFolioToReassign(
  removedReservations: readonly ReservationWithFolio[]
): FolioReassignment[] {
  const reassignments: FolioReassignment[] = [];
  for (const reservation of removedReservations) {
    for (const item of reservation.folio ?? []) {
      if (item.amount < 0) {
        reassignments.push({
          folioItemId: item.id,
          fromReservationId: reservation.id,
        });
      }
    }
  }
  return reassignments;
}
