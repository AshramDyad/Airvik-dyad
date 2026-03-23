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
import type { PropertyClosure } from "@/data/types";
import { useDataContext } from "@/context/data-context";

const closureSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    roomTypeId: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

type ClosureFormValues = z.infer<typeof closureSchema>;

interface PropertyClosureFormDialogProps {
  closure?: PropertyClosure;
  children: React.ReactNode;
}

export function PropertyClosureFormDialog({
  closure,
  children,
}: PropertyClosureFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { property, roomTypes, addPropertyClosure, updatePropertyClosure } =
    useDataContext();
  const isEditing = !!closure;

  const form = useForm<ClosureFormValues>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      startDate: closure?.startDate ?? "",
      endDate: closure?.endDate ?? "",
      roomTypeId: closure?.roomTypeId ?? "__all__",
      reason: closure?.reason ?? "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        startDate: closure?.startDate ?? "",
        endDate: closure?.endDate ?? "",
        roomTypeId: closure?.roomTypeId ?? "__all__",
        reason: closure?.reason ?? "",
      });
    }
  }, [open, closure, form]);

  async function onSubmit(values: ClosureFormValues) {
    try {
      const closureData: Omit<PropertyClosure, "id"> = {
        propertyId: property.id,
        startDate: values.startDate,
        endDate: values.endDate,
        roomTypeId: (values.roomTypeId && values.roomTypeId !== "__all__") ? values.roomTypeId : undefined,
        reason: values.reason || undefined,
      };

      if (isEditing && closure) {
        await updatePropertyClosure(closure.id, closureData);
      } else {
        await addPropertyClosure(closureData);
      }

      toast.success(
        `Blocked dates ${isEditing ? "updated" : "created"} successfully.`
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      const message =
        (error as { message?: string })?.message ??
        "Failed to save blocked dates.";
      toast.error("Failed to save blocked dates.", { description: message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Blocked Dates" : "Add Blocked Dates"}
          </DialogTitle>
          <DialogDescription>
            Block a date range so users cannot make bookings during that period.
            Admin bookings are not affected.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope (optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="All Room Types" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__all__">All Room Types</SelectItem>
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Annual maintenance, Festival closure"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Block Dates"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
