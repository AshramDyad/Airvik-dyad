import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedFetch, ClientSessionError } from "@/lib/auth/client-session";
import { createReservationEditSnapshot, type BookingEditInput } from "@/lib/reservations/booking-edit";
import { buildDbReservation, buildFolioItem, buildReservation, resetBuilderSequences } from "@/test/builders";
import { saveBookingEdit } from "./index";

vi.mock("@/lib/auth/client-session", async () => ({
  ...await vi.importActual<typeof import("@/lib/auth/client-session")>("@/lib/auth/client-session"),
  authorizedFetch: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const reservation = buildReservation({ id: uuid(1), guestId: uuid(2), roomId: uuid(3), ratePlanId: uuid(4), checkInDate: "2026-10-01", checkOutDate: "2026-10-03", folio: [buildFolioItem({ amount: -6800, transactionId: "S58965663", externalReference: "627292156097", externalMetadata: { statement: true } })] });
  const input: BookingEditInput = { checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate, roomIds: [reservation.roomId], adultCount: 2, childCount: 0, notes: null, customRates: {}, expectedReservations: createReservationEditSnapshot([reservation]) };
  return { reservation, input };
}

describe("booking edit client", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.mocked(authorizedFetch).mockReset(); resetBuilderSequences(); });
  afterEach(() => { vi.useRealTimers(); });

  it("sends one PATCH, disables automatic write retries and maps canonical payment folios", async () => {
    const f = fixture();
    vi.mocked(authorizedFetch).mockResolvedValueOnce(Response.json({ bookingId: f.reservation.bookingId, reservations: [buildDbReservation(f.reservation)] }));
    const result = await saveBookingEdit(f.reservation.id, f.input);
    expect(authorizedFetch).toHaveBeenCalledExactlyOnceWith(`/api/admin/reservations/${f.reservation.id}`, expect.objectContaining({ method: "PATCH", body: JSON.stringify(f.input), retryOnUnauthorized: false }));
    expect(result.reservations[0].folio[0]).toEqual(expect.objectContaining({ amount: -6800, transactionId: "S58965663", externalReference: "627292156097", externalMetadata: { statement: true } }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a stale edit without resubmitting", async () => {
    vi.mocked(authorizedFetch).mockResolvedValueOnce(Response.json({ message: "This booking changed. Reload it before saving.", code: "PT409" }, { status: 409 }));
    const f = fixture();
    await expect(saveBookingEdit(f.reservation.id, f.input)).rejects.toMatchObject({ status: 409, code: "PT409" });
    expect(authorizedFetch).toHaveBeenCalledOnce();
  });

  it("preserves the sign-in instruction for a known pre-dispatch session failure", async () => {
    vi.mocked(authorizedFetch).mockRejectedValueOnce(new ClientSessionError("Please sign in again to continue."));
    const f = fixture();
    await expect(saveBookingEdit(f.reservation.id, f.input)).rejects.toMatchObject({ status: 401, code: "SESSION_EXPIRED", message: "Please sign in again to continue." });
    expect(authorizedFetch).toHaveBeenCalledOnce();
  });

  it("bounds even a stalled session/request to 30 seconds and does not claim rollback", async () => {
    vi.mocked(authorizedFetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
    const f = fixture();
    const outcome = saveBookingEdit(f.reservation.id, f.input).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await outcome).toMatchObject({ code: "SAVE_UNCONFIRMED", message: "Couldn't confirm the save. Check the booking before trying again." });
    expect(vi.mocked(authorizedFetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(authorizedFetch).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["network", "malformed result", "proxy error"])("treats a %s as unconfirmed, never retries a potentially committed save", async (scenario) => {
    if (scenario === "network") vi.mocked(authorizedFetch).mockRejectedValueOnce(new Error("Network lost"));
    else if (scenario === "malformed result") vi.mocked(authorizedFetch).mockResolvedValueOnce(Response.json({}));
    else vi.mocked(authorizedFetch).mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }));
    const f = fixture();
    await expect(saveBookingEdit(f.reservation.id, f.input)).rejects.toMatchObject({ code: "SAVE_UNCONFIRMED" });
    expect(authorizedFetch).toHaveBeenCalledOnce();
  });
});
