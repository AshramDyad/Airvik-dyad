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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDataContext } from "@/context/data-context";
import type { Reservation } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import {
  calculateReservationFinancials,
  resolveReservationTaxConfig,
  type ReservationTaxConfig,
} from "@/lib/reservations/calculate-financials";
import { useCurrencyFormatter } from "@/hooks/use-currency";

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  percentage: z
    .number()
    .min(0, "Percentage must be at least 0%.")
    .max(100, "Percentage cannot exceed 100%")
    .optional(),
  entryMode: z.enum(["amount", "percentage"]),
});

interface RecordPaymentDialogProps {
  reservationId: string;
  children: React.ReactNode;
  billingSource?: Pick<Reservation, "folio" | "totalAmount">;
  taxConfig?: ReservationTaxConfig;
}

export function RecordPaymentDialog({
  reservationId,
  children,
  billingSource,
  taxConfig,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const {
    loadBookingDetails,
    refreshReservations,
    reservations,
    property,
  } = useDataContext();
  const formatCurrency = useCurrencyFormatter();

  const reservation = React.useMemo(
    () => reservations.find((res) => res.id === reservationId),
    [reservations, reservationId]
  );

  const derivedTaxConfig = React.useMemo<ReservationTaxConfig>(
    () =>
      taxConfig ?? resolveReservationTaxConfig(reservation ?? undefined, property),
    [property, reservation, taxConfig]
  );

  const { balance } = React.useMemo(() => {
    const financialSource = billingSource ?? reservation;
    if (!financialSource) {
      return { balance: 0 };
    }
    return calculateReservationFinancials(financialSource, derivedTaxConfig);
  }, [billingSource, reservation, derivedTaxConfig]);

  const outstandingBalance = Math.max(balance, 0);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      percentage: undefined,
      entryMode: "amount",
    },
  });

  const entryMode = form.watch("entryMode");
  const percentageValue = form.watch("percentage");
  const isPercentageMode = entryMode === "percentage";
  const normalizedPercentage = React.useMemo(() => {
    if (percentageValue === undefined || percentageValue === null) {
      return undefined;
    }
    if (!Number.isFinite(percentageValue)) {
      return undefined;
    }
    return Math.min(Math.max(percentageValue, 0), 100);
  }, [percentageValue]);

  React.useEffect(() => {
    if (entryMode === "amount") {
      const currentPercentage = form.getValues("percentage");
      if (currentPercentage !== undefined && currentPercentage !== null) {
        form.setValue("percentage", undefined, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    const currentAmount = form.getValues("amount");
    if (currentAmount <= 0) {
      form.setValue("amount", 0, { shouldDirty: false, shouldValidate: false });
    }
  }, [entryMode, form]);

  React.useEffect(() => {
    if (!isPercentageMode) {
      return;
    }

    if (
      normalizedPercentage === undefined ||
      !Number.isFinite(normalizedPercentage)
    ) {
      return;
    }
    if (outstandingBalance <= 0) {
      return;
    }

    const computedAmount = Number(
      ((normalizedPercentage / 100) * outstandingBalance).toFixed(2)
    );
    const clampedAmount = Math.min(
      Math.max(computedAmount, 0),
      outstandingBalance
    );

    if (!Number.isFinite(clampedAmount)) {
      return;
    }

    const currentAmount = form.getValues("amount");
    if (currentAmount === clampedAmount) {
      return;
    }

    form.setValue("amount", clampedAmount, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [normalizedPercentage, outstandingBalance, form, isPercentageMode]);

  async function onSubmit(values: z.infer<typeof paymentSchema>) {
    if (!reservation) {
      toast.error("Reservation not found.");
      return;
    }

    if (outstandingBalance <= 0) {
      toast.error("This reservation is already fully paid.");
      return;
    }

    if (values.amount > outstandingBalance) {
      form.setError("amount", {
        type: "manual",
        message: "Amount exceeds the outstanding balance.",
      });
      return;
    }

    try {
      const paymentAmount = Math.abs(values.amount);
      const response = await authorizedFetch(
        `/api/admin/reservations/${reservationId}/cash-payment`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: paymentAmount }),
        }
      );
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Failed to record cash payment.");
      }

      await refreshReservations();
      await loadBookingDetails(reservationId);
      toast.success("Cash payment recorded successfully.");
      form.reset({
        amount: 0,
        percentage: undefined,
        entryMode: "amount",
      });
      setOpen(false);
    } catch (error) {
      console.error("Failed to record payment:", error);
      toast.error("Failed to record payment", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Cash Payment</DialogTitle>
          <DialogDescription>
            Record cash received by the signed-in staff account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Balance due: {formatCurrency(outstandingBalance)}
            </div>
            <FormField
              control={form.control}
              name="entryMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entry Type</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(value) => value && field.onChange(value)}
                      className="gap-2"
                      disabled={outstandingBalance <= 0}
                    >
                      <ToggleGroupItem value="amount">Amount</ToggleGroupItem>
                      <ToggleGroupItem value="percentage">
                        Percentage (%)
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Percentage (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      placeholder="Enter percentage"
                      disabled={!isPercentageMode || outstandingBalance <= 0}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw === "") {
                          field.onChange(undefined);
                          return;
                        }
                        const numeric = Number(raw);
                        if (Number.isNaN(numeric)) {
                          return;
                        }
                        const clamped = Math.min(Math.max(numeric, 0), 100);
                        field.onChange(clamped);
                      }}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Auto-fills amount based on balance due when enabled.
                  </p>
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
                    <Input
                      type="number"
                      step="0.01"
                      readOnly={isPercentageMode}
                      aria-readonly={isPercentageMode}
                      className={isPercentageMode ? "cursor-not-allowed bg-muted" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {isPercentageMode
                      ? "Amount auto-calculated from percentage."
                      : "Enter the amount to record."}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-md border border-border/50 px-3 py-2 text-sm">
              Payment method: <span className="font-medium">Cash</span>
            </div>
            <DialogFooter className="border-t border-border/40 pt-4 sm:justify-end">
              <Button type="submit" disabled={outstandingBalance <= 0}>
                {outstandingBalance <= 0 ? "Fully Paid" : "Record Cash"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function readMessage(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return null;
}
