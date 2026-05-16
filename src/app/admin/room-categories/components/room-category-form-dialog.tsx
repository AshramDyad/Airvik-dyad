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
import { Textarea } from "@/components/ui/textarea";
import type { RoomCategory } from "@/data/types";
import { useDataContext } from "@/context/data-context";

const roomCategorySchema = z.object({
  name: z.string().min(1, "Room category name is required."),
  description: z.string().optional(),
});

interface RoomCategoryFormDialogProps {
  roomCategory?: RoomCategory;
  onSaved?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function RoomCategoryFormDialog({
  roomCategory,
  onSaved,
  children,
}: RoomCategoryFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { addRoomCategory, updateRoomCategory } = useDataContext();
  const isEditing = !!roomCategory;

  const form = useForm<z.infer<typeof roomCategorySchema>>({
    resolver: zodResolver(roomCategorySchema),
    defaultValues: {
      name: roomCategory?.name || "",
      description: roomCategory?.description || "",
    },
  });

  async function onSubmit(values: z.infer<typeof roomCategorySchema>) {
    const processedValues = {
      ...values,
      description: values.description || "",
    };

    try {
      if (isEditing && roomCategory) {
        await updateRoomCategory(roomCategory.id, processedValues, roomCategory);
      } else {
        await addRoomCategory(processedValues);
      }

      toast.success(
        `Room category ${isEditing ? "updated" : "created"} successfully!`
      );
      await onSaved?.();
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save room category", {
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
            {isEditing ? "Edit Room Category" : "Add New Room Category"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the room category.
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
                    <Input placeholder="e.g., Standard, Deluxe, Suite" {...field} />
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
                      placeholder="A brief description of the room category."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Room Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
