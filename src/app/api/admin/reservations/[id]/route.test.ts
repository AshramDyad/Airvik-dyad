import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { requirePermission, HttpError } from "@/lib/server/auth";
import { prepareBookingEdit } from "@/server/reservations/booking-edit";
import { BookingEditError, buildBookingEditPlan, createReservationEditSnapshot, type BookingEditInput } from "@/lib/reservations/booking-edit";
import { buildDbReservation, buildGuest, buildRatePlan, buildReservation, buildRoom, buildRoomType, resetBuilderSequences } from "@/test/builders";
import { PATCH } from "./route";

vi.mock("next/cache", async () => ({
  ...await vi.importActual<typeof import("next/cache")>("next/cache"),
  revalidateTag: vi.fn(),
}));
vi.mock("@/integrations/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/server/reservations/booking-edit", () => ({ prepareBookingEdit: vi.fn() }));
vi.mock("@/lib/server/auth", async () => ({
  ...await vi.importActual<typeof import("@/lib/server/auth")>("@/lib/server/auth"),
  requirePermission: vi.fn(),
}));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const guest = buildGuest({ id: uuid(1) });
  const roomType = buildRoomType({ id: uuid(2), maxOccupancy: 4, price: 100 });
  const room = buildRoom({ id: uuid(3), roomTypeId: roomType.id });
  const ratePlan = buildRatePlan({ id: uuid(4), price: 100 });
  const reservation = buildReservation({ id: uuid(5), bookingId: "A9469", guestId: guest.id, roomId: room.id, ratePlanId: ratePlan.id, checkInDate: "2026-10-01", checkOutDate: "2026-10-03", totalAmount: 200 });
  const input: BookingEditInput = { roomIds: [room.id], adultCount: 2, childCount: 0, checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate, notes: "Edited", customRates: {}, expectedReservations: createReservationEditSnapshot([reservation]) };
  const plan = buildBookingEditPlan({ primary: reservation, reservations: [reservation], rooms: [room], roomTypes: [roomType], ratePlans: [ratePlan], seasonalPrices: [], input });
  return { reservation, input, plan };
}
const request = (body: unknown) => new Request("http://localhost/api/admin/reservations/booking", { method: "PATCH", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = (id = uuid(5)) => ({ params: Promise.resolve({ id }) });
const rpc = vi.fn<(name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: PostgrestError | null }>>();

describe("atomic booking edit endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); resetBuilderSequences();
    vi.mocked(requirePermission).mockResolvedValue({ userId: uuid(10), roleName: "Reception", permissions: ["update:reservation", "create:reservation"] });
    const f = fixture();
    vi.mocked(prepareBookingEdit).mockResolvedValue(f.plan);
    rpc.mockResolvedValue({ data: { bookingId: f.reservation.bookingId, reservations: [buildDbReservation(f.reservation)] }, error: null });
    vi.mocked(createServerSupabaseClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createServerSupabaseClient>);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("makes one server-actor RPC and invalidates only after commit, returning canonical folios", async () => {
    const f = fixture();
    rpc.mockResolvedValueOnce({ data: { bookingId: f.reservation.bookingId, reservations: [buildDbReservation(f.reservation)] }, error: null });
    const response = await PATCH(request(f.input), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ bookingId: f.reservation.bookingId, reservations: [buildDbReservation(f.reservation)] });
    expect(requirePermission).toHaveBeenCalledWith(expect.objectContaining({ method: "PATCH" }), "update:reservation");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("save_booking_edit", { p_reservation_id: uuid(5), p_actor_user_id: uuid(10), p_expected: f.input.expectedReservations, p_plan: f.plan });
    expect(vi.mocked(revalidateTag).mock.invocationCallOrder[0]).toBeGreaterThan(rpc.mock.invocationCallOrder[0]);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])("rejects an unauthorized request (%i) without dispatching a write", async (status) => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new HttpError(status, "Denied"));
    expect((await PATCH(request(fixture().input), context())).status).toBe(status);
    expect(prepareBookingEdit).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs, guest counts and client-supplied actor IDs", async () => {
    const f = fixture();
    expect((await PATCH(request(f.input), context("bad-id"))).status).toBe(400);
    expect((await PATCH(request({ ...f.input, adultCount: 1.5 }), context())).status).toBe(400);
    expect((await PATCH(request({ ...f.input, actorId: uuid(99) }), context())).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before reading booking data", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/reservations/booking", { method: "PATCH", body: "{" }), context());
    expect(response.status).toBe(400); expect(prepareBookingEdit).not.toHaveBeenCalled();
  });

  it("does not use OR permissions to permit extra room creation", async () => {
    const f = fixture(); f.plan.assignments.push({ ...f.plan.assignments[0], reservationId: null, roomId: uuid(20) });
    vi.mocked(prepareBookingEdit).mockResolvedValueOnce(f.plan);
    vi.mocked(requirePermission).mockResolvedValueOnce({ userId: uuid(10), roleName: "Reception", permissions: ["update:reservation"] });
    expect((await PATCH(request(f.input), context())).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
  });

  it.each([["PT409", 409], ["40001", 409], ["23P01", 409], ["42501", 403], ["22023", 400], ["P0002", 404], ["P0001", 500]] as const)("maps database failure %s without invalidating cache", async (code, status) => {
    rpc.mockResolvedValueOnce({ data: null, error: { name: "PostgrestError", message: "Database rejected save", code, details: "", hint: "" } });
    const response = await PATCH(request(fixture().input), context());
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ message: "Database rejected save", code });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("still reports a confirmed save if cache refresh fails", async () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => { throw new Error("Cache unavailable"); });
    expect((await PATCH(request(fixture().input), context())).status).toBe(200);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it.each(["lost response", "invalid saved response"])("does not claim rollback after an uncertain %s", async (scenario) => {
    if (scenario === "lost response") rpc.mockRejectedValueOnce(new Error("Connection lost"));
    else rpc.mockResolvedValueOnce({ data: {}, error: null });
    const response = await PATCH(request(fixture().input), context());
    expect(response.status).toBe(500); expect(await response.json()).toEqual(expect.objectContaining({ code: "SAVE_UNCONFIRMED" }));
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("reports an absent booking without attempting a write", async () => {
    vi.mocked(prepareBookingEdit).mockRejectedValueOnce(new BookingEditError("Booking not found.", 404, "BOOKING_NOT_FOUND"));
    expect((await PATCH(request(fixture().input), context())).status).toBe(404); expect(rpc).not.toHaveBeenCalled();
  });
});
