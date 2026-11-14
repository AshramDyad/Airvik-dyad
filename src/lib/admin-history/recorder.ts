import type { Session } from '@supabase/supabase-js';
import type { LivePayload } from '@/lib/admin-live/model';

type Interval = {
  id: string; session_id: string; tab_id: string; visit_id: string;
  pathname: string; page: string; section: string | null; dialog: string | null; booking: string | null;
  state: 'active' | 'idle' | 'background'; booking_seen: boolean;
  started_at: string; ended_at: string; sequence: number; end_reason: 'checkpoint' | 'change' | 'gap' | 'closed';
};
type Stored = { key: string; owner: string; saved: number; value: Interval };
let beforeSignOut: (() => Promise<void>) | undefined;
export async function flushAdminHistoryBeforeSignOut() { await beforeSignOut?.(); }

// IndexedDB is only a bounded delivery queue, never a second history database.
function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('admin-history-delivery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage unavailable'));
  });
}
async function queueTransaction<T>(work: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    let result: T;
    work(tx.objectStore('pending'), value => { result = value; });
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export function createHistoryRecorder(userId: string, getSession: () => Session | null, getPayload: () => Omit<LivePayload, 'sequence'>) {
  const session = getSession();
  let sessionId: string;
  try { sessionId = JSON.parse(atob(session!.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id; }
  catch { return { change() {}, suspend() {}, resume() {}, dispose() {} }; }
  if (!sessionId) return { change() {}, suspend() {}, resume() {}, dispose() {} };
  const owner = `${userId}:${sessionId}`;
  const pending = new Map<string, Interval>();
  let current: Interval | undefined;
  let visitId = crypto.randomUUID();
  let pathname = '';
  let lastWall = Date.now();
  let lastMono = performance.now();
  let stopped = false;
  let suspended = false;
  let sending = false;
  let failures = 0;
  let nextAttempt = 0;
  let lastFlush = 0;
  let scheduled = false;
  let storageChain = Promise.resolve();
  const store = (input: Interval) => {
    const value = { ...input };
    pending.set(value.id, { ...value });
    if (pending.size > 500) pending.delete(pending.keys().next().value!);
    storageChain = storageChain.then(() => queueTransaction<void>((s, done) => {
      s.put({ key: `${owner}:${value.id}`, owner, saved: Date.now(), value: { ...value } }); done();
    })).catch(() => {});
  };
  const readQueue = async () => {
    await storageChain;
    await queueTransaction<void>((s, done) => {
      const request = s.getAll();
      request.onsuccess = () => {
        const rows = request.result as Stored[];
        const valid = rows.filter(row => row.owner === owner && Date.parse(row.value.started_at) > Date.now()-86_400_000).sort((a,b) => b.saved-a.saved).slice(0,500);
        const keys = new Set(valid.map(row => row.key));
        rows.forEach(row => { if (Date.parse(row.value.started_at) < Date.now()-86_400_000 || (row.owner === owner && !keys.has(row.key))) s.delete(row.key); });
        valid.reverse().forEach(row => { if ((pending.get(row.value.id)?.sequence ?? 0) < row.value.sequence) pending.set(row.value.id,row.value); });
        done();
      };
    }).catch(() => {});
  };
  async function flush(keepalive = false) {
    if (sending || Date.now() < nextAttempt) return;
    const auth = getSession();
    if (auth?.user.id !== userId || !auth.access_token) return;
    sending = true;
    try {
      await readQueue();
      const batch: Interval[] = [];
      for (const row of pending.values()) {
        if (batch.length >= 40 || new TextEncoder().encode(JSON.stringify([...batch, row])).length > 40000) break;
        batch.push(row);
      }
      if (!batch.length) return;
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_admin_browsing`, {
        method: 'POST', keepalive, signal: AbortSignal.timeout(10000),
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_intervals: batch }),
      });
      if (!response.ok) throw new Error('History delivery failed');
      failures = 0; nextAttempt = 0;
      batch.forEach(row => { if (pending.get(row.id)?.sequence === row.sequence) pending.delete(row.id); });
      await queueTransaction<void>((s, done) => {
        batch.forEach(row => {
          const key = `${owner}:${row.id}`; const request = s.get(key);
          request.onsuccess = () => { if (request.result?.value.sequence <= row.sequence) s.delete(key); };
        }); done();
      }).catch(() => {});
    } catch { nextAttempt = Date.now()+Math.min(300000, 5000 * 2 ** Math.min(++failures,6)); }
    finally { sending = false; }
  }
  function sample(reason: Interval['end_reason'] = 'checkpoint') {
    if (stopped || suspended) return;
    const now = Date.now(), mono = performance.now();
    const gap = now-lastWall > 20000 || Math.abs((now-lastWall)-(mono-lastMono)) > 2000 || now < lastWall;
    const payload = getPayload();
    const state = !payload.visible || !payload.focused ? 'background' : payload.idle ? 'idle' : 'active';
    if (payload.location.pathname !== pathname) { pathname = payload.location.pathname; visitId = crypto.randomUUID(); }
    const changed = current && (JSON.stringify(payload.location) !== JSON.stringify({ pathname: current.pathname, page: current.page, section: current.section, dialog: current.dialog, booking: current.booking }) || state !== current.state);
    if (current) {
      current.ended_at = new Date(gap ? lastWall : now).toISOString();
      current.sequence++;
      current.end_reason = gap ? 'gap' : changed ? 'change' : reason;
      if (gap || changed || reason !== 'checkpoint' || now-Date.parse(current.started_at) >= 240000) {
        store(current); current = undefined;
      }
    }
    if (!current && reason !== 'closed') current = {
      id: crypto.randomUUID(), session_id: sessionId, tab_id: payload.tabId, visit_id: visitId,
      ...payload.location, state, booking_seen: !!payload.location.booking && /^\/admin\/reservations\/[^/]+\/?$/.test(payload.location.pathname) && payload.visible && payload.focused,
      started_at: new Date(now).toISOString(), ended_at: new Date(now).toISOString(), sequence: 1, end_reason: 'checkpoint',
    };
    lastWall = now; lastMono = mono;
  }
  function change() {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; sample(); });
  }
  function checkpoint(keepalive = false) {
    sample(); if (current) store(current);
    lastFlush = Date.now(); void flush(keepalive);
  }
  sample(); checkpoint();
  const timer = setInterval(() => { sample(); if (Date.now()-lastFlush >= 30000) checkpoint(); },5000);
  const signingOut = async () => {
    sample('closed'); stopped = true; clearInterval(timer);
    await Promise.race([flush(true),new Promise(resolve => setTimeout(resolve,1500))]);
    pending.clear();
    await storageChain;
    await queueTransaction<void>((s,done) => {
      const request=s.getAll(); request.onsuccess=()=>{ (request.result as Stored[]).forEach(row=>{if(row.owner.startsWith(`${userId}:`))s.delete(row.key);}); done(); };
    }).catch(()=>{});
  };
  beforeSignOut = signingOut;
  return {
    change,
    suspend() { sample('closed'); suspended=true; void flush(true); },
    resume() { if(stopped)return; suspended=false; lastWall=Date.now(); lastMono=performance.now(); sample(); checkpoint(); },
    dispose() { sample('closed'); stopped=true; clearInterval(timer); void flush(true); if(beforeSignOut===signingOut) beforeSignOut=undefined; },
    flushHidden() { checkpoint(true); },
  };
}
