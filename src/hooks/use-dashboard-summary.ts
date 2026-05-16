"use client";

import * as React from "react";

import { authorizedFetch } from "@/lib/auth/client-session";
import type {
  DashboardSummaryPayload,
  DashboardSummaryResponse,
} from "@/lib/dashboard/summary";

type UseDashboardSummaryResult = {
  summary: DashboardSummaryPayload | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useDashboardSummary(date: string): UseDashboardSummaryResult {
  const [summary, setSummary] = React.useState<DashboardSummaryPayload | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const normalizedDate = date.trim();

  const reload = React.useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  React.useEffect(() => {
    if (!normalizedDate) {
      setSummary(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ date: normalizedDate });

    setIsLoading(true);
    setError(null);

    authorizedFetch(`/api/admin/dashboard/summary?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(
            payload?.message ?? "Failed to load dashboard summary",
          );
        }

        return (await response.json()) as DashboardSummaryResponse;
      })
      .then((payload) => {
        setSummary(payload.data);
      })
      .catch((caughtError: unknown) => {
        if (isAbortError(caughtError)) {
          return;
        }

        setSummary(null);
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load dashboard summary"),
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
  }, [normalizedDate, reloadKey]);

  return {
    summary,
    isLoading,
    error,
    reload,
  };
}
