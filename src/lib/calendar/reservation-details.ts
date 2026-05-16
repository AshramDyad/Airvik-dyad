import type { ReservationStatus } from "@/data/types";

export type CalendarReservationDetail = {
  id: string;
  bookingId: string;
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  status: ReservationStatus;
  bookingDate: string;
  adultCount: number;
  childCount: number;
  guestSnapshot: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  roomNumber?: string;
  roomTypeName?: string;
};

export type CalendarReservationDetailsResponse = {
  data: CalendarReservationDetail[];
};
