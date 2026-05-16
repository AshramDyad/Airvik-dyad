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
import type { RatePlan } from "@/data/types";
import { useDataContext } from "@/context/data-context";

const ratePlanSchema = z.object({
  name: z.string().min(1, "Rate plan name is required."),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  minStay: z.coerce.number().min(1, "Minimum stay must be at least 1."),
  cancellationPolicy: z.string().min(1, "Cancellation policy is required."),
});

interface RatePlanFormDialogProps {
  ratePlan?: RatePlan;
  onSaved?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function RatePlanFormDialog({
  ratePlan,
  onSaved,
  children,
}: RatePlanFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { addRatePlan, updateRatePlan } = useDataContext();
  const isEditing = !!ratePlan;

  const form = useForm<z.infer<typeof ratePlanSchema>>({
    resolver: zodResolver(ratePlanSchema),
    defaultValues: {
      name: ratePlan?.name || "",
      price: ratePlan?.price || 0,
      minStay: ratePlan?.rules.minStay || 1,
      cancellationPolicy: ratePlan?.rules.cancellationPolicy || "",
    },
  });

  async function onSubmit(values: z.infer<typeof ratePlanSchema>) {
    const ratePlanData = {
      name: values.name,
      price: values.price,
      rules: {
        minStay: values.minStay,
        cancellationPolicy: values.cancellationPolicy,
      },
    };

    try {
      if (isEditing && ratePlan) {
        await updateRatePlan(ratePlan.id, ratePlanData, ratePlan);
      } else {
        await addRatePlan(ratePlanData);
      }
      await onSaved?.();

      toast.success(
        `Rate plan ${isEditing ? "updated" : "created"} successfully!`
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to save rate plan", {
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
            {isEditing ? "Edit Rate Plan" : "Add New Rate Plan"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the rate plan.
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
                    <Input placeholder="e.g., Standard Rate" {...field} />
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
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minStay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Stay (nights)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cancellationPolicy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancellation Policy</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the cancellation rules..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">
                {isEditing ? "Save Changes" : "Create Rate Plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
