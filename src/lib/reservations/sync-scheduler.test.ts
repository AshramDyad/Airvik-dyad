import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReservationSyncScheduler, type ReservationSyncBatch } from "./sync-scheduler";
import { replaceBookingReservations } from "./merge-booking";
import { buildReservation, resetBuilderSequences } from "@/test/builders";

describe("reservation refresh batching", () => {
  beforeEach(() => { vi.useFakeTimers(); resetBuilderSequences(); });
  afterEach(() => { vi.useRealTimers(); });

  it("coalesces a burst while preserving different bookings", async () => {
    const execute = vi.fn<(batch: ReservationSyncBatch) => Promise<void>>().mockResolvedValue(undefined);
    const queue = createReservationSyncScheduler(execute, vi.fn());
    for (let i = 0; i < 37; i++) queue.enqueue({ bookingId: "A9469", reservationId: `room-${i}` });
    queue.enqueue({ bookingId: "A10004" });
    await vi.advanceTimersByTimeAsync(150);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].hints.map((hint) => hint.bookingId)).toEqual(["A9469", "A10004"]);
    expect(execute.mock.calls[0][0].fullRefresh).toBe(false);
    queue.dispose();
  });

  it("runs only one refresh at a time and one follow-up batch", async () => {
    let release = () => {};
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const execute = vi.fn<(batch: ReservationSyncBatch) => Promise<void>>().mockResolvedValue(undefined);
    execute.mockImplementationOnce(() => blocked);
    const queue = createReservationSyncScheduler(execute, vi.fn());
    queue.enqueue({ bookingId: "A9469" });
    await vi.advanceTimersByTimeAsync(150);
    for (let i = 0; i < 37; i++) queue.enqueue({ bookingId: "A10004" });
    queue.enqueue({ bookingId: "A10005" });
    await vi.advanceTimersByTimeAsync(500);
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(150);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1][0].hints.map((hint) => hint.bookingId)).toEqual(["A10004", "A10005"]);
    queue.dispose();
  });

  it("retains explicit full refreshes and recovers after a failed background read", async () => {
    const execute = vi.fn<(batch: ReservationSyncBatch) => Promise<void>>().mockResolvedValue(undefined);
    const onError = vi.fn();
    execute.mockRejectedValueOnce(new Error("read failed"));
    const queue = createReservationSyncScheduler(execute, onError);
    queue.enqueue({ bookingId: "A9469" });
    await vi.advanceTimersByTimeAsync(150);
    await queue.refresh();
    expect(onError).toHaveBeenCalledOnce();
    expect(execute.mock.calls[1][0].fullRefresh).toBe(true);
    queue.dispose();
  });

  it("merges only the saved booking and keeps folios and removed rows", () => {
    const old = buildReservation({ bookingId: "A9469" });
    const unrelated = buildReservation({ bookingId: "A10004" });
    const saved = buildReservation({ ...old, notes: "Saved", status: "Cancelled" });
    expect(replaceBookingReservations([old, unrelated], old.bookingId, [saved])).toEqual(expect.arrayContaining([saved, unrelated]));
    expect(replaceBookingReservations([old, unrelated], old.bookingId, [saved])).toHaveLength(2);
  });
});
