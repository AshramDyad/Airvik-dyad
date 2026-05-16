"use client";

import * as React from "react";

import { authorizedFetch } from "@/lib/auth/client-session";
import type { Guest } from "@/data/types";
import type { GuestsPageResponse } from "@/lib/guests/list";

type UseGuestsPageArgs = {
  limit: number;
  offset: number;
  query?: string;
};

type UseGuestsPageResult = {
  guests: Guest[];
  nextOffset: number | null;
  totalCount: number | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useGuestsPage({
  limit,
  offset,
  query = "",
}: UseGuestsPageArgs): UseGuestsPageResult {
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(null);
  const [totalCount, setTotalCount] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const normalizedLimit = Math.max(Number(limit) || 25, 1);
  const normalizedOffset = Math.max(Number(offset) || 0, 0);
  const normalizedQuery = query.trim();

  const reload = React.useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(normalizedLimit),
      offset: String(normalizedOffset),
    });

    if (normalizedQuery) {
      params.set("query", normalizedQuery);
    }

    setIsLoading(true);
    setError(null);

    authorizedFetch(`/api/admin/guests?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? "Failed to load guests");
        }

        return (await response.json()) as GuestsPageResponse;
      })
      .then((payload) => {
        setGuests(payload.data ?? []);
        setNextOffset(payload.nextOffset ?? null);
        setTotalCount(payload.count ?? null);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError)) {
          return;
        }

        setGuests([]);
        setNextOffset(null);
        setTotalCount(null);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load guests"),
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
  }, [normalizedLimit, normalizedOffset, normalizedQuery, reloadKey]);

  return {
    guests,
    nextOffset,
    totalCount,
    isLoading,
    error,
    reload,
  };
}
