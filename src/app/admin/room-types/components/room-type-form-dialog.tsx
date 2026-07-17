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
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { RoomType } from "@/data/types";
import { useDataContext } from "@/context/data-context";
import { MultiImageUpload } from "@/components/shared/multi-image-upload";

const roomTypeSchema = z.object({
  name: z.string().min(1, "Room type name is required."),
  description: z.string().optional(),
  maxOccupancy: z.coerce.number().min(1, "Max occupancy must be at least 1."),
  bedTypes: z.string().min(1, "Please enter at least one bed type."),
  price: z.coerce.number().min(0, "Price must be zero or higher."),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).optional(),
  mainPhotoUrl: z.string().optional(),
  isVisible: z.boolean(),
});

interface RoomTypeFormDialogProps {
  roomType?: RoomType;
  children: React.ReactNode;
}

export function RoomTypeFormDialog({
  roomType,
  children,
}: RoomTypeFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { amenities: allAmenities, addRoomType, updateRoomType } = useDataContext();
  const isEditing = !!roomType;

  const form = useForm<z.infer<typeof roomTypeSchema>>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: roomType?.name || "",
      description: roomType?.description || "",
      maxOccupancy: roomType?.maxOccupancy || 1,
      bedTypes: roomType?.bedTypes.join(", ") || "",
      price: roomType?.price ?? 0,
      amenities: roomType?.amenities || [],
      photos: roomType?.photos || [],
      mainPhotoUrl: roomType?.mainPhotoUrl || "",
      isVisible: roomType?.isVisible ?? true,
    },
  });

  async function onSubmit(values: z.infer<typeof roomTypeSchema>) {
    const processedValues = {
      ...values,
      description: values.description || "",
      bedTypes: values.bedTypes.split(",").map((s) => s.trim()),
      price: values.price,
      amenities: values.amenities || [],
      photos: values.photos || [],
      mainPhotoUrl: values.mainPhotoUrl || values.photos?.[0] || "",
      isVisible: values.isVisible,
    };

    try {
      if (isEditing && roomType) {
        await updateRoomType(roomType.id, processedValues);
      } else {
        await addRoomType(processedValues);
      }

      toast.success(
        `Room type ${isEditing ? "updated" : "created"} successfully!`
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save room type", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Room Type" : "Add New Room Type"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the room type.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Deluxe Double" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A brief description of the room type."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxOccupancy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Occupancy</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bedTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bed Types</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 1 King, 1 Sofa Bed" {...field} />
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
                    <Input type="number" min={0} step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isVisible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/40 bg-card/80 px-4 py-3">
                  <div className="space-y-1">
                    <FormLabel>Show on website</FormLabel>
                    <FormDescription>
                      Toggle off to hide this room type from guests on the frontend.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Toggle room type visibility"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amenities"
              render={() => (
                <FormItem>
                  <FormLabel>Amenities</FormLabel>
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm md:grid-cols-3">
                    {allAmenities.map((amenity) => (
                      <FormField
                        key={amenity.id}
                        control={form.control}
                        name="amenities"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={amenity.id}
                              className="flex flex-row items-center gap-3 space-y-0 rounded-xl border border-border/40 bg-card/95 px-3 py-2 shadow-sm"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(amenity.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), amenity.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== amenity.id
                                          )
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">
                                {amenity.name}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="photos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photos</FormLabel>
                  <FormControl>
                    <MultiImageUpload
                      category="room-types"
                      value={field.value || []}
                      onChange={field.onChange}
                      mainPhotoUrl={form.watch("mainPhotoUrl")}
                      onSetMain={(url) => form.setValue("mainPhotoUrl", url)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Room Type"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
