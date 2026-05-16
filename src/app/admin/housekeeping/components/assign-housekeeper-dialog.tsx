"use client";

import * as React from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useDataContext } from "@/context/data-context";
import type { User } from "@/data/types";

interface AssignHousekeeperDialogProps {
  roomId: string;
  currentAssigneeId?: string;
  housekeepers: User[];
  children: React.ReactNode;
}

export function AssignHousekeeperDialog({
  roomId,
  currentAssigneeId,
  housekeepers,
  children,
}: AssignHousekeeperDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<string>(
    currentAssigneeId || ""
  );
  const { assignHousekeeper } = useDataContext();

  const handleSave = () => {
    if (!selectedUserId || selectedUserId === "") {
      toast.error("Please select a housekeeper.");
      return;
    }
    assignHousekeeper({ roomId, userId: selectedUserId });
    const housekeeperName =
      housekeepers.find((h) => h.id === selectedUserId)?.name || "a housekeeper";
    toast.success(`Room assigned to ${housekeeperName}.`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold">
            Assign Housekeeper
          </DialogTitle>
          <DialogDescription>
            Choose a housekeeper to clean this room.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="housekeeper-select" className="text-sm font-medium">
            Housekeeper
          </Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger
              id="housekeeper-select"
              className="h-11 rounded-xl border-border/50 bg-card/80"
            >
              <SelectValue placeholder="Select a housekeeper" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/40 bg-card/95 backdrop-blur">
              {housekeepers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="pt-2">
          <Button type="button" onClick={handleSave}>
            Save Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
