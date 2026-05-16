"use client";

import * as React from "react";
import { toast } from "sonner";

import { PermissionGate } from "@/components/admin/permission-gate";
import type { RatePlan, SeasonalPrice } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { columns } from "./columns";
import { RatePlansDataTable } from "./data-table";
import { SeasonalPricesSection } from "./seasonal-prices-section";
import type { AdminRateRoomTypeOption } from "./types";

type AdminRatesApiResponse = {
  data?: {
    ratePlans: RatePlan[];
    seasonalPrices: SeasonalPrice[];
    roomTypes: AdminRateRoomTypeOption[];
  };
  message?: string;
};

export function RatesPanel() {
  const [ratePlans, setRatePlans] = React.useState<RatePlan[]>([]);
  const [seasonalPrices, setSeasonalPrices] = React.useState<SeasonalPrice[]>(
    [],
  );
  const [roomTypes, setRoomTypes] = React.useState<AdminRateRoomTypeOption[]>(
    [],
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const loadRates = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authorizedFetch("/api/admin/rates", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | AdminRatesApiResponse
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to load rates data");
      }

      setRatePlans(payload?.data?.ratePlans ?? []);
      setSeasonalPrices(payload?.data?.seasonalPrices ?? []);
      setRoomTypes(payload?.data?.roomTypes ?? []);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message ?? "Failed to load rates data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRates();
  }, [loadRates]);

  return (
    <PermissionGate feature="ratePlans">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rates...</p>
        ) : (
          <>
            <RatePlansDataTable
              columns={columns}
              data={ratePlans}
              onRefresh={loadRates}
            />
            <SeasonalPricesSection
              roomTypes={roomTypes}
              seasonalPrices={seasonalPrices}
              onRefresh={loadRates}
            />
          </>
        )}
      </div>
    </PermissionGate>
  );
}
