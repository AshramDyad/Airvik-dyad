"use client";

import { supabase } from "@/integrations/supabase/client";

export async function getValidSession() {
  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session) {
    return data.session;
  }

  // getSession() already handles token refresh internally.
  // Explicit refreshSession() fallback doubled refresh requests,
  // accelerating rate limit exhaustion on shared IPs (CGNAT).
  return null;
}

export type AuthorizedFetchOptions = RequestInit & { retryOnUnauthorized?: boolean };

export async function authorizedFetch(
  input: RequestInfo | URL,
  options: AuthorizedFetchOptions = {}
) {
  const session = await getValidSession();
  if (!session) {
    throw new Error("Please sign in again to continue.");
  }

  const { retryOnUnauthorized = true, headers, cache, ...rest } = options;
  const cacheMode = cache ?? "no-store";
  const response = await fetch(input, {
    ...rest,
    cache: cacheMode,
    headers: {
      ...(headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await getValidSession();
    if (!refreshed) {
      throw new Error("Session expired. Please sign in again.");
    }
    return fetch(input, {
      ...rest,
      cache: cacheMode,
      headers: {
        ...(headers || {}),
        Authorization: `Bearer ${refreshed.access_token}`,
      },
    });
  }

  return response;
}
