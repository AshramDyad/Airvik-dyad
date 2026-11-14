import { z } from "zod";

// This is only a UI gate; the same account is enforced by database policies.
export const LIVE_VIEWER_ID = "04ce4714-0567-4bc0-b2b7-2e940f87ff52";
export const HEARTBEAT_MS = 15_000;
export const TRACK_INTERVAL_MS = 8_000;
export const STALE_MS = 45_000;
export const IDLE_MS = 5 * 60_000;

const label = z.string().max(160);
export const livePayloadSchema = z.object({
  version: z.literal(1),
  tabId: z.string().uuid(),
  location: z.object({
    pathname: z.string().max(300).regex(/^\/admin(?:\/[a-zA-Z0-9_-]+)*\/?$/),
    page: label,
    section: label.nullable(),
    dialog: label.nullable(),
    booking: z.string().max(40).regex(/^[a-zA-Z0-9-]+$/).nullable(),
  }),
  visible: z.boolean(),
  focused: z.boolean(),
  idle: z.boolean(),
  sequence: z.number().int().nonnegative(),
});

export type LivePayload = z.infer<typeof livePayloadSchema>;
export type LiveLocation = LivePayload["location"];
export type LiveSnapshot = { status: "checking" | "live" | "lost"; tabs: LivePayload[] };
export type ObservedTab = { payload: LivePayload; receivedAt: number | null; firstSeenAt: number };
export type ObservedUser = { status: LiveSnapshot["status"]; tabs: ObservedTab[] };
export type LiveState = "Active" | "Idle" | "Background" | "Stale" | "Checking" | "Connection lost" | "Not connected";

export function observeSnapshot(previous: ObservedUser | undefined, snapshot: LiveSnapshot, now: number): ObservedUser {
  if (snapshot.status !== "live") return { status: snapshot.status, tabs: [] };
  return {
    status: "live",
    tabs: snapshot.tabs.map(payload => {
      const old = previous?.status === "live" ? previous.tabs.find(t => t.payload.tabId === payload.tabId) : undefined;
      if (old && payload.sequence <= old.payload.sequence) return old;
      return {
        payload,
        firstSeenAt: old?.firstSeenAt ?? now,
        // A cached first snapshot is not proof that a tab is still responding.
        receivedAt: old && payload.sequence > old.payload.sequence ? now : old?.receivedAt ?? null,
      };
    }),
  };
}

export function tabState(tab: ObservedTab, now: number): LiveState {
  if (now - (tab.receivedAt ?? tab.firstSeenAt) >= STALE_MS) return "Stale";
  if (tab.receivedAt === null) return "Checking";
  if (!tab.payload.visible || !tab.payload.focused) return "Background";
  return tab.payload.idle ? "Idle" : "Active";
}

export function isFreshState(state: LiveState) {
  return state === "Active" || state === "Idle" || state === "Background";
}

export function userState(user: ObservedUser | undefined, now: number): LiveState {
  if (!user || user.status === "checking") return "Checking";
  if (user.status === "lost") return "Connection lost";
  if (!user.tabs.length) return "Not connected";
  const states = user.tabs.map(tab => tabState(tab, now));
  return (["Active", "Idle", "Background", "Checking", "Stale"] as const).find(s => states.includes(s)) ?? "Stale";
}
