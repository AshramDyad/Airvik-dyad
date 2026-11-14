"use client";

import * as React from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAdminLiveTransport } from "@/context/admin-live-context";
import { isFreshState, observeSnapshot, tabState, userState, type LiveState, type ObservedUser } from "@/lib/admin-live/model";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const rosterSchema = z.array(z.object({ id: z.string().uuid(), name: z.string(), email: z.string(), role: z.string() }));
type Member = z.infer<typeof rosterSchema>[number];

function Status({ state }: { state: LiveState }) {
  return <Badge variant={state === "Active" ? "default" : "secondary"} className={state === "Active" ? "bg-emerald-700 text-white" : ""}>{state}</Badge>;
}

export function LiveActivity() {
  const transport = useAdminLiveTransport();
  const [members, setMembers] = React.useState<Member[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [retry, setRetry] = React.useState(0);
  const [observed, setObserved] = React.useState<Record<string, ObservedUser>>({});
  const [now, setNow] = React.useState(0);
  const watchers = React.useRef(new Map<string, () => void>());

  React.useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    async function refresh() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { data, error: rpcError } = await supabase.rpc("get_admin_live_roster").abortSignal(controller.signal);
        if (cancelled) return;
        if (rpcError) throw rpcError;
        setMembers(rosterSchema.parse(data));
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Live activity is unavailable. Check your connection or try again.");
          setMembers([]);
          setObserved({});
        }
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    }
    const visibility = () => {
      // Never reuse green statuses after this observer has been suspended.
      setObserved({});
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", visibility);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", visibility);
    };
  }, [retry]);

  React.useEffect(() => {
    setObserved({});
    return () => {
      watchers.current.forEach(stop => stop());
      watchers.current.clear();
    };
  }, [transport]);

  React.useEffect(() => {
    const ids = new Set(members.map(member => member.id));
    watchers.current.forEach((stop, id) => {
      if (!ids.has(id)) { stop(); watchers.current.delete(id); }
    });
    if (!transport) return;
    members.forEach(member => {
      if (watchers.current.has(member.id)) return;
      watchers.current.set(member.id, transport.watch(member.id, snapshot => {
        const receivedAt = performance.now();
        setNow(receivedAt);
        setObserved(previous => ({ ...previous, [member.id]: observeSnapshot(previous[member.id], snapshot, receivedAt) }));
      }));
    });
  }, [members, transport]);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 1000);
    setNow(performance.now());
    return () => clearInterval(timer);
  }, []);

  const onlineUsers = members.filter(member => transport && isFreshState(userState(observed[member.id], now))).length;
  const connectedTabs = transport ? members.reduce((count, member) => count + (observed[member.id]?.tabs.filter(tab => isFreshState(tabState(tab, now))).length ?? 0), 0) : 0;

  return <Card>
    <CardHeader>
      <CardTitle>Live now</CardTitle>
      <CardDescription>Current admin pages and tabs. Visible only to your account.</CardDescription>
      <p className="text-sm font-medium">{onlineUsers} online {onlineUsers === 1 ? "user" : "users"} · {connectedTabs} connected {connectedTabs === 1 ? "tab" : "tabs"}</p>
      <p className="text-xs text-muted-foreground">Active means a focused tab with recent interaction. Updates can take up to 8 seconds. Last update is a live report, not a login time.</p>
    </CardHeader>
    <CardContent className="space-y-3">
      {loading ? <p role="status" className="text-sm text-muted-foreground">Checking admin connections…</p> : null}
      {error ? <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border p-3"><p className="text-sm">{error}</p><Button variant="outline" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</Button></div> : null}
      {!transport && !loading && !error ? <p role="status" className="text-sm text-muted-foreground">Live connection unavailable. Waiting for a valid session…</p> : null}
      {members.map(member => {
        const user = observed[member.id];
        const state = transport ? userState(user, now) : "Connection lost";
        const tabs = user?.status === "live" ? user.tabs : [];
        return <details key={member.id} className="rounded-xl border border-border/60 bg-card">
          <summary className="cursor-pointer rounded-xl px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <span className="ml-2 inline-flex w-[calc(100%-2rem)] flex-wrap items-center justify-between gap-3 align-middle">
              <span><span className="font-medium">{member.name}</span><span className="ml-2 text-xs text-muted-foreground"> {member.role}</span><span className="block text-xs text-muted-foreground">{member.email}</span></span>
              <span className="inline-flex items-center gap-2"><span className="text-xs text-muted-foreground">{tabs.length} {tabs.length === 1 ? "tab" : "tabs"}</span><Status state={state} /></span>
            </span>
          </summary>
          <div className="overflow-x-auto border-t px-4 py-3">
            {tabs.length ? <table className="w-full text-left text-sm">
              <caption className="sr-only">Open admin tabs for {member.name}</caption>
              <thead><tr className="text-xs text-muted-foreground">{["Tab", "State", "Page", "Selected section", "Open dialog", "Last update"].map(title => <th key={title} scope="col" className="px-2 py-2 font-medium">{title}</th>)}</tr></thead>
              <tbody>{tabs.map(tab => {
                const location = tab.payload.location;
                const seconds = tab.receivedAt === null ? null : Math.max(0, Math.floor((now - tab.receivedAt) / 1000));
                return <tr key={tab.payload.tabId} className="border-t">
                  <td className="whitespace-nowrap px-2 py-3">Tab {tab.payload.tabId.slice(0, 6)}</td>
                  <td className="px-2 py-3"><Status state={tabState(tab, now)} /></td>
                  <td className="px-2 py-3"><span>{location.page}{location.booking ? ` · ${location.booking}` : ""}</span><span className="block break-all text-xs text-muted-foreground">{location.pathname}</span></td>
                  <td className="px-2 py-3">{location.section ?? "—"}</td>
                  <td className="px-2 py-3">{location.dialog ? `${location.dialog} dialog open` : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-3">{seconds === null ? "Waiting for fresh report" : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`}</td>
                </tr>;
              })}</tbody>
            </table> : <p className="text-sm text-muted-foreground">{state === "Not connected" ? "No tab connected to live tracking. Existing admin tabs need one reload after deployment." : "Waiting for live connection information."}</p>}
          </div>
        </details>;
      })}
      <p className="text-xs text-muted-foreground">Background or sleeping tabs can become stale. Tab labels identify app connections, not browser tab positions. Live activity is not saved as history.</p>
    </CardContent>
  </Card>;
}
