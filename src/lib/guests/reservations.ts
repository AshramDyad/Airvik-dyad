import type { ReservationStatus } from "@/data/types";

export type GuestReservationSummary = {
  id: string;
  bookingId: string;
  roomId: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string;
};

export type GuestReservationsResponse = {
  data: GuestReservationSummary[];
};
