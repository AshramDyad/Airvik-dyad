"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { type Room, type RoomStatus } from "@/data/types";
import { useDataContext } from "@/context/data-context";
import { MultiImageUpload } from "@/components/shared/multi-image-upload";
import type { AdminRoomTypeSummary } from "./types";

const roomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required."),
  roomTypeId: z.string({ required_error: "Please select a room type." }),
  status: z.string({ required_error: "Please select a status." }),
  photos: z.array(z.string()).optional(),
});

interface RoomFormDialogProps {
  room?: Room;
  rooms: Room[];
  roomTypes: AdminRoomTypeSummary[];
  onSaved?: () => void | Promise<void>;
  children: React.ReactNode;
}

const statuses: RoomStatus[] = ["Clean", "Dirty", "Inspected", "Maintenance"];

const normalizeRoomNumber = (value: string) => value.trim().toLowerCase();

export function RoomFormDialog({
  room,
  rooms,
  roomTypes,
  onSaved,
  children,
}: RoomFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { addRoom, updateRoom } = useDataContext();
  const isEditing = !!room;

  const form = useForm<z.infer<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      roomNumber: room?.roomNumber || "",
      roomTypeId: room?.roomTypeId || "",
      status: room?.status || "Clean",
      photos: room?.photos || [],
    },
  });

  async function onSubmit(values: z.infer<typeof roomSchema>) {
    const trimmedRoomNumber = values.roomNumber.trim();
    const roomData = {
      ...values,
      roomNumber: trimmedRoomNumber,
      status: values.status as RoomStatus,
      photos: values.photos || [],
    };
    const normalizedInputNumber = normalizeRoomNumber(trimmedRoomNumber);
    const duplicateInRoomType = rooms.some((existingRoom) => {
      if (isEditing && room && existingRoom.id === room.id) {
        return false;
      }
      return (
        existingRoom.roomTypeId === roomData.roomTypeId &&
        normalizeRoomNumber(existingRoom.roomNumber) === normalizedInputNumber
      );
    });

    if (duplicateInRoomType) {
      toast.error("Room number already exists", {
        description: `Room number ${roomData.roomNumber} already exists in this room type.`,
      });
      return;
    }

    try {
      if (isEditing && room) {
        await updateRoom(room.id, roomData, room);
      } else {
        await addRoom(roomData);
      }
      await onSaved?.();
      
      toast.success(
        `Room ${isEditing ? "updated" : "created"} successfully!`
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save room", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Room" : "Add New Room"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the physical room.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="roomNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a room type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="photos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room-Specific Photos</FormLabel>
                  <FormControl>
                    <MultiImageUpload
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Room"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
