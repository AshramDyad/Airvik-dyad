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
import { PropertyClosureFormDialog } from "./property-closure-form-dialog";

export function PropertyClosuresSection() {
  const { propertyClosures, roomTypes, deletePropertyClosure } =
    useDataContext();
  const { hasPermission } = useAuthContext();
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    label: string;
  } | null>(null);

  const roomTypeNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    roomTypes.forEach((rt) => map.set(rt.id, rt.name));
    return map;
  }, [roomTypes]);

  const handleDelete = async (id: string, label: string) => {
    try {
      await deletePropertyClosure(id);
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
          <PropertyClosureFormDialog>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add Blocked Dates
            </Button>
          </PropertyClosureFormDialog>
        )}
      </div>
      {propertyClosures.length === 0 ? (
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
              {propertyClosures.map((closure) => {
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
                          <PropertyClosureFormDialog closure={closure}>
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
                              setDeleteTarget({ id: closure.id, label })
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
            handleDelete(deleteTarget.id, deleteTarget.label);
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget?.label ? `"${deleteTarget.label}"` : undefined}
      />
    </div>
  );
}
