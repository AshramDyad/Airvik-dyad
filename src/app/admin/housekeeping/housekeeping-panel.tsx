"use client";

import * as React from "react";
import { formatISO } from "date-fns";
import { toast } from "sonner";
import { PermissionGate } from "@/components/admin/permission-gate";
import type { RoomStatus } from "@/data/types";
import { HousekeepingToolbar } from "./components/housekeeping-toolbar";
import { RoomStatusCard } from "./components/room-status-card";
import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import type { AdminHousekeepingData } from "./types";

type AdminHousekeepingApiResponse = {
  data?: AdminHousekeepingData;
  message?: string;
};

export default function HousekeepingPanel() {
  const { updateAssignmentStatus, updateRoom } = useDataContext();
  const today = React.useMemo(
    () => formatISO(new Date(), { representation: "date" }),
    [],
  );
  const [rooms, setRooms] = React.useState<AdminHousekeepingData["rooms"]>([]);
  const [roomTypes, setRoomTypes] = React.useState<
    AdminHousekeepingData["roomTypes"]
  >([]);
  const [assignments, setAssignments] = React.useState<
    AdminHousekeepingData["assignments"]
  >([]);
  const [housekeepers, setHousekeepers] = React.useState<
    AdminHousekeepingData["housekeepers"]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<RoomStatus | "all">(
    "all"
  );

  const loadHousekeeping = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ date: today });
      const response = await authorizedFetch(
        `/api/admin/housekeeping?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | AdminHousekeepingApiResponse
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to load housekeeping data");
      }

      setRooms(payload?.data?.rooms ?? []);
      setRoomTypes(payload?.data?.roomTypes ?? []);
      setAssignments(payload?.data?.assignments ?? []);
      setHousekeepers(payload?.data?.housekeepers ?? []);
    } catch (error) {
      console.error(error);
      toast.error(
        (error as Error).message ?? "Failed to load housekeeping data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  React.useEffect(() => {
    void loadHousekeeping();
  }, [loadHousekeeping]);

  const handleStatusUpdate = async (roomId: string, newStatus: RoomStatus) => {
    try {
      const room = rooms.find((item) => item.id === roomId);
      await updateRoom(roomId, { status: newStatus }, room);
      setRooms((currentRooms) =>
        currentRooms.map((item) =>
          item.id === roomId ? { ...item, status: newStatus } : item,
        ),
      );
      toast.success(`Room status updated to ${newStatus}.`);

      if (newStatus === "Clean") {
        updateAssignmentStatus(roomId, "Completed");
        setAssignments((currentAssignments) =>
          currentAssignments.map((assignment) =>
            assignment.roomId === roomId && assignment.date === today
              ? { ...assignment, status: "Completed" }
              : assignment,
          ),
        );
      }
    } catch (error) {
      toast.error("Failed to update room status.", {
        description: (error as Error).message,
      });
    }
  };

  const roomsWithDetails = React.useMemo(() => {
    return rooms.map((room) => {
      const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
      const assignment = assignments.find(
        (a) => a.roomId === room.id && a.date === today
      );
      const housekeeper = assignment
        ? housekeepers.find((u) => u.id === assignment.assignedTo)
        : undefined;
      return {
        ...room,
        roomTypeName: roomType?.name || "Unknown",
        assignment,
        housekeeperName: housekeeper?.name,
      };
    });
  }, [rooms, roomTypes, assignments, housekeepers, today]);

  const filteredRooms = React.useMemo(() => {
    if (statusFilter === "all") {
      return roomsWithDetails;
    }
    return roomsWithDetails.filter((room) => room.status === statusFilter);
  }, [statusFilter, roomsWithDetails]);

  return (
    <PermissionGate feature="housekeeping">
      <div className="space-y-6">
        <HousekeepingToolbar
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rooms...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRooms.map((room) => (
              <RoomStatusCard
                key={room.id}
                room={room}
                housekeepers={housekeepers}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
        {!isLoading && filteredRooms.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/40 bg-card/60 py-16 text-center text-muted-foreground">
            <p className="text-sm font-medium uppercase tracking-wide">
              No rooms match the selected status
            </p>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
