"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowLeft, FileText, Send, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import type { ManualReceipt } from "@/data/types";

// ── Constants ──────────────────────────────────────────────────────────────

const TRUSTS = [
  "SHRI NEELKANTH VARNI CHARITABLE SOCIETY",
  "SAHAJANAND WELLNESS TRUST",
] as const;

const DONATION_TYPES = [
  "Donation Annakshetra",
  "Ganga Aarti",
  "Ashram Donation",
  "Gaushala",
  "Yagyashala",
] as const;

const DONATION_IN_NVCS = ["BANK OF INDIA", "CASH NVCS", "AXIS BANK"] as const;
const DONATION_IN_SWT = ["Punjab National Bank", "Cash SWT"] as const;

const PAYMENT_MODES = [
  "Cheque",
  "DD",
  "RTGS",
  "NEFT",
  "IMPS",
  "UPI",
  "Cash",
] as const;

// ── Zod schema ─────────────────────────────────────────────────────────────

const newReceiptSchema = z.object({
  phone: z.string().min(10, "Contact number must be at least 10 digits."),
  fullName: z.string().min(1, "Full name is required."),
  city: z.string().optional(),
  pancard: z.string().optional(),
  aadharCard: z.string().optional(),
  byHand: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  trust: z.enum(TRUSTS).optional(),
  donationType: z.enum(DONATION_TYPES).optional(),
  amount: z.coerce.number().positive("Donation amount must be positive."),
  donationIn: z.string().optional(),
  transactionId: z.string().optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  note: z.string().optional(),
});

type NewReceiptValues = z.infer<typeof newReceiptSchema>;

