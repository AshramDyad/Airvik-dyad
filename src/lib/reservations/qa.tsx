"use client";

import * as React from "react";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

export const QA_SCENARIOS = [
  "slow-load", "timeout", "empty-results", "page-reset", "stale-results",
  "unknown-guest", "dead-link", "not-found", "partial-details", "retry-recovery",
] as const;
type Scenario = typeof QA_SCENARIOS[number];
const OWNER_ID = "04ce4714-0567-4bc0-b2b7-2e940f87ff52";
const isScenario = (value: unknown): value is Scenario =>
  typeof value === "string" && QA_SCENARIOS.some(scenario => scenario === value);

type DatedBooking = { checkOutDate: string; subRows?: DatedBooking[] };
/** Calendar days in India; unknown dates and any recent linked stay fail open. */
export function isOldQaBooking(booking: DatedBooking, now = new Date()): boolean {
  const date = booking.checkOutDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  return parsed < cutoff && (booking.subRows ?? []).every(row => isOldQaBooking(row, now));
}

/** One server-controlled switch; no browser opt-in or tester controls. */
export function useReservationQa() {
  const { currentUser } = useAuthContext();
  const userId = currentUser?.id;
  const [active, setActive] = React.useState<{ userId: string; scenario: Scenario } | null>(null);

  React.useEffect(() => {
    setActive(null);
    if (!userId || userId === OWNER_ID) return;
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | undefined;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 5000);
      try {
        const response = await fetch(`/reservations-qa.json?t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
        const config: unknown = response.ok ? await response.json() : null;
        const scenario = config && typeof config === "object" &&
          "enabled" in config && config.enabled === true &&
          "scenario" in config && isScenario(config.scenario) ? config.scenario : null;
        if (!disposed) setActive(scenario ? { userId, scenario } : null);
      } catch { if (!disposed) setActive(null); }
      finally { clearTimeout(timeout); inFlight = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 15000);
    window.addEventListener("focus", check);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); window.removeEventListener("focus", check); };
  }, [userId]);

  const scenario = userId !== OWNER_ID && active?.userId === userId ? active?.scenario ?? null : null;
  return { scenario };
}

export function QaBookingBoundary({ scenario, children }: { scenario: Scenario | null; children: React.ReactNode }) {
  const [attempt, setAttempt] = React.useState(0);
  const [waited, setWaited] = React.useState(false);
  React.useEffect(() => {
    setWaited(false);
    if (scenario !== "slow-load" && scenario !== "timeout") return;
    const timer = window.setTimeout(() => setWaited(true), scenario === "slow-load" ? 8000 : 2000);
    return () => clearTimeout(timer);
  }, [scenario, attempt]);
  if (scenario === "slow-load" && !waited || scenario === "timeout" && !waited) {
    return <div role="status" className="p-12 text-center animate-pulse">Loading reservation…</div>;
  }
  if (scenario === "not-found") return <div role="alert" className="p-12 text-center">Reservation not found.</div>;
  if (scenario === "timeout" || scenario === "retry-recovery" && attempt < 2) {
    return <div role="alert" className="space-y-3 rounded-md border p-8"><p>Unable to load reservation. Please try again.</p>
      <Button type="button" onClick={() => { setWaited(false); setAttempt(value => value + 1); }}>Retry</Button></div>;
  }
  return <>{children}</>;
}

/** Display-only transformations. Never pass these copies to mutation handlers. */
export function useQaReservationRows<T extends DatedBooking & { guestName: string; subRows?: T[] }>(
  rows: T[], scenario: Scenario | null, requestKey: string, loading: boolean, resetPage: () => void,
) {
  const previous = React.useRef<{ key: string; rows: T[] } | null>(null);
  const [stale, setStale] = React.useState<{ key: string; rows: T[] } | null>(null);
  const resetRef = React.useRef(resetPage);
  resetRef.current = resetPage;
  const allOld = rows.length > 0 && rows.every(row => isOldQaBooking(row));
  React.useEffect(() => {
    if (loading || !allOld || scenario !== "page-reset") return;
    const timer = window.setTimeout(() => resetRef.current(), 1200);
    return () => clearTimeout(timer);
  }, [loading, allOld, scenario, requestKey]);
  React.useEffect(() => {
    if (loading) return;
    const last = previous.current;
    previous.current = { key: requestKey, rows };
    if (scenario !== "stale-results" || !allOld || !last || last.key === requestKey || !last.rows.every(row => isOldQaBooking(row))) {
      setStale(null);
      return;
    }
    setStale({ key: requestKey, rows: last.rows });
    const timer = window.setTimeout(() => setStale(null), 2000);
    return () => clearTimeout(timer);
  }, [rows, requestKey, loading, scenario, allOld]);
  if (scenario === "empty-results") return rows.filter(row => !isOldQaBooking(row));
  if (scenario === "unknown-guest") {
    const mask = (row: T): T => ({ ...row, guestName: "Unknown guest", subRows: row.subRows?.map(mask) });
    return rows.map(row => isOldQaBooking(row) ? mask(row) : row);
  }
  if (scenario === "stale-results" && allOld && !loading && stale?.key === requestKey) return stale.rows;
  return rows;
}
