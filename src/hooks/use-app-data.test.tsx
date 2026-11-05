import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useSessionContext } from "@/context/session-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import { revalidateReservationsCache } from "@/lib/reservations/cache-client";
import { BookingEditError, createReservationEditSnapshot, type BookingEditInput, type BookingEditResult } from "@/lib/reservations/booking-edit";
import { createReservationSyncMessage, RESERVATION_SYNC_STORAGE_KEY } from "@/lib/reservations/realtime-sync";
import { buildProperty, buildReservation, buildSession, resetBuilderSequences } from "@/test/builders";
import { useAppData } from "./use-app-data";

vi.mock("@/context/session-context", () => ({ useSessionContext: vi.fn() }));
vi.mock("@/hooks/use-activity-logger", () => ({ useActivityLogger: () => ({ logActivity: vi.fn() }) }));
vi.mock("@/lib/auth/client-session", () => ({ authorizedFetch: vi.fn() }));
vi.mock("@/lib/reservations/cache-client", () => ({ revalidateReservationsCache: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { channel: vi.fn(), removeChannel: vi.fn() } }));
vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<typeof import("@/lib/api")>("@/lib/api"),
  getProperty: vi.fn(), getGuests: vi.fn(), getRooms: vi.fn(), getRoomTypes: vi.fn(), getRoomCategories: vi.fn(),
  getRatePlans: vi.fn(), getSeasonalPrices: vi.fn(), getPropertyClosures: vi.fn(), getRoles: vi.fn(),
  getAmenities: vi.fn(), getStickyNotes: vi.fn(), getUsers: vi.fn(), getHousekeepingAssignments: vi.fn(),
  getRoomTypeAmenities: vi.fn(), getReservations: vi.fn(), getReservationsByBookingId: vi.fn(),
  getReservationById: vi.fn(), saveBookingEdit: vi.fn(),
}));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const response = <T,>(data: T) => ({ data, error: null, count: null, status: 200, statusText: "OK" });
function fixture(bookingId = "A9469", id = 1) {
  const reservation = buildReservation({ id: uuid(id), guestId: uuid(100), roomId: uuid(200 + id), ratePlanId: uuid(300), bookingId, checkInDate: "2026-10-01", checkOutDate: "2026-10-03" });
  const input: BookingEditInput = { checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate, adultCount: 2, childCount: 0, roomIds: [reservation.roomId], notes: "Saved", customRates: {}, expectedReservations: createReservationEditSnapshot([reservation]) };
  return { reservation, input, saved: buildReservation({ ...reservation, notes: "Saved", roomId: uuid(210) }) };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function notify(bookingId: string) {
  const message = createReservationSyncMessage({ bookingId, sourceId: "other-staff-tab", revision: 1 });
  window.dispatchEvent(new StorageEvent("storage", { key: RESERVATION_SYNC_STORAGE_KEY, newValue: JSON.stringify(message) }));
}
async function settleTimers() { await act(async () => { await vi.advanceTimersByTimeAsync(150); }); }

describe("booking edit state and refresh flow", () => {
  beforeEach(() => {
    resetBuilderSequences(); vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(useSessionContext).mockReturnValue({ session: buildSession(), isLoading: false, roleName: "Reception" });
    vi.mocked(revalidateReservationsCache).mockResolvedValue(true);
    vi.mocked(authorizedFetch).mockImplementation(async () => Response.json({ data: [], count: 0, nextOffset: null }));
    vi.mocked(api.getProperty).mockResolvedValue({ data: buildProperty(), error: null });
    vi.mocked(api.getGuests).mockResolvedValue(response([])); vi.mocked(api.getRooms).mockResolvedValue(response([]));
    vi.mocked(api.getRoomTypes).mockResolvedValue(response([])); vi.mocked(api.getRoomCategories).mockResolvedValue(response([]));
    vi.mocked(api.getRatePlans).mockResolvedValue(response([])); vi.mocked(api.getSeasonalPrices).mockResolvedValue(response([]));
    vi.mocked(api.getPropertyClosures).mockResolvedValue([]); vi.mocked(api.getRoles).mockResolvedValue(response([]));
    vi.mocked(api.getAmenities).mockResolvedValue(response([])); vi.mocked(api.getStickyNotes).mockResolvedValue(response([]));
    vi.mocked(api.getUsers).mockResolvedValue({ data: [], error: null }); vi.mocked(api.getHousekeepingAssignments).mockResolvedValue(response([]));
    vi.mocked(api.getRoomTypeAmenities).mockResolvedValue(response([])); vi.mocked(api.getReservations).mockResolvedValue(response([]));
    vi.mocked(api.getReservationsByBookingId).mockResolvedValue(response([]));
    const channel = { on: vi.fn(), subscribe: vi.fn(), send: vi.fn().mockResolvedValue("ok") };
    channel.on.mockReturnValue(channel); channel.subscribe.mockReturnValue(channel);
    vi.mocked(supabase.channel).mockReturnValue(channel as unknown as ReturnType<typeof supabase.channel>);
    vi.mocked(supabase.removeChannel).mockResolvedValue("ok");
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  async function mount() {
    const hook = renderHook(useAppData);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    vi.useFakeTimers();
    return hook;
  }

  it("applies a save immediately and finishes even while the background page reload is stalled", async () => {
    const f = fixture(); vi.mocked(api.getReservations).mockResolvedValue(response([f.reservation]));
    vi.mocked(api.getReservationsByBookingId).mockResolvedValue(response([f.reservation]));
    vi.mocked(api.saveBookingEdit).mockResolvedValue({ bookingId: f.saved.bookingId, reservations: [f.saved] });
    const { result } = await mount();
    await act(async () => { await result.current.loadBookingDetails(f.reservation.bookingId); await result.current.loadReservationsPage({ limit: 10, offset: 0 }); });
    const stalled = deferred<Response>(); vi.mocked(authorizedFetch).mockReturnValueOnce(stalled.promise);
    vi.mocked(api.getReservationsByBookingId).mockResolvedValue(response([f.saved]));
    await act(async () => { await result.current.saveBookingEdit(f.reservation.id, f.input); });
    expect(result.current.activeBookingReservations).toEqual([f.saved]);
    expect(result.current.reservations).toEqual([f.saved]);
    await settleTimers();
    expect(api.saveBookingEdit).toHaveBeenCalledOnce();
    expect(api.getProperty).toHaveBeenCalledOnce(); expect(api.getRooms).toHaveBeenCalledOnce();
    expect(revalidateReservationsCache).toHaveBeenCalledOnce();
    await act(async () => { stalled.resolve(Response.json({ data: [], count: 0, nextOffset: null })); });
  });

  it("keeps multiple affected bookings and refreshes the current page only once per burst", async () => {
    const a = fixture(); const b = fixture("A10004", 2);
    vi.mocked(api.getReservationsByBookingId).mockImplementation(async (id) => response([id === a.reservation.bookingId ? a.saved : b.saved]));
    const { result } = await mount();
    await act(async () => { await result.current.loadBookingDetails(a.reservation.bookingId); await result.current.loadReservationsPage({ limit: 10, offset: 0 }); });
    vi.mocked(api.getReservationsByBookingId).mockClear(); vi.mocked(authorizedFetch).mockClear();
    act(() => { for (let i = 0; i < 37; i++) notify(a.reservation.bookingId); notify(b.reservation.bookingId); });
    await settleTimers();
    expect(api.getReservationsByBookingId).toHaveBeenCalledTimes(2);
    expect(authorizedFetch).toHaveBeenCalledOnce();
    expect(result.current.reservations).toEqual(expect.arrayContaining([a.saved, b.saved]));
    expect(result.current.activeBookingReservations).toEqual([a.saved]);
    expect(api.getProperty).toHaveBeenCalledOnce();
  });

  it("does not let an old full-reservation read replace a newer realtime result", async () => {
    const f = fixture(); const oldRead = deferred<Awaited<ReturnType<typeof api.getReservations>>>();
    vi.mocked(api.getReservations).mockReturnValueOnce(oldRead.promise);
    vi.mocked(api.getReservationsByBookingId).mockResolvedValue(response([f.saved]));
    const { result } = await mount();
    act(() => notify(f.reservation.bookingId)); await settleTimers();
    await act(async () => { oldRead.resolve(response([f.reservation])); });
    expect(result.current.reservations).toEqual([f.saved]);
  });

  it("ignores a delayed save response if realtime has already received a later commit", async () => {
    const f = fixture(); const lateSave = deferred<BookingEditResult>();
    const newer = buildReservation({ ...f.saved, notes: "Newer staff change" });
    vi.mocked(api.saveBookingEdit).mockReturnValueOnce(lateSave.promise);
    vi.mocked(api.getReservationsByBookingId).mockResolvedValue(response([newer]));
    const { result } = await mount();
    let save: Promise<BookingEditResult>;
    act(() => { save = result.current.saveBookingEdit(f.reservation.id, f.input); });
    act(() => notify(f.reservation.bookingId)); await settleTimers();
    await act(async () => { lateSave.resolve({ bookingId: f.saved.bookingId, reservations: [f.saved] }); await save; });
    expect(result.current.reservations).toEqual([newer]);
    expect(api.saveBookingEdit).toHaveBeenCalledOnce();
  });

  it("ignores late lookup and list requests after a confirmed save", async () => {
    const f = fixture(); const oldLookup = deferred<Awaited<ReturnType<typeof api.getReservationsByBookingId>>>();
    const oldPage = deferred<Response>();
    vi.mocked(api.saveBookingEdit).mockResolvedValue({ bookingId: f.saved.bookingId, reservations: [f.saved] });
    const { result } = await mount();
    vi.mocked(api.getReservationsByBookingId).mockReturnValueOnce(oldLookup.promise);
    vi.mocked(authorizedFetch).mockReturnValueOnce(oldPage.promise);
    let lookup: Promise<void>; let page: Promise<void>;
    act(() => { lookup = result.current.loadBookingDetails(f.reservation.bookingId); page = result.current.loadReservationsPage({ limit: 10, offset: 0 }); });
    await act(async () => { await result.current.saveBookingEdit(f.reservation.id, f.input); });
    await act(async () => { oldLookup.resolve(response([f.reservation])); oldPage.resolve(Response.json({ data: [], count: 999, nextOffset: null })); await Promise.all([lookup, page]); });
    expect(result.current.reservations).toEqual([f.saved]);
    expect(result.current.reservationsTotalCount).not.toBe(999);
    expect(result.current.activeBookingReservations).not.toEqual([f.reservation]);
    expect(result.current.lookupStatus[f.reservation.bookingId]).toBe("success");
  });

  it("re-reads an unconfirmed save once without automatically retrying the write", async () => {
    const f = fixture(); vi.mocked(api.getReservations).mockResolvedValue(response([f.reservation]));
    vi.mocked(api.getReservationsByBookingId).mockResolvedValue(response([f.saved]));
    vi.mocked(api.saveBookingEdit).mockRejectedValueOnce(new BookingEditError("Couldn't confirm the save", 0, "SAVE_UNCONFIRMED"));
    const { result } = await mount();
    await act(async () => { await expect(result.current.saveBookingEdit(f.reservation.id, f.input)).rejects.toMatchObject({ code: "SAVE_UNCONFIRMED" }); });
    expect(api.getReservationsByBookingId).toHaveBeenCalledExactlyOnceWith(f.saved.bookingId);
    expect(api.getReservationById).not.toHaveBeenCalled();
    expect(result.current.reservations).toEqual([f.saved]);
    expect(api.saveBookingEdit).toHaveBeenCalledOnce();
  });

  it("does not report a committed save as failed if a change notification throws", async () => {
    const f = fixture(); vi.mocked(api.saveBookingEdit).mockResolvedValue({ bookingId: f.saved.bookingId, reservations: [f.saved] });
    const brokenChannel = { on: vi.fn(), subscribe: vi.fn(), send: vi.fn(() => { throw new Error("Channel unavailable"); }) };
    brokenChannel.on.mockReturnValue(brokenChannel); brokenChannel.subscribe.mockReturnValue(brokenChannel);
    vi.mocked(supabase.channel).mockReturnValue(brokenChannel as unknown as ReturnType<typeof supabase.channel>);
    const { result } = await mount();
    await act(async () => { await expect(result.current.saveBookingEdit(f.reservation.id, f.input)).resolves.toEqual({ bookingId: f.saved.bookingId, reservations: [f.saved] }); });
    expect(result.current.reservations).toEqual([f.saved]); expect(api.saveBookingEdit).toHaveBeenCalledOnce();
  });
});
