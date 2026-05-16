import type { RatePlan, Room, RoomType, SeasonalPrice } from "@/data/types";

export type AdminReservationFormData = {
  rooms: Room[];
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  seasonalPrices: SeasonalPrice[];
};

export function createEmptyAdminReservationFormData(): AdminReservationFormData {
  return {
    rooms: [],
    roomTypes: [],
    ratePlans: [],
    seasonalPrices: [],
  };
}
