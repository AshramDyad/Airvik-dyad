"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@/data/admin-nav";
import { ADMIN_SHELL_ROLES } from "@/constants/roles";
import { useAuthContext } from "@/context/auth-context";
import { useSessionContext } from "@/context/session-context";
import { supabase } from "@/integrations/supabase/client";
import { IDLE_MS, type LiveLocation } from "@/lib/admin-live/model";
import { createLiveTransport, type LiveTransport } from "@/lib/admin-live/transport";

import { createHistoryRecorder } from "@/lib/admin-history/recorder";

type SurfaceKind = "section" | "dialog" | "booking";
type Surface = { pathname: string; kind: SurfaceKind; label: string };
type Register = (id: string, surface: Surface) => () => void;
const SurfaceContext = React.createContext<Register | null>(null);
const TransportContext = React.createContext<LiveTransport | null>(null);
let documentTabId: string | undefined;

function pageLabel(pathname: string) {
  const labels = new Map<string, string>([["/admin/settings", "Settings"], ["/admin/dashboard", "Dashboard"]]);
  type NavLabel = { href: string; label: string; children?: readonly NavLabel[] };
  function add(items: readonly NavLabel[]) {
    items.forEach(item => { labels.set(item.href, item.label); if (item.children) add(item.children); });
  }
  ADMIN_NAV_ITEMS.forEach(item => { labels.set(item.href, item.label); if (item.subItems) add(item.subItems); });
  const match = [...labels.keys()].sort((a, b) => b.length - a.length)
    .find(path => pathname === path || pathname.startsWith(`${path}/`));
  const base = match ? labels.get(match)! : "Admin";
  if (pathname.endsWith("/edit")) return `${base} · Edit`;
  if (pathname.endsWith("/new") || pathname.endsWith("/create")) return `${base} · Create`;
  if (pathname.endsWith("/preview")) return `${base} · Preview`;
  return pathname === match ? base : `${base} · Details`;
}

export function AdminLiveProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const { currentUser, userRole } = useAuthContext();
  const { session } = useSessionContext();
  const [tokenUsable, setTokenUsable] = React.useState(false);
  const [signedOut, setSignedOut] = React.useState(false);
  const [transport, setTransport] = React.useState<LiveTransport | null>(null);
  const transportRef = React.useRef<LiveTransport | null>(null);
  const historyRef = React.useRef<ReturnType<typeof createHistoryRecorder> | null>(null);
  const sessionRef = React.useRef(session);
  sessionRef.current = session;
  const surfaces = React.useRef(new Map<string, Surface>());
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;

  React.useEffect(() => {
    const remaining = (session?.expires_at ?? 0) * 1000 - Date.now();
    setTokenUsable(remaining > 0);
    if (remaining <= 0) return;
    const timer = setTimeout(() => setTokenUsable(false), remaining);
    return () => clearTimeout(timer);
  }, [session?.expires_at]);

  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setSignedOut(true);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setSignedOut(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const register = React.useCallback<Register>((id, surface) => {
    surfaces.current.set(id, surface);
    transportRef.current?.publish();
    historyRef.current?.change();
    return () => {
      surfaces.current.delete(id);
      transportRef.current?.publish();
      historyRef.current?.change();
    };
  }, []);

  const userId = currentUser?.id;
  const enabled = tokenUsable && !signedOut && ADMIN_SHELL_ROLES.some(role => role === userRole?.name);
  React.useEffect(() => {
    if (!enabled || !userId) return;
    documentTabId ??= crypto.randomUUID();
    const tabId = documentTabId;
    let lastInteraction = performance.now();
    const getPayload = () => {
      const path = pathRef.current;
      const location: LiveLocation = { pathname: path, page: pageLabel(path), section: null, dialog: null, booking: null };
      surfaces.current.forEach(surface => {
        if (surface.pathname === path) location[surface.kind] = surface.label;
      });
      return {
        version: 1 as const, tabId, location,
        visible: document.visibilityState === "visible",
        focused: document.hasFocus(),
        idle: performance.now() - lastInteraction >= IDLE_MS,
      };
    };
    const live = createLiveTransport(supabase, userId, getPayload);
    transportRef.current = live;
    setTransport(live);
    const history = createHistoryRecorder(userId, () => sessionRef.current, getPayload);
    historyRef.current = history;
    const interaction = () => {
      const wasIdle = performance.now() - lastInteraction >= IDLE_MS;
      lastInteraction = performance.now();
      if (wasIdle) { live.publish(); history.change(); }
    };
    const visibility = () => { live.publish(); history.change(); if (document.visibilityState === "hidden") history.flushHidden?.(); };
    const hide = () => { history.suspend(); live.suspend(); };
    const show = () => { history.resume(); live.resume(); live.publish(); };
    const offline = () => live.suspend();
    const online = () => live.resume();
    const interactionEvents = ["pointerdown", "pointermove", "keydown", "scroll"] as const;
    interactionEvents.forEach(event => document.addEventListener(event, interaction, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      history.dispose();
      historyRef.current = null;
      live.dispose();
      transportRef.current = null;
      setTransport(null);
      interactionEvents.forEach(event => document.removeEventListener(event, interaction, true));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [enabled, userId]);

  React.useEffect(() => { transportRef.current?.publish(); historyRef.current?.change(); }, [pathname]);

  return <SurfaceContext.Provider value={register}>
    <TransportContext.Provider value={transport}>{children}</TransportContext.Provider>
  </SurfaceContext.Provider>;
}

/** Fixed labels only. Calls outside the authenticated admin layout are no-ops. */
export function useAdminLiveSurface(kind: SurfaceKind, label: string | null | undefined, enabled = true) {
  const register = React.useContext(SurfaceContext);
  const pathname = usePathname() ?? "/admin";
  const id = React.useId();
  React.useEffect(() => {
    if (!register || !enabled || !label) return;
    return register(id, { pathname, kind, label });
  }, [register, id, pathname, kind, label, enabled]);
}

export function useAdminLiveTransport() { return React.useContext(TransportContext); }
