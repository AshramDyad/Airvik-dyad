import type { RatePlan, Reservation, Room, RoomType, SeasonalPrice } from "@/data/types";
import { calculateRoomPricing, type RoomPricingOverrides } from "@/lib/pricing-calculator";

const MONEY_TOLERANCE = 0.01;

type ReservationPricingSource = Pick<Reservation, "roomId" | "totalAmount">;
type RoomPricingSource = Pick<Room, "id" | "roomTypeId">;

export function deriveSavedCustomNightlyRates({
  reservations,
  rooms,
  roomTypes,
  ratePlan,
  seasonalPrices,
  stayNights,
  checkInDate,
}: {
  reservations: ReservationPricingSource[];
  rooms: RoomPricingSource[];
  roomTypes: RoomType[];
  ratePlan?: RatePlan | null;
  seasonalPrices: SeasonalPrice[];
  stayNights: number;
  checkInDate?: string;
}): RoomPricingOverrides {
  if (!stayNights || stayNights <= 0) {
    return {};
  }

  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const roomTypeById = new Map(roomTypes.map((roomType) => [roomType.id, roomType]));
  const rates = new Map<string, number>();

  reservations.forEach((reservation) => {
    if (!reservation.totalAmount || reservation.totalAmount <= 0) {
      return;
    }

    const room = roomById.get(reservation.roomId);
    const roomType = room ? roomTypeById.get(room.roomTypeId) : undefined;
    if (!roomType) {
      return;
    }

    const savedNightlyRate = reservation.totalAmount / stayNights;
    if (savedNightlyRate <= 0) {
      return;
    }

    const normalPricing = calculateRoomPricing({
      roomType,
      ratePlan,
      nights: 1,
      rooms: 1,
      seasonalPrices,
      checkInDate,
    });

    if (Math.abs(savedNightlyRate - normalPricing.nightlyRate) > MONEY_TOLERANCE) {
      rates.set(roomType.id, savedNightlyRate);
    }
  });

  return Object.fromEntries(rates);
}
