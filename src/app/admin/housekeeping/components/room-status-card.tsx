"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoomStatus, User } from "@/data/types";
import { cn } from "@/lib/utils";
import { ROOM_STATUS_LABELS } from "@/lib/rooms";
import { User as UserIcon } from "lucide-react";
import { UpdateStatusDialog } from "./update-status-dialog";
import { AssignHousekeeperDialog } from "./assign-housekeeper-dialog";
import type { HousekeepingRoomWithDetails } from "../types";

interface RoomStatusCardProps {
  room: HousekeepingRoomWithDetails;
  housekeepers: User[];
  onStatusUpdate: (roomId: string, newStatus: RoomStatus) => void;
}

const statusStyles: Record<RoomStatus, { className: string }> = {
  Clean: {
    className: "border border-accent/50 bg-accent/30 text-accent-foreground",
  },
  Inspected: {
    className: "border border-primary/40 bg-primary/10 text-primary",
  },
  Dirty: {
    className: "border border-destructive/40 bg-destructive/10 text-destructive",
  },
  Maintenance: {
    className:
      "border border-secondary/50 bg-secondary/30 text-secondary-foreground",
  },
};

export function RoomStatusCard({
  room,
  housekeepers,
  onStatusUpdate,
}: RoomStatusCardProps) {
  const { className } = statusStyles[room.status];
  const label = ROOM_STATUS_LABELS[room.status];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="font-serif text-lg font-semibold">Room {room.roomNumber}</CardTitle>
            <CardDescription>{room.roomTypeName}</CardDescription>
          </div>
          <Badge
            className={cn(
              "self-start rounded-full px-3 py-1 text-xs font-medium",
              className
            )}
          >
            {label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {room.assignment && room.status === "Dirty" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <UserIcon className="h-4 w-4" />
            <span className="font-medium text-foreground">
              Assigned to: <span className="font-semibold">{room.housekeeperName}</span> ({room.assignment.status})
            </span>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/50 px-4 py-3 text-sm text-muted-foreground">
            Vacant
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-end gap-3 border-t border-border/40 px-6 py-4">
        {room.status === "Dirty" && (
          <AssignHousekeeperDialog
            roomId={room.id}
            currentAssigneeId={room.assignment?.assignedTo}
            housekeepers={housekeepers}
          >
            <Button variant="secondary" size="sm">
              {room.assignment ? "Re-assign" : "Assign"}
            </Button>
          </AssignHousekeeperDialog>
        )}
        <UpdateStatusDialog
          room={room}
          onUpdate={(newStatus) => onStatusUpdate(room.id, newStatus)}
        >
          <Button variant="outline" size="sm">
            Update Status
          </Button>
        </UpdateStatusDialog>
      </CardFooter>
    </Card>
  );
}
