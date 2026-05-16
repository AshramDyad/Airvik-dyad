"use client";

import * as React from "react";
import { toast } from "sonner";

import { PermissionGate } from "@/components/admin/permission-gate";
import type { Room } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { columns } from "./columns";
import { RoomsDataTable } from "./data-table";
import type { AdminRoomTypeSummary } from "./types";

type AdminRoomsApiResponse = {
  data?: {
    rooms: Room[];
    roomTypes: AdminRoomTypeSummary[];
  };
  message?: string;
};

export function RoomsPanel() {
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<AdminRoomTypeSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadRooms = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authorizedFetch("/api/admin/rooms", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | AdminRoomsApiResponse
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to load rooms");
      }

      setRooms(payload?.data?.rooms ?? []);
      setRoomTypes(payload?.data?.roomTypes ?? []);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message ?? "Failed to load rooms");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  return (
    <PermissionGate feature="rooms">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rooms...</p>
        ) : (
          <RoomsDataTable
            columns={columns}
            data={rooms}
            roomTypes={roomTypes}
            onRefresh={loadRooms}
          />
        )}
      </div>
    </PermissionGate>
  );
}
