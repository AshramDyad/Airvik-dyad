import { z } from "zod";
import { differenceInDays, parseISO } from "date-fns";
import type { RatePlan, Reservation, Room, RoomType, SeasonalPrice } from "@/data/types";
import { calculateRoomPricing } from "@/lib/pricing-calculator";
import { isBookableRoom } from "@/lib/rooms";
import { buildRoomOccupancyAssignments } from "./guest-allocation";
import { isActiveReservationStatus } from "./status";
import { resolveReservationTaxConfig } from "./calculate-financials";
import { getNewRoomReservationStatusForPayment, shouldConfirmNewRoomsAfterGatewayEdit } from "@/lib/payments/reservation-payment-policy";
import { dbReservationSchema, reservationPaymentMethodSchema, reservationStatusSchema } from "./reservation-mappers";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date");
const countSchema = z.number().int().min(0).max(2147483647);

export const reservationEditSnapshotSchema = z.object({
  id: z.string().uuid(), roomId: z.string().uuid(), ratePlanId: z.string().uuid().nullable(),
  checkInDate: dateSchema, checkOutDate: dateSchema, adultCount: countSchema, childCount: countSchema,
  numberOfGuests: countSchema, notes: z.string().nullable(), totalAmount: z.number().finite(),
  taxEnabledSnapshot: z.boolean(), taxRateSnapshot: z.number().finite(), status: reservationStatusSchema,
  paymentMethod: reservationPaymentMethodSchema,
}).strict();
export type ReservationEditSnapshot = z.infer<typeof reservationEditSnapshotSchema>;

export const bookingEditInputSchema = z.object({
  checkInDate: dateSchema, checkOutDate: dateSchema, adultCount: countSchema, childCount: countSchema,
  roomIds: z.array(z.string().uuid()).min(1), notes: z.string().trim().max(500).nullable().default(null),
  customRates: z.record(z.string().uuid(), z.number().finite().positive()).default({}),
  expectedReservations: z.array(reservationEditSnapshotSchema).min(1),
}).strict().superRefine((value, ctx) => {
  if (value.checkOutDate <= value.checkInDate) ctx.addIssue({ code: "custom", path: ["checkOutDate"], message: "Check-out must be after check-in" });
  if (value.adultCount + value.childCount <= 0 || value.adultCount + value.childCount > 2147483647) ctx.addIssue({ code: "custom", path: ["adultCount"], message: "Select a valid guest count" });
  if (new Set(value.roomIds).size !== value.roomIds.length) ctx.addIssue({ code: "custom", path: ["roomIds"], message: "Rooms must be unique" });
  if (new Set(value.expectedReservations.map((row) => row.id)).size !== value.expectedReservations.length) ctx.addIssue({ code: "custom", path: ["expectedReservations"], message: "Reservation IDs must be unique" });
});
export type BookingEditInput = z.infer<typeof bookingEditInputSchema>;
export type BookingEditResult = { bookingId: string; reservations: Reservation[] };
export const bookingEditDbResultSchema = z.object({ bookingId: z.string(), reservations: z.array(dbReservationSchema).min(1) });

export class BookingEditError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "BookingEditError";
  }
}

export function createReservationEditSnapshot(reservations: Reservation[]): ReservationEditSnapshot[] {
  return reservations.filter((row) => isActiveReservationStatus(row.status)).map((row) => ({
    id: row.id, roomId: row.roomId, ratePlanId: row.ratePlanId ?? null, checkInDate: row.checkInDate, checkOutDate: row.checkOutDate,
    adultCount: row.adultCount, childCount: row.childCount, numberOfGuests: row.numberOfGuests,
    notes: row.notes ?? null, totalAmount: row.totalAmount, taxEnabledSnapshot: row.taxEnabledSnapshot,
    taxRateSnapshot: row.taxRateSnapshot, status: row.status, paymentMethod: row.paymentMethod,
  }));
}

export type BookingEditAssignment = {
  reservationId: string | null; roomId: string; adultCount: number; childCount: number; numberOfGuests: number; totalAmount: number;
};
export type BookingEditPlan = {
  bookingId: string; primaryReservationId: string; checkInDate: string; checkOutDate: string; notes: string | null; ratePlanId: string;
  taxEnabledSnapshot: boolean; taxRateSnapshot: number; adultCount: number; childCount: number;
  newRoomStatus: Reservation["status"]; confirmNewRooms: boolean;
  assignments: BookingEditAssignment[]; cancelIds: string[];
};

