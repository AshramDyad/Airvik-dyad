"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Room, RoomStatus } from "@/data/types";

interface UpdateStatusDialogProps {
  room: Room;
  onUpdate: (newStatus: RoomStatus) => void;
  children: React.ReactNode;
}

const availableStatuses: RoomStatus[] = [
  "Clean",
  "Dirty",
  "Inspected",
  "Maintenance",
];

export function UpdateStatusDialog({
  room,
  onUpdate,
  children,
}: UpdateStatusDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState<RoomStatus>(
    room.status
  );

  React.useEffect(() => {
    if (open) {
      setSelectedStatus(room.status);
    }
  }, [open, room.status]);

  const handleSave = () => {
    onUpdate(selectedStatus);
    setOpen(false);
  };

  return (
    <Dialog activityLabel="Update room status" open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold">
            Update Room {room.roomNumber} Status
          </DialogTitle>
          <DialogDescription>
            Select the new status for this room.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <RadioGroup
            value={selectedStatus}
            onValueChange={(value: RoomStatus) => setSelectedStatus(value)}
            className="space-y-3"
          >
            {availableStatuses.map((status) => (
              <div
                key={status}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/80 px-4 py-3"
              >
                <RadioGroupItem value={status} id={`status-${status}`} />
                <Label htmlFor={`status-${status}`} className="text-sm font-medium">
                  {status}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter className="pt-2">
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
