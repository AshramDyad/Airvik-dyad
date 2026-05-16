"use client";

import * as React from "react";

import { authorizedFetch } from "@/lib/auth/client-session";
import {
  createEmptyAdminReservationFormData,
  type AdminReservationFormData,
} from "@/lib/reservations/admin-form-data";

type AdminReservationFormDataPayload = {
  data?: AdminReservationFormData;
  message?: string;
};

export function useAdminReservationFormData() {
  const [data, setData] = React.useState<AdminReservationFormData>(() =>
    createEmptyAdminReservationFormData(),
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch(
        "/api/admin/reservations/form-data",
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as AdminReservationFormDataPayload | null;
        throw new Error(
          payload?.message || "Failed to load reservation form data.",
        );
      }

      const payload =
        (await response.json()) as AdminReservationFormDataPayload;
      setData(payload.data ?? createEmptyAdminReservationFormData());
    } catch (loadError) {
      setData(createEmptyAdminReservationFormData());
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load reservation form data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...data,
    isLoading,
    error,
    refresh,
  };
}
