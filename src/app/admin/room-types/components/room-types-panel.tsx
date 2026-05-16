"use client";

import * as React from "react";
import { toast } from "sonner";

import { PermissionGate } from "@/components/admin/permission-gate";
import type { RoomType } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { columns } from "./columns";
import { RoomTypesDataTable } from "./data-table";
import type { AdminRoomTypeAmenityOption } from "./types";

type AdminRoomTypesApiResponse = {
  data?: {
    roomTypes: RoomType[];
    amenities: AdminRoomTypeAmenityOption[];
  };
  message?: string;
};

export function RoomTypesPanel() {
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([]);
  const [amenities, setAmenities] = React.useState<
    AdminRoomTypeAmenityOption[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadRoomTypes = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authorizedFetch("/api/admin/room-types", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | AdminRoomTypesApiResponse
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to load room types");
      }

      setRoomTypes(payload?.data?.roomTypes ?? []);
      setAmenities(payload?.data?.amenities ?? []);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message ?? "Failed to load room types");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRoomTypes();
  }, [loadRoomTypes]);

  return (
    <PermissionGate feature="roomTypes">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading room types...</p>
        ) : (
          <RoomTypesDataTable
            columns={columns}
            data={roomTypes}
            amenities={amenities}
            onRefresh={loadRoomTypes}
          />
        )}
      </div>
    </PermissionGate>
  );
}
