"use client";

import { sendGAEvent } from "@next/third-parties/google";

/**
 * Conversion events we track in GA4. Keep names snake_case, lowercase, starting
 * with a letter, ≤40 chars, and avoid GA reserved names/prefixes
 * (page_view, click, ga_, google_, firebase_).
 */
export type AnalyticsEvent =
  | "book_click"
  | "call_click"
  | "whatsapp_click"
  | "donate_click";

type EventParams = Record<string, string | number | boolean>;

/**
 * Fire a GA4 event. Safe no-op when GA is not configured
 * (NEXT_PUBLIC_GA_ID unset) — keeps local dev / previews clean.
 */
export function trackEvent(name: AnalyticsEvent, params: EventParams = {}) {
  if (!process.env.NEXT_PUBLIC_GA_ID) return;
  sendGAEvent("event", name, params);
}
