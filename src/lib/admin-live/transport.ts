import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { HEARTBEAT_MS, TRACK_INTERVAL_MS, livePayloadSchema, type LivePayload, type LiveSnapshot } from "./model";

type Listener = (snapshot: LiveSnapshot) => void;
type Entry = { channel: RealtimeChannel; status: LiveSnapshot["status"]; listeners: Set<Listener> };
let documentSequence = 0;

/** One publisher per document; the viewer shares that channel for its own user. */
export function createLiveTransport(client: SupabaseClient, userId: string, getPayload: () => Omit<LivePayload, "sequence">) {
  const entries = new Map<string, Entry>();
  let disposed = false;
  let suspended = false;
  let lastTrack = -Infinity;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let tracking = false;

  function snapshot(entry: Entry): LiveSnapshot {
    const tabs = Object.values(entry.channel.presenceState()).flat().flatMap(raw => {
      const parsed = livePayloadSchema.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    });
    return { status: entry.status, tabs };
  }

  function emit(entry: Entry) {
    const value = snapshot(entry);
    entry.listeners.forEach(listener => listener(value));
  }

  function publish() {
    if (disposed || suspended || pending) return;
    const entry = entries.get(userId);
    if (!entry || entry.channel.state !== "joined") return;
    const wait = Math.max(0, TRACK_INTERVAL_MS - (performance.now() - lastTrack));
    pending = setTimeout(async () => {
      pending = undefined;
      if (disposed || suspended || tracking || entry.channel.state !== "joined") return;
      tracking = true;
      lastTrack = performance.now();
      try {
        const result = await entry.channel.track({ ...getPayload(), sequence: ++documentSequence });
        if (result !== "ok" && !disposed) {
          entry.status = "lost";
          emit(entry);
        }
      } catch {
        if (!disposed) { entry.status = "lost"; emit(entry); }
      } finally { tracking = false; }
    }, wait);
  }

  function connect(id: string, listeners = new Set<Listener>()) {
    const channel = client.channel(`admin-live:${id}`, {
      config: { private: true, presence: { key: getPayload().tabId } },
    });
    const entry: Entry = { channel, status: "checking", listeners };
    entries.set(id, entry);
    channel.on("presence", { event: "sync" }, () => {
      if (disposed || suspended || entries.get(id) !== entry) return;
      entry.status = "live";
      emit(entry);
    }).subscribe(status => {
      if (disposed || suspended || entries.get(id) !== entry) return;
      entry.status = status === "SUBSCRIBED" ? "checking" : "lost";
      emit(entry);
      if (status === "SUBSCRIBED" && id === userId) publish();
    });
    return entry;
  }

  connect(userId);
  const heartbeat = setInterval(publish, HEARTBEAT_MS);

  return {
    publish,
    watch(id: string, listener: Listener) {
      const entry = entries.get(id) ?? connect(id);
      entry.listeners.add(listener);
      listener(snapshot(entry));
      return () => {
        const current = entries.get(id);
        current?.listeners.delete(listener);
        if (current && id !== userId && current.listeners.size === 0) {
          entries.delete(id);
          void client.removeChannel(current.channel).catch(() => {});
        }
      };
    },
    suspend() {
      suspended = true;
      if (pending) clearTimeout(pending);
      pending = undefined;
      entries.forEach(entry => {
        entry.status = "lost";
        emit(entry);
        void client.removeChannel(entry.channel).catch(() => {});
      });
    },
    resume() {
      if (!suspended || disposed) return;
      suspended = false;
      const previous = [...entries];
      entries.clear();
      previous.forEach(([id, entry]) => connect(id, entry.listeners));
    },
    dispose() {
      disposed = true;
      clearInterval(heartbeat);
      if (pending) clearTimeout(pending);
      entries.forEach(entry => {
        entry.status = "lost";
        emit(entry);
        void client.removeChannel(entry.channel).catch(() => {});
      });
      entries.clear();
    },
  };
}

export type LiveTransport = ReturnType<typeof createLiveTransport>;
