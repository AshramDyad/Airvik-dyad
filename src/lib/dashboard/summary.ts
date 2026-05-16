import type { ReservationStatus } from "@/data/types";

export type DashboardSummaryRow = {
  id: string;
  guestName: string;
  guestEmail?: string;
  roomNumber: string;
  status: ReservationStatus;
};

export type DashboardSummaryPayload = {
  occupancyPercentage: number;
  occupiedRoomsCount: number;
  availableRooms: number;
  arrivalsRows: DashboardSummaryRow[];
  departuresRows: DashboardSummaryRow[];
  roomsForSaleCount: number;
};

export type DashboardSummaryResponse = {
  data: DashboardSummaryPayload;
};

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummaryPayload = {
  occupancyPercentage: 0,
  occupiedRoomsCount: 0,
  availableRooms: 0,
  arrivalsRows: [],
  departuresRows: [],
  roomsForSaleCount: 0,
};
