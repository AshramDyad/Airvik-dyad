"use client";

import * as React from "react";
import { toast } from "sonner";

import { PermissionGate } from "@/components/admin/permission-gate";
import type { RoomCategory } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { columns } from "./columns";
import { RoomCategoriesDataTable } from "./data-table";

type RoomCategoriesApiResponse = {
  data?: RoomCategory[];
  message?: string;
};

export function RoomCategoriesPanel() {
  const [categories, setCategories] = React.useState<RoomCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadRoomCategories = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authorizedFetch("/api/admin/room-categories", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | RoomCategoriesApiResponse
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to load room categories");
      }

      setCategories(payload?.data ?? []);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message ?? "Failed to load room categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRoomCategories();
  }, [loadRoomCategories]);

  return (
    <PermissionGate feature="roomCategories">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading room categories...
          </p>
        ) : (
          <RoomCategoriesDataTable
            columns={columns}
            data={categories}
            onRefresh={loadRoomCategories}
          />
        )}
      </div>
    </PermissionGate>
  );
}
