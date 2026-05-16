"use client";

import * as React from "react";

import type { Guest } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";

type GuestProfileResponse = {
  data: Guest | null;
};

type UseGuestProfileResult = {
  guest: Guest | null;
  isLoading: boolean;
  error: Error | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useGuestProfile(
  guestId: string | null | undefined,
): UseGuestProfileResult {
  const [guest, setGuest] = React.useState<Guest | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!guestId) {
      setGuest(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    authorizedFetch(`/api/admin/guests/${encodeURIComponent(guestId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? "Failed to load guest profile");
        }

        return (await response.json()) as GuestProfileResponse;
      })
      .then((payload) => {
        setGuest(payload.data ?? null);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError)) {
          return;
        }

        setGuest(null);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load guest profile"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [guestId]);

  return { guest, isLoading, error };
}
