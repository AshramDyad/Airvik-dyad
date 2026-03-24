"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileText, Send, Loader2, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import { formatCurrency } from "@/lib/currency";
import type {
  Guest,
  ManualReceipt,
  Reservation,
  ReservationPaymentMethod,
  Room,
  RoomType,
} from "@/data/types";

const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank/IMPS",
  "Bhagat Ji",
  "Anurag Ji",
] as const;

const STATUS_OPTIONS = ["Accepted", "Pending", "Rejected"] as const;

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  phone: z.string().min(10, "Phone must be at least 10 characters."),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.union([
        z.literal(""),
        z.string().email("Please enter a valid email address."),
      ]),
    ),
  address: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive."),
  paymentMethod: z.enum(PAYMENT_METHODS),
  transactionId: z.string().optional(),
  note: z.string().optional(),
  status: z.string().optional(),
  byHand: z.string().optional(),
  creator: z.string().optional(),
  imgLink: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const defaultFormValues: FormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  amount: 0,
  paymentMethod: "Cash",
  transactionId: "",
  note: "",
  status: "Accepted",
  byHand: "",
  creator: "",
  imgLink: "",
};

type ReceiptLike = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  amount: number;
  paymentMethod: string;
  transactionId?: string | null;
};

export default function ManualReceiptPage() {
  const { property } = useDataContext();
  const [downloading, setDownloading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [receipts, setReceipts] = React.useState<ManualReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = React.useState(true);
  const [historyBusy, setHistoryBusy] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingReceipt, setEditingReceipt] = React.useState<ManualReceipt | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ManualReceipt | null>(null);

  // Filter state
  const [slipSearch, setSlipSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [filterPaymentType, setFilterPaymentType] = React.useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const filteredReceipts = React.useMemo(() => {
    return receipts.filter((r) => {
      if (slipSearch && !`MR-${r.slipNo}`.toLowerCase().includes(slipSearch.toLowerCase())) return false;
      if (dateFrom && r.createdAt < dateFrom) return false;
      if (dateTo && r.createdAt > dateTo + "T23:59:59") return false;
      if (filterPaymentType && r.paymentMethod !== filterPaymentType) return false;
      return true;
    });
  }, [receipts, slipSearch, dateFrom, dateTo, filterPaymentType]);

  function resetFilters() {
    setSlipSearch("");
    setDateFrom("");
    setDateTo("");
    setFilterPaymentType("");
  }

  const fetchReceipts = React.useCallback(async () => {
    try {
      const res = await authorizedFetch("/api/admin/manual-receipts");
      if (!res.ok) return;
      const json = (await res.json()) as { data: ManualReceipt[] };
      setReceipts(json.data);
    } catch {
      // silent — history is non-critical
    } finally {
      setLoadingReceipts(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  function openCreateDialog() {
    setEditingReceipt(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  }

  function openEditDialog(receipt: ManualReceipt) {
    setEditingReceipt(receipt);
    form.reset({
      firstName: receipt.firstName,
      lastName: receipt.lastName,
      phone: receipt.phone,
      email: receipt.email || "",
      address: receipt.address || "",
      amount: receipt.amount,
      paymentMethod: receipt.paymentMethod as FormValues["paymentMethod"],
      transactionId: receipt.transactionId || "",
      note: receipt.note || "",
      status: receipt.status || "Accepted",
      byHand: receipt.byHand || "",
      creator: receipt.creator || "",
      imgLink: receipt.imgLink || "",
    });
    setDialogOpen(true);
  }

  async function saveReceipt(values: FormValues): Promise<ManualReceipt | null> {
    try {
      const res = await authorizedFetch("/api/admin/manual-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Save failed",
        );
      }
      const json = (await res.json()) as { data: ManualReceipt };
      return json.data;
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save receipt.",
      );
      return null;
    }
  }

  async function updateReceipt(id: string, values: FormValues): Promise<ManualReceipt | null> {
    try {
      const res = await authorizedFetch(`/api/admin/manual-receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Update failed",
        );
      }
      const json = (await res.json()) as { data: ManualReceipt };
      return json.data;
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update receipt.",
      );
      return null;
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      const res = await authorizedFetch(`/api/admin/manual-receipts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Delete failed",
        );
      }
      setReceipts((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success(`Receipt MR-${deleteTarget.slipNo} deleted.`);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete receipt.",
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleEditSave() {
    const valid = await form.trigger();
    if (!valid || !editingReceipt) return;

    setSaving(true);
    try {
      const values = form.getValues();
      const updated = await updateReceipt(editingReceipt.id, values);
      if (!updated) return;

      setReceipts((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      toast.success("Receipt updated.");
      form.reset(defaultFormValues);
      setEditingReceipt(null);
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function buildReceiptData(values: ReceiptLike) {
    const now = new Date().toISOString();
    const bookingId = crypto.randomUUID();
    const roomTypeId = crypto.randomUUID();
    const roomId = crypto.randomUUID();
    const amount = Number(values.amount);

    const guest: Guest = {
      id: crypto.randomUUID(),
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || "",
      phone: values.phone,
      address: values.address || undefined,
    };

    const roomType: RoomType = {
      id: roomTypeId,
      name: "Donation",
      description: "",
      maxOccupancy: 1,
      bedTypes: [],
      price: amount,
      amenities: [],
      photos: [],
      isVisible: false,
    };

    const room: Room = {
      id: roomId,
      roomNumber: "-",
      roomTypeId,
      status: "Clean",
    };

    const reservation: Reservation = {
      id: crypto.randomUUID(),
      bookingId,
      guestId: guest.id,
      roomId,
      ratePlanId: null,
      checkInDate: now,
      checkOutDate: now,
      numberOfGuests: 1,
      status: "Confirmed",
      folio: [
        {
          id: crypto.randomUUID(),
          description: `Donation – ${values.paymentMethod}`,
          amount: -amount,
          timestamp: now,
          paymentMethod: values.paymentMethod,
          transactionId: values.transactionId || null,
        },
      ],
      totalAmount: amount,
      bookingDate: now,
      source: "reception",
      paymentMethod: values.paymentMethod as ReservationPaymentMethod,
      adultCount: 1,
      childCount: 0,
      taxEnabledSnapshot: false,
      taxRateSnapshot: 0,
    };

    return {
      reservations: [reservation],
      guest,
      property,
      rooms: [room],
      roomTypes: [roomType],
    };
  }

  async function handleDownload() {
    const valid = await form.trigger();
    if (!valid) return;

    setDownloading(true);
    try {
      const values = form.getValues();
      const saved = await saveReceipt(values);
      if (!saved) return;

      const data = buildReceiptData(values);
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      await generateInvoice(data);
      toast.success("Receipt downloaded.");
      form.reset(defaultFormValues);
      setDialogOpen(false);
      fetchReceipts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate receipt.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleWhatsApp() {
    const valid = await form.trigger();
    if (!valid) return;

    const values = form.getValues();
    setSending(true);
    try {
      const saved = await saveReceipt(values);
      if (!saved) return;

      const data = buildReceiptData(values);
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      const blob = await generateInvoice(data, { returnBlob: true });
      if (!blob) {
        toast.error("Failed to generate receipt PDF.");
        return;
      }

      const formData = new FormData();
      formData.append("phone", values.phone);
      formData.append(
        "file",
        new File([blob], "Donation_Receipt.pdf", { type: "application/pdf" }),
      );

      const res = await authorizedFetch(
        "/api/admin/send-invoice-whatsapp",
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Send failed",
        );
      }

      toast.success("Receipt sent on WhatsApp.");
      form.reset(defaultFormValues);
      setDialogOpen(false);
      fetchReceipts();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send receipt.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleHistoryDownload(receipt: ManualReceipt) {
    setHistoryBusy(receipt.id);
    try {
      const data = buildReceiptData(receipt);
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      await generateInvoice(data);
      toast.success("Receipt downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate receipt.");
    } finally {
      setHistoryBusy(null);
    }
  }

  async function handleHistoryWhatsApp(receipt: ManualReceipt) {
    setHistoryBusy(receipt.id);
    try {
      const data = buildReceiptData(receipt);
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      const blob = await generateInvoice(data, { returnBlob: true });
      if (!blob) {
        toast.error("Failed to generate receipt PDF.");
        return;
      }

      const formData = new FormData();
      formData.append("phone", receipt.phone);
      formData.append(
        "file",
        new File([blob], "Donation_Receipt.pdf", { type: "application/pdf" }),
      );

      const res = await authorizedFetch(
        "/api/admin/send-invoice-whatsapp",
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message || "Send failed",
        );
      }

      toast.success("Receipt sent on WhatsApp.");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to send receipt.",
      );
    } finally {
      setHistoryBusy(null);
    }
  }

  const busy = downloading || sending || saving;
  const isEditing = editingReceipt !== null;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manual Receipt</h1>
          <p className="text-sm text-muted-foreground">
            Generate a donation receipt for walk-in or phone bookings.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Receipt
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Slip No</label>
          <Input
            placeholder="Slip No Search..."
            value={slipSearch}
            onChange={(e) => setSlipSearch(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Date From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Date To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Payment Type</label>
          <Select value={filterPaymentType} onValueChange={setFilterPaymentType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="--Payment Type--" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="destructive" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      {/* Receipt History — primary view */}
      {loadingReceipts ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">No receipts generated yet.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first receipt
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actions</TableHead>
                <TableHead>Slip No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Donor Name</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Transaction No</TableHead>
                <TableHead>By Hand</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Img Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edit / Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.map((r) => (
                <TableRow key={r.id}>
                  {/* Actions: Download PDF, Send WhatsApp */}
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={historyBusy === r.id}
                        onClick={() => handleHistoryDownload(r)}
                        title="Download PDF"
                      >
                        {historyBusy === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={historyBusy === r.id}
                        onClick={() => handleHistoryWhatsApp(r)}
                        title="Send on WhatsApp"
                      >
                        {historyBusy === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>

                  {/* Slip No */}
                  <TableCell className="font-mono text-sm">
                    MR-{r.slipNo}
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(r.createdAt), "dd MMM yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(r.createdAt), "hh:mm a")}
                    </div>
                  </TableCell>

                  {/* Donor Name */}
                  <TableCell>
                    <div className="text-sm">
                      {r.firstName} {r.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.phone}
                    </div>
                  </TableCell>

                  {/* Payment Type */}
                  <TableCell>{r.paymentMethod}</TableCell>

                  {/* Total */}
                  <TableCell className="text-right">
                    {formatCurrency(r.amount)}
                  </TableCell>

                  {/* Transaction No */}
                  <TableCell className="text-sm">
                    {r.transactionId || "—"}
                  </TableCell>

                  {/* By Hand */}
                  <TableCell className="text-sm">
                    {r.byHand || "—"}
                  </TableCell>

                  {/* Note */}
                  <TableCell className="text-sm max-w-[150px] truncate" title={r.note || undefined}>
                    {r.note || "—"}
                  </TableCell>

                  {/* Creator */}
                  <TableCell className="text-sm">
                    {r.creator || "—"}
                  </TableCell>

                  {/* Img Link */}
                  <TableCell className="text-sm">
                    {r.imgLink ? (
                      <a
                        href={r.imgLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "Accepted"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : r.status === "Rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {r.status}
                    </span>
                  </TableCell>

                  {/* Edit / Delete */}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(r)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(r)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredReceipts.length === 0 && receipts.length > 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    No receipts match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New / Edit Receipt Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingReceipt(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Receipt" : "New Receipt"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the receipt details below."
                : "Fill in the donor details to generate a donation receipt."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-6">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Email" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount & Payment Method */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (INR)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0"
                          type="number"
                          min={1}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Transaction ID */}
              <FormField
                control={form.control}
                name="transactionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction ID (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Transaction / reference ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* New fields: Note, By Hand, Creator, Img Link */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Note" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="byHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>By Hand (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="By hand" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="creator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creator (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Creator" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imgLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Img Link (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Image URL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status (shown for edit mode, defaults to Accepted for new) */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "Accepted"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              {isEditing ? (
                <div className="flex gap-4 pt-2">
                  <Button
                    type="button"
                    onClick={handleEditSave}
                    disabled={busy}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="flex gap-4 pt-2">
                  <Button
                    type="button"
                    onClick={handleDownload}
                    disabled={busy}
                    className="flex-1"
                  >
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
                    onClick={handleWhatsApp}
                    disabled={busy}
                    className="flex-1"
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send on WhatsApp
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={deleteTarget ? `receipt MR-${deleteTarget.slipNo}` : undefined}
      />
    </div>
  );
}
