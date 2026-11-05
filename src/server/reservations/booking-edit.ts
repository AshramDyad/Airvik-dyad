import "server-only";
import { z } from "zod";
import type { RatePlan, Room, RoomType, SeasonalPrice } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { BookingEditError, buildBookingEditPlan, type BookingEditInput } from "@/lib/reservations/booking-edit";
import { dbReservationSchema, fromDbReservation } from "@/lib/reservations/reservation-mappers";
import { isActiveReservationStatus } from "@/lib/reservations/status";

const roomSchema = z.object({ id: z.string().uuid(), room_number: z.string(), room_type_id: z.string().uuid(), status: z.enum(["Clean", "Dirty", "Inspected", "Maintenance"]) });
const typeSchema = z.object({ id: z.string().uuid(), name: z.string(), max_occupancy: z.number(), price: z.number().nullable() });
const rateSchema = z.object({ id: z.string().uuid(), name: z.string(), price: z.number().nullable() });
const seasonalSchema = z.object({ id: z.string().uuid(), room_type_id: z.string().uuid(), name: z.string().nullable(), price: z.number(), start_date: z.string(), end_date: z.string() });

export async function prepareBookingEdit(reservationId: string, input: BookingEditInput) {
  const supabase = createServerSupabaseClient();
  const primaryResult = await supabase.from("reservations").select("*").eq("id", reservationId).maybeSingle();
  if (primaryResult.error) throw primaryResult.error;
  const primaryRaw: unknown = primaryResult.data;
  if (!primaryRaw) throw new BookingEditError("Booking not found.", 404, "BOOKING_NOT_FOUND");
  const primary = fromDbReservation(dbReservationSchema.parse(primaryRaw));
  const [bookingResult, roomsResult, ratesResult, seasonsResult] = await Promise.all([
    supabase.from("reservations").select("*").eq("booking_id", primary.bookingId).order("check_in_date"),
    supabase.from("rooms").select("id,room_number,room_type_id,status").in("id", input.roomIds),
    supabase.from("rate_plans").select("id,name,price"),
    supabase.from("seasonal_prices").select("id,room_type_id,name,price,start_date,end_date").order("start_date"),
  ]);
  for (const result of [bookingResult, roomsResult, ratesResult, seasonsResult]) if (result.error) throw result.error;
  const bookingRaw: unknown = bookingResult.data;
  const roomsRaw: unknown = roomsResult.data;
  const ratesRaw: unknown = ratesResult.data;
  const seasonsRaw: unknown = seasonsResult.data;
  const reservations = z.array(dbReservationSchema).parse(bookingRaw).map(fromDbReservation);
  const rooms: Room[] = z.array(roomSchema).parse(roomsRaw).map((row) => ({ id: row.id, roomNumber: row.room_number, roomTypeId: row.room_type_id, status: row.status }));
  const typesResult = await supabase.from("room_types").select("id,name,max_occupancy,price").in("id", [...new Set(rooms.map((row) => row.roomTypeId))]);
  if (typesResult.error) throw typesResult.error;
  const typesRaw: unknown = typesResult.data;
  const roomTypes: RoomType[] = z.array(typeSchema).parse(typesRaw).map((row) => ({ id: row.id, name: row.name, maxOccupancy: row.max_occupancy, price: row.price ?? 0, description: "", bedTypes: [], amenities: [], photos: [], isVisible: true }));
  const ratePlans: RatePlan[] = z.array(rateSchema).parse(ratesRaw).map((row) => ({ ...row, price: row.price ?? 0, rules: { minStay: 1, cancellationPolicy: "" } }));
  const seasonalPrices: SeasonalPrice[] = z.array(seasonalSchema).parse(seasonsRaw).map((row) => ({ id: row.id, roomTypeId: row.room_type_id, name: row.name ?? "", price: row.price, startDate: row.start_date, endDate: row.end_date }));
  const editablePrimary = isActiveReservationStatus(primary.status) ? primary : reservations.find((row) => isActiveReservationStatus(row.status));
  if (!editablePrimary) throw new BookingEditError("This booking has no active rooms to edit.", 409, "STALE_BOOKING");
  return buildBookingEditPlan({ primary: editablePrimary, reservations, input, rooms, roomTypes, ratePlans, seasonalPrices });
}
