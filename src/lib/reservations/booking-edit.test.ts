import { beforeEach, describe, expect, it } from "vitest";
import { buildGuest, buildRatePlan, buildReservation, buildRoom, buildRoomType, buildSeasonalPrice, resetBuilderSequences } from "@/test/builders";
import { bookingEditInputSchema, buildBookingEditPlan, createReservationEditSnapshot, type BookingEditInput } from "./booking-edit";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture(roomCount = 1, guests = 2) {
  const guest = buildGuest({ id: uuid(1) });
  const ratePlan = buildRatePlan({ id: uuid(2), name: "Standard Rate", price: 100 });
  const roomType = buildRoomType({ id: uuid(3), price: 100, maxOccupancy: 4 });
  const rooms = Array.from({ length: roomCount + 2 }, (_, index) => buildRoom({ id: uuid(100 + index), roomTypeId: roomType.id, roomNumber: index === 0 ? "206" : index === roomCount ? "210" : String(300 + index) }));
  const reservations = rooms.slice(0, roomCount).map((room, index) => {
    const adults = Math.floor(guests / roomCount) + (index < guests % roomCount ? 1 : 0);
    return buildReservation({ id: uuid(200 + index), bookingId: "A9469", guestId: guest.id, roomId: room.id, ratePlanId: ratePlan.id, adultCount: adults, childCount: 0, numberOfGuests: adults, checkInDate: "2026-10-01", checkOutDate: "2026-10-03", totalAmount: 200, notes: undefined, status: "Confirmed" });
  });
  const input: BookingEditInput = { checkInDate: "2026-10-01", checkOutDate: "2026-10-03", adultCount: guests, childCount: 0, roomIds: reservations.map((row) => row.roomId), notes: null, customRates: {}, expectedReservations: createReservationEditSnapshot(reservations) };
  return { guest, ratePlan, roomType, rooms, reservations, input, primary: reservations[0], roomTypes: [roomType], ratePlans: [ratePlan], seasonalPrices: [] };
}

describe("booking edit", () => {
  beforeEach(resetBuilderSequences);

  it("keeps all 37 reservation IDs when swapping 206 for 210 and preserves 90 guests", () => {
    const f = fixture(37, 90);
    f.input.roomIds = [...f.input.roomIds.slice(1), f.rooms[37].id];
    const plan = buildBookingEditPlan(f);
    expect(plan.assignments).toHaveLength(37);
    expect(new Set(plan.assignments.map((row) => row.reservationId))).toEqual(new Set(f.reservations.map((row) => row.id)));
    expect(plan.assignments.find((row) => row.roomId === f.rooms[37].id)?.reservationId).toBe(f.reservations[0].id);
    expect(plan.assignments.reduce((sum, row) => sum + row.numberOfGuests, 0)).toBe(90);
    expect(plan.cancelIds).toEqual([]);
    expect(plan.assignments.filter((row) => {
      const before = f.reservations.find((reservation) => reservation.id === row.reservationId);
      return before?.roomId !== row.roomId || before.adultCount !== row.adultCount;
    }).length).toBeLessThan(37);
  });

  it("keeps unchanged values for a no-change save", () => {
    const f = fixture(3, 7);
    expect(buildBookingEditPlan(f).assignments).toEqual(f.reservations.map((row) => ({ reservationId: row.id, roomId: row.roomId, adultCount: row.adultCount, childCount: row.childCount, numberOfGuests: row.numberOfGuests, totalAmount: row.totalAmount })));
  });

  it("creates extras and cancels only leftover rows without deleting existing IDs", () => {
    const f = fixture(2, 4);
    f.input.roomIds.push(f.rooms[2].id);
    expect(buildBookingEditPlan(f).assignments.filter((row) => row.reservationId === null)).toHaveLength(1);
    f.input.roomIds = [f.rooms[0].id];
    expect(buildBookingEditPlan(f).cancelIds).toEqual([f.reservations[1].id]);
  });

  it("uses the current price helpers for seasons, custom rates and saved tax", () => {
    const f = fixture();
    f.reservations[0].taxEnabledSnapshot = true;
    f.reservations[0].taxRateSnapshot = 0.12;
    const seasonalPrices = [buildSeasonalPrice({ roomTypeId: f.roomType.id, price: 150, startDate: "2026-10-01", endDate: "2026-10-31" })];
    expect(buildBookingEditPlan({ ...f, seasonalPrices }).assignments[0].totalAmount).toBe(300);
    f.input.customRates[f.roomType.id] = 80;
    const plan = buildBookingEditPlan({ ...f, seasonalPrices });
    expect(plan.assignments[0].totalAmount).toBe(160);
    expect(plan.taxEnabledSnapshot).toBe(true);
    expect(plan.taxRateSnapshot).toBe(0.12);
  });

  it("chooses the existing default rate plan for imported bookings", () => {
    const f = fixture();
    f.primary.ratePlanId = null;
    expect(buildBookingEditPlan(f).ratePlanId).toBe(f.ratePlan.id);
  });

  it("keeps gateway creation and confirmation rules", () => {
    const f = fixture();
    f.primary.paymentMethod = "UPI Gateway";
    const plan = buildBookingEditPlan(f);
    expect(plan.newRoomStatus).toBe("Room Hold");
    expect(plan.confirmNewRooms).toBe(true);
  });

  it("detects changed booking membership and insufficient room capacity", () => {
    const f = fixture(2, 5);
    expect(() => buildBookingEditPlan({ ...f, reservations: [f.primary] })).toThrow("booking changed");
    f.input.roomIds = [f.rooms[0].id];
    expect(() => buildBookingEditPlan(f)).toThrow("cannot accommodate");
  });

  it.each([
    { adultCount: 1.5 }, { adultCount: -1 }, { adultCount: 0, childCount: 0 },
    { checkInDate: "2026-02-30" }, { checkOutDate: "2026-09-30" },
    { roomIds: [uuid(100), uuid(100)] }, { notes: "x".repeat(501) },
    { customRates: { [uuid(3)]: 0 } }, { actorId: uuid(1) },
  ])("rejects invalid or untrusted request values: %j", (changes) => {
    expect(bookingEditInputSchema.safeParse({ ...fixture().input, ...changes }).success).toBe(false);
  });
});