const defaultValues: NewReceiptValues = {
  phone: "",
  fullName: "",
  city: "",
  pancard: "",
  aadharCard: "",
  byHand: "",
  dob: "",
  address: "",
  trust: undefined,
  donationType: undefined,
  amount: 0,
  donationIn: "",
  transactionId: "",
  paymentMode: undefined,
  note: "",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function NewManualReceiptPage() {
  const router = useRouter();
  const { property } = useDataContext();
  const [downloading, setDownloading] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const form = useForm<NewReceiptValues>({
    resolver: zodResolver(newReceiptSchema),
    defaultValues,
  });

  const selectedTrust = form.watch("trust");

  // Build conditional Donation In options based on selected trust
  const donationInOptions = React.useMemo((): readonly string[] => {
    if (selectedTrust === "SHRI NEELKANTH VARNI CHARITABLE SOCIETY") {
      return DONATION_IN_NVCS;
    }
    if (selectedTrust === "SAHAJANAND WELLNESS TRUST") {
      return DONATION_IN_SWT;
    }
    return [];
  }, [selectedTrust]);

  // Reset donationIn when trust changes
  React.useEffect(() => {
    form.setValue("donationIn", "");
  }, [selectedTrust, form]);

  // Auto-select/deselect Cash payment mode based on donation-in selection
  const selectedDonationIn = form.watch("donationIn");
  React.useEffect(() => {
    if (selectedDonationIn === "CASH NVCS" || selectedDonationIn === "Cash SWT") {
      form.setValue("paymentMode", "Cash");
    } else if (selectedDonationIn) {
      // Non-empty, non-cash option → clear payment mode
      form.setValue("paymentMode", undefined);
    }
    // Empty string (trust reset) — leave paymentMode untouched
  }, [selectedDonationIn, form]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function saveToApi(values: NewReceiptValues): Promise<ManualReceipt | null> {
    const res = await authorizedFetch("/api/admin/manual-receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        (body as { message?: string } | null)?.message ?? "Save failed",
      );
    }
    const json = (await res.json()) as { data: ManualReceipt };
    return json.data;
  }

  async function generatePdf(
    saved: ManualReceipt,
    opts?: { returnBlob?: boolean },
  ): Promise<Blob | void> {
    const { generateManualDonationReceipt } = await import(
      "@/lib/invoice/generate-manual-donation-receipt"
    );
    return generateManualDonationReceipt(
      {
        receipt: {
          slipNo: saved.slipNo,
          fullName: saved.fullName ?? `${saved.firstName} ${saved.lastName}`.trim(),
          phone: saved.phone,
          email: saved.email,
          address: saved.address,
          city: saved.city,
          pancard: saved.pancard,
          aadharCard: saved.aadharCard,
          dob: saved.dob,
          amount: saved.amount,
          trust: saved.trust,
          donationType: saved.donationType,
          donationIn: saved.donationIn,
          paymentMode: saved.paymentMode,
          transactionId: saved.transactionId,
          byHand: saved.byHand,
          note: saved.note,
          createdAt: saved.createdAt,
        },
        property,
      },
      opts,
    );
  }

  // ── Submit: Download PDF ─────────────────────────────────────────────────

  async function handleDownload(values: NewReceiptValues) {
    setDownloading(true);
    try {
      const saved = await saveToApi(values);
      if (!saved) return;
      await generatePdf(saved);
      toast.success("Receipt saved and downloaded.");
      router.push("/admin/manual-receipt");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate receipt.");
    } finally {
      setDownloading(false);
    }
  }

  // ── Submit: Send on WhatsApp ─────────────────────────────────────────────

  async function handleWhatsApp() {
    const valid = await form.trigger();
    if (!valid) return;

    setSending(true);
    try {
      const values = form.getValues();
      const saved = await saveToApi(values);
      if (!saved) return;

      const blob = await generatePdf(saved, { returnBlob: true });
      if (!blob) {
        toast.error("Failed to generate receipt PDF.");
        return;
      }

      const formData = new FormData();
      formData.append("phone", values.phone);
      formData.append(
        "file",
        new File([blob], `Donation_Receipt_MR-${saved.slipNo}.pdf`, {
          type: "application/pdf",
        }),
      );

      const res = await authorizedFetch("/api/admin/send-invoice-whatsapp", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ?? "Send failed",
        );
      }

      toast.success("Receipt sent on WhatsApp.");
      router.push("/admin/manual-receipt");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send receipt.");
    } finally {
      setSending(false);
    }
  }

  const busy = downloading || sending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/manual-receipt">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Donation Receipt</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the donor and donation details to generate a receipt.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleDownload)}
          className="space-y-6"
        >
          {/* ── Personal Details card ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact No */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact No</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* City */}
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pancard */}
                <FormField
                  control={form.control}
                  name="pancard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pancard</FormLabel>
                      <FormControl>
                        <Input placeholder="PAN number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Aadhar Card */}
                <FormField
                  control={form.control}
                  name="aadharCard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aadhar Card</FormLabel>
                      <FormControl>
                        <Input placeholder="Aadhaar number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* By Hand */}
                <FormField
                  control={form.control}
                  name="byHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>By Hand</FormLabel>
                      <FormControl>
                        <Input placeholder="Received by" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* DOB */}
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DOB</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Address — full width */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Donation Details card ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Donation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Trust */}
                <FormField
                  control={form.control}
                  name="trust"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trust</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trust" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRUSTS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Donation Type */}
                <FormField
                  control={form.control}
                  name="donationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Donation Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DONATION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Donation Amount */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Donation (INR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Donation In — conditional on trust */}
                <FormField
                  control={form.control}
                  name="donationIn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Donation In</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                        disabled={donationInOptions.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                donationInOptions.length === 0
                                  ? "Select a trust first"
                                  : "Select account"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {donationInOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Transaction No */}
                <FormField
                  control={form.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction No</FormLabel>
                      <FormControl>
                        <Input placeholder="Transaction / reference number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Mode — radio group, full width */}
                <FormField
                  control={form.control}
                  name="paymentMode"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Payment Mode</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                          className="flex flex-wrap gap-4 pt-1"
                        >
                          {PAYMENT_MODES.map((mode) => (
                            <div key={mode} className="flex items-center space-x-2">
                              <RadioGroupItem value={mode} id={`pm-${mode}`} />
                              <Label htmlFor={`pm-${mode}`}>{mode}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes — full width */}
                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional notes"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Action buttons ─────────────────────────────────── */}
          <div className="flex gap-4">
            <Button type="submit" disabled={busy} className="flex-1 sm:flex-none">
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleWhatsApp}
              className="flex-1 sm:flex-none"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send on WhatsApp
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