export function buildBookingEditPlan({ primary, reservations, input, rooms, roomTypes, ratePlans, seasonalPrices }: {
  primary: Reservation; reservations: Reservation[]; input: BookingEditInput; rooms: Room[];
  roomTypes: RoomType[]; ratePlans: RatePlan[]; seasonalPrices: SeasonalPrice[];
}): BookingEditPlan {
  const active = reservations.filter((row) => isActiveReservationStatus(row.status));
  if (!active.length) throw new BookingEditError("This booking has no active rooms to edit.", 409, "STALE_BOOKING");
  const byId = new Map(active.map((row) => [row.id, row]));
  const remaining = input.expectedReservations.map((row) => byId.get(row.id)).filter((row): row is Reservation => Boolean(row));
  if (remaining.length !== active.length || remaining.length !== input.expectedReservations.length) throw new BookingEditError("This booking changed. Reload it before saving.", 409, "STALE_BOOKING");
  const ratePlan = primary.ratePlanId
    ? ratePlans.find((row) => row.id === primary.ratePlanId)
    : ratePlans.find((row) => row.name === "Standard Rate") ?? ratePlans[0];
  if (!ratePlan) throw new BookingEditError("No rate plan is available for this booking.", 400, "INVALID_BOOKING");
  const roomById = new Map(rooms.map((row) => [row.id, row]));
  const typeById = new Map(roomTypes.map((row) => [row.id, row]));
  const currentRooms = new Set(active.map((row) => row.roomId));
  let capacity = 0;
  for (const id of input.roomIds) {
    const room = roomById.get(id);
    const type = room && typeById.get(room.roomTypeId);
    if (!room || !type || (!isBookableRoom(room) && !currentRooms.has(id))) throw new BookingEditError("A selected room is not available for booking.", 409, "ROOM_UNAVAILABLE");
    capacity += type.maxOccupancy;
  }
  if (capacity < input.adultCount + input.childCount) throw new BookingEditError("Selected rooms cannot accommodate this guest count.", 400, "INVALID_BOOKING");
  const matches = new Map<string, Reservation>();
  for (const roomId of input.roomIds) {
    const index = remaining.findIndex((row) => row.roomId === roomId);
    if (index !== -1) matches.set(roomId, remaining.splice(index, 1)[0]);
  }
  const occupancies = buildRoomOccupancyAssignments(input.roomIds, input.adultCount, input.childCount);
  const nights = differenceInDays(parseISO(input.checkOutDate), parseISO(input.checkInDate));
  const tax = resolveReservationTaxConfig(byId.get(input.expectedReservations[0].id) ?? primary);
  const assignments = input.roomIds.map((roomId, index): BookingEditAssignment => {
    const existing = matches.get(roomId) ?? remaining.shift();
    const room = roomById.get(roomId);
    const roomType = room && typeById.get(room.roomTypeId);
    const occupancy = occupancies[index];
    return {
      reservationId: existing?.id ?? null, roomId, adultCount: occupancy.adults, childCount: occupancy.children,
      numberOfGuests: occupancy.adults + occupancy.children,
      totalAmount: Math.round(calculateRoomPricing({ roomType, ratePlan, nights, checkInDate: input.checkInDate, seasonalPrices, nightlyRateOverride: roomType ? input.customRates[roomType.id] : undefined }).totalCost * 100) / 100,
    };
  });
  return {
    bookingId: primary.bookingId, primaryReservationId: primary.id, checkInDate: input.checkInDate, checkOutDate: input.checkOutDate, notes: input.notes || null,
    ratePlanId: ratePlan.id, taxEnabledSnapshot: tax.enabled, taxRateSnapshot: tax.enabled ? tax.percentage : 0,
    adultCount: input.adultCount, childCount: input.childCount,
    newRoomStatus: getNewRoomReservationStatusForPayment({ paymentMethod: primary.paymentMethod, currentStatus: primary.status }),
    confirmNewRooms: shouldConfirmNewRoomsAfterGatewayEdit({ paymentMethod: primary.paymentMethod, currentStatus: primary.status }),
    assignments, cancelIds: remaining.map((row) => row.id),
  };
}
