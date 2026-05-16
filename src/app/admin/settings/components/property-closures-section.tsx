"use client";

import * as React from "react";
import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useDataContext } from "@/context/data-context";
import { useAuthContext } from "@/context/auth-context";
import type { PropertyClosure, RoomType } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { PropertyClosureFormDialog } from "./property-closure-form-dialog";

type RoomTypeOption = Pick<RoomType, "id" | "name">;

type PropertyClosuresApiResponse = {
  data?: {
    propertyClosures?: PropertyClosure[];
    roomTypes?: RoomTypeOption[];
  };
  message?: string;
};

export function PropertyClosuresSection() {
  const { property, deletePropertyClosure } = useDataContext();
  const { hasPermission } = useAuthContext();
  const [closures, setClosures] = React.useState<PropertyClosure[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = React.useState<
    RoomTypeOption[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    closure: PropertyClosure;
    label: string;
  } | null>(null);

  const loadClosureData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authorizedFetch(
        "/api/admin/settings/property-closures",
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | PropertyClosuresApiResponse
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.message ?? "Failed to load blocked date ranges",
        );
      }

      setClosures(payload?.data?.propertyClosures ?? []);
      setRoomTypeOptions(payload?.data?.roomTypes ?? []);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message ?? "Failed to load blocked dates.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadClosureData();
  }, [loadClosureData]);

  const roomTypeNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    roomTypeOptions.forEach((rt) => map.set(rt.id, rt.name));
    return map;
  }, [roomTypeOptions]);

  const handleDelete = async (closure: PropertyClosure, label: string) => {
    try {
      const success = await deletePropertyClosure(closure.id, closure);
      if (!success) {
        throw new Error("Failed to delete blocked dates.");
      }
      setClosures((current) => current.filter((item) => item.id !== closure.id));
      toast.success(`Deleted blocked dates: ${label}`);
    } catch {
      toast.error("Failed to delete blocked dates.");
    }
  };

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Blocked Date Ranges</h2>
          <p className="text-sm text-muted-foreground">
            Users cannot book rooms during blocked periods. Admin bookings are
            not affected.
          </p>
        </div>
        {hasPermission("update:setting") && (
          <PropertyClosureFormDialog
            propertyId={property.id}
            roomTypes={roomTypeOptions}
            onSaved={loadClosureData}
          >
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add Blocked Dates
            </Button>
          </PropertyClosureFormDialog>
        )}
      </div>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">
          Loading blocked date ranges...
        </p>
      ) : closures.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No blocked date ranges configured. Add one to prevent user bookings
          during a specific period.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableCaption className="sr-only">
              Blocked date ranges for user bookings
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.map((closure) => {
                const label =
                  closure.reason ??
                  `${closure.startDate} – ${closure.endDate}`;
                return (
                  <TableRow key={closure.id}>
                    <TableCell>
                      {format(
                        new Date(closure.startDate + "T00:00:00"),
                        "MMM d, yyyy"
                      )}
                    </TableCell>
                    <TableCell>
                      {format(
                        new Date(closure.endDate + "T00:00:00"),
                        "MMM d, yyyy"
                      )}
                    </TableCell>
                    <TableCell>
                      {closure.roomTypeId
                        ? (roomTypeNameMap.get(closure.roomTypeId) ?? "Unknown")
                        : "All Rooms"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {closure.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {hasPermission("update:setting") && (
                          <PropertyClosureFormDialog
                            closure={closure}
                            propertyId={property.id}
                            roomTypes={roomTypeOptions}
                            onSaved={loadClosureData}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Edit blocked dates"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </PropertyClosureFormDialog>
                        )}
                        {hasPermission("update:setting") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            aria-label={`Delete blocked dates ${label}`}
                            onClick={() =>
                              setDeleteTarget({ closure, label })
                            }
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            handleDelete(deleteTarget.closure, deleteTarget.label);
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget?.label ? `"${deleteTarget.label}"` : undefined}
      />
    </div>
  );
}
