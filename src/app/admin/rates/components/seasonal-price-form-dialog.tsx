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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeasonalPrice } from "@/data/types";
import { useDataContext } from "@/context/data-context";
import type { AdminRateRoomTypeOption } from "./types";

const seasonalPriceSchema = z
  .object({
    roomTypeId: z.string().min(1, "Room type is required."),
    name: z.string().min(1, "Name is required."),
    price: z.coerce.number().min(1, "Price must be greater than 0."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

interface SeasonalPriceFormDialogProps {
  seasonalPrice?: SeasonalPrice;
  roomTypes: AdminRateRoomTypeOption[];
  onSaved?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function SeasonalPriceFormDialog({
  seasonalPrice,
  roomTypes,
  onSaved,
  children,
}: SeasonalPriceFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { addSeasonalPrice, updateSeasonalPrice } = useDataContext();
  const isEditing = !!seasonalPrice;

  const form = useForm<z.infer<typeof seasonalPriceSchema>>({
    resolver: zodResolver(seasonalPriceSchema),
    defaultValues: {
      roomTypeId: seasonalPrice?.roomTypeId || "",
      name: seasonalPrice?.name || "",
      price: seasonalPrice?.price || 0,
      startDate: seasonalPrice?.startDate || "",
      endDate: seasonalPrice?.endDate || "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        roomTypeId: seasonalPrice?.roomTypeId ?? "",
        name: seasonalPrice?.name ?? "",
        price: seasonalPrice?.price ?? 0,
        startDate: seasonalPrice?.startDate ?? "",
        endDate: seasonalPrice?.endDate ?? "",
      });
    }
  }, [open, seasonalPrice, form]);

  async function onSubmit(values: z.infer<typeof seasonalPriceSchema>) {
    try {
      if (isEditing && seasonalPrice) {
        await updateSeasonalPrice(seasonalPrice.id, values, seasonalPrice);
      } else {
        const roomType = roomTypes.find((rt) => rt.id === values.roomTypeId);
        await addSeasonalPrice(values, roomType?.name);
      }
      await onSaved?.();

      toast.success(
        `Seasonal price ${isEditing ? "updated" : "created"} successfully!`
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      const message = (error as { message?: string })?.message || "Failed to save seasonal price";
      const isOverlap = message.toLowerCase().includes("overlap") ||
        message.toLowerCase().includes("exclude") ||
        message.toLowerCase().includes("conflicting");
      toast.error(
        isOverlap
          ? "Overlapping date range for this room type"
          : "Failed to save seasonal price",
        { description: message }
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Seasonal Price" : "Add Seasonal Price"}
          </DialogTitle>
          <DialogDescription>
            Set a price override for a room type during a specific date range.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>
                          {rt.name}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Diwali Season, Summer Peak"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (per night)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Seasonal Price"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
