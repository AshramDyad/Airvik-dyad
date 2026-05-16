import type { ReservationStatus } from "@/data/types";

export type ReportReservation = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  totalAmount: number;
};

export type ReportReservationsResponse = {
  data: ReportReservation[];
  roomsForSaleCount: number;
};
