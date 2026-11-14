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
import { useDataContext } from "@/context/data-context";

const amountString = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .refine(
    (value) => {
      const numeric = Number(value.replace(/,/g, ""));
      return !Number.isNaN(numeric) && numeric > 0;
    },
    "Amount must be a valid number greater than 0",
  );

const chargeSchema = z.object({
  description: z.string().trim().min(1, "Description is required."),
  amount: amountString,
});

type ChargeFormValues = z.infer<typeof chargeSchema>;

interface AddChargeDialogProps {
  reservationId: string;
  children: React.ReactNode;
}

export function AddChargeDialog({
  reservationId,
  children,
}: AddChargeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { addFolioItem } = useDataContext();

  const form = useForm<ChargeFormValues>({
    resolver: zodResolver(chargeSchema),
    defaultValues: {
      description: "",
      amount: "",
    },
  });

  async function onSubmit(values: ChargeFormValues) {
    const parsedAmount = Number(values.amount.replace(/,/g, ""));
    const description = values.description.trim();

    try {
      await addFolioItem(
        reservationId,
        {
          description,
          amount: parsedAmount,
        }
      );
      toast.success("Charge added successfully!");
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to add charge", error);
      toast.error("Failed to add charge", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Dialog activityLabel="Add charge" open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Charge</DialogTitle>
          <DialogDescription>
            Post a new charge to the reservation folio.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Room Service" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="text" inputMode="decimal" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit">Add Charge</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
