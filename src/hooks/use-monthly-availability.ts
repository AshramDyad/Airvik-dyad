"use client";

import * as React from "react";
import { addMonths, startOfMonth } from "date-fns";

import type { RoomTypeAvailability } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";

export const formatMonthStart = (value: Date): string => {
  const normalized = new Date(value.getFullYear(), value.getMonth(), 1);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = '01';
  return `${year}-${month}-${day}`;
};

type MonthlyAvailabilityResponse = {
  data: RoomTypeAvailability[];
};

const normalizeRoomTypeKey = (roomTypeIds?: string[]) => {
  if (!roomTypeIds || roomTypeIds.length === 0) {
    return "all";
  }
  const normalized = Array.from(
    new Set(roomTypeIds.map((id) => id.trim()).filter(Boolean))
  ).sort();
  return normalized.length > 0 ? normalized.join(",") : "all";
};

const getRoomTypeIdsFromKey = (roomTypeKey: string) =>
  roomTypeKey === "all" ? undefined : roomTypeKey.split(",");

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const fetchMonthlyAvailability = async (
  monthStart: string,
  roomTypeKey: string,
  signal?: AbortSignal
): Promise<RoomTypeAvailability[]> => {
  const params = new URLSearchParams({ monthStart });
  const roomTypeIds = getRoomTypeIdsFromKey(roomTypeKey);
  if (roomTypeIds?.length) {
    params.set("roomTypeIds", roomTypeIds.join(","));
  }

  const response = await authorizedFetch(
    `/api/admin/availability/monthly?${params.toString()}`,
    {
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message ?? "Failed to load monthly availability");
  }

  const payload = (await response.json()) as MonthlyAvailabilityResponse;
  return payload.data ?? [];
};

export function useMonthlyAvailability(
  month: Date,
  roomTypeIds?: string[]
) {
  const [data, setData] = React.useState<RoomTypeAvailability[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const monthStart = React.useMemo(() => formatMonthStart(month), [month]);
  const roomTypeKey = React.useMemo(
    () => normalizeRoomTypeKey(roomTypeIds),
    [roomTypeIds]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    let isSubscribed = true;
    setIsLoading(true);
    setError(null);

    fetchMonthlyAvailability(monthStart, roomTypeKey, controller.signal)
      .then((payload) => {
        if (!isSubscribed) return;
        setData(payload);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        if (isAbortError(err)) return;
        setError(err as Error);
        setData(null);
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [monthStart, roomTypeKey]);

  return { data, isLoading, error };
}

export function useMultiMonthAvailability(
  startMonth: Date,
  monthCount: number,
  roomTypeIds?: string[]
) {
  const normalizedCount = React.useMemo(() => {
    if (!Number.isFinite(monthCount)) return 1;
    return Math.max(1, Math.min(12, Math.trunc(monthCount)));
  }, [monthCount]);

  const monthSequence = React.useMemo(() => {
    return Array.from({ length: normalizedCount }, (_, index) =>
      startOfMonth(addMonths(startMonth, index))
    );
  }, [startMonth, normalizedCount]);

  const monthStarts = React.useMemo(
    () => monthSequence.map((monthDate) => formatMonthStart(monthDate)),
    [monthSequence]
  );

  const roomTypeKey = React.useMemo(
    () => normalizeRoomTypeKey(roomTypeIds),
    [roomTypeIds]
  );
  const monthStartKey = React.useMemo(() => monthStarts.join(","), [monthStarts]);

  const [dataByMonth, setDataByMonth] = React.useState<Record<string, RoomTypeAvailability[]>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    let isSubscribed = true;
    setIsLoading(true);
    setError(null);
    setDataByMonth({});

    Promise.all(
      monthStarts.map((monthStart) =>
        fetchMonthlyAvailability(monthStart, roomTypeKey, controller.signal)
      )
    )
      .then((payloads) => {
        if (!isSubscribed) return;
        const nextData: Record<string, RoomTypeAvailability[]> = {};
        payloads.forEach((payload, index) => {
          nextData[monthStarts[index]] = payload;
        });
        setDataByMonth(nextData);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        if (isAbortError(err)) return;
        setError(err as Error);
        setDataByMonth({});
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [monthStartKey, roomTypeKey]);

  return { dataByMonth, isLoading, error };
}
