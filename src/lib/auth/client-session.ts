"use client";

import { supabase } from "@/integrations/supabase/client";

// A missing session is known to happen before a request is dispatched.
export class ClientSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientSessionError";
  }
}

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
    throw new ClientSessionError("Please sign in again to continue.");
  }

  const { retryOnUnauthorized = true, headers, ...rest } = options;
  const response = await fetch(input, {
    ...rest,
    headers: {
      ...(headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await getValidSession();
    if (!refreshed) {
      throw new ClientSessionError("Session expired. Please sign in again.");
    }
    return fetch(input, {
      ...rest,
      headers: {
        ...(headers || {}),
        Authorization: `Bearer ${refreshed.access_token}`,
      },
    });
  }

  return response;
}
