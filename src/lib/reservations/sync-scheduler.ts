import type { ReservationSyncHint } from "./realtime-sync";

export type ReservationSyncBatch = { hints: ReservationSyncHint[]; fullRefresh: boolean };

// A small queue for refreshes, not writes. Preserve every affected booking and
// never start a second reload while the first one is still running.
export function createReservationSyncScheduler(
  execute: (batch: ReservationSyncBatch) => Promise<void>,
  onError: (error: unknown) => void,
) {
  const pending = new Map<string, ReservationSyncHint>();
  let fullRefresh = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let disposed = false;
  let waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

  const schedule = () => {
    if (disposed || running) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void flush(); }, 150);
  };

  const flush = async () => {
    if (disposed || running || (!pending.size && !fullRefresh)) return;
    if (timer) { clearTimeout(timer); timer = null; }
    const batch = { hints: [...pending.values()], fullRefresh };
    const batchWaiters = waiters;
    pending.clear(); fullRefresh = false; waiters = []; running = true;
    try {
      await execute(batch);
      batchWaiters.forEach((waiter) => waiter.resolve());
    } catch (error) {
      onError(error);
      batchWaiters.forEach((waiter) => waiter.reject(error));
    } finally {
      running = false;
      if (pending.size || fullRefresh) schedule();
    }
  };

  return {
    enqueue(hint: ReservationSyncHint = {}) {
      if (disposed) return;
      const key = hint.bookingId ? `booking:${hint.bookingId}` : hint.reservationId ? `reservation:${hint.reservationId}` : "unknown";
      pending.set(key, { ...pending.get(key), ...hint });
      schedule();
    },
    refresh(): Promise<void> {
      if (disposed) return Promise.resolve();
      fullRefresh = true;
      const promise = new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }));
      void flush();
      return promise;
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      pending.clear();
      waiters.forEach((waiter) => waiter.resolve());
      waiters = [];
    },
  };
}
