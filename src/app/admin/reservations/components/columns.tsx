"use client";

import React from "react";
import { ColumnDef, Table, type CellContext } from "@tanstack/react-table";
import {
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  HelpCircle,
  AlertCircle,
  Monitor,
  User,
  ChevronDown,
  ChevronRight,
  Clock3,
  DownloadCloud,
  Download,
  Eye,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Reservation,
  ReservationSource,
  ReservationStatus,
  Guest,
  Property,
  Room,
  RoomType,
} from "@/data/types";
import { useDataContext } from "@/context/data-context";
import type { InvoiceData } from "@/lib/invoice/generate-invoice";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { formatBookingCode } from "@/lib/reservations/formatting";
import { cn } from "@/lib/utils";

export type ReservationWithDetails = Reservation & {
  displayAmount?: number;
  paidAmount?: number;
  remainingBalance?: number;
  guestName: string;
  roomNumber: string;
  nights: number;
  roomCount?: number;
  subRows?: ReservationWithDetails[];
};

function buildInvoiceData(
  row: ReservationWithDetails,
  guests: Guest[],
  property: Property,
  rooms: Room[],
  roomTypes: RoomType[],
): InvoiceData {
  const reservations: Reservation[] = row.subRows?.length
    ? (row.subRows as unknown as Reservation[])
    : [row as unknown as Reservation];
  const guest = guests.find((g) => g.id === row.guestId) ?? null;
  return { reservations, guest, property, rooms, roomTypes };
}

function InvoiceDownloadCell({ row }: CellContext<ReservationWithDetails, unknown>) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const { guests, property, rooms, roomTypes } = useDataContext();

  if (row.depth > 0) return null;

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const invoiceData = buildInvoiceData(row.original, guests, property, rooms, roomTypes);
      if (invoiceData.reservations.length === 0) {
        toast.error("No reservation data available.");
        return;
      }
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      await generateInvoice(invoiceData);
      toast.success("Invoice downloaded successfully!");
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      toast.error("Failed to generate invoice. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => void handleDownload()}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="sr-only">Download Invoice</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Download Invoice</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function InvoiceViewCell({ row }: CellContext<ReservationWithDetails, unknown>) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const { guests, property, rooms, roomTypes } = useDataContext();

  if (row.depth > 0) return null;

  const handleView = async () => {
    setIsGenerating(true);
    try {
      const invoiceData = buildInvoiceData(row.original, guests, property, rooms, roomTypes);
      if (invoiceData.reservations.length === 0) {
        toast.error("No reservation data available.");
        return;
      }
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      const blob = await generateInvoice(invoiceData, { returnBlob: true });
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast.success("Invoice opened in new tab.");
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      toast.error("Failed to generate invoice. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => void handleView()}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="sr-only">View Invoice</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View Invoice</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const statuses = [
  { value: "Tentative", label: "Tentative", icon: HelpCircle },
  { value: "Standby", label: "Standby", icon: Clock3 },
  { value: "Confirmed", label: "Confirmed", icon: CheckCircle2 },
  { value: "Checked-in", label: "Checked-in", icon: LogIn },
  { value: "Checked-out", label: "Checked-out", icon: LogOut },
  { value: "Cancelled", label: "Cancelled", icon: XCircle },
  { value: "No-show", label: "No-show", icon: AlertCircle },
];

function ReservationActions({
  reservation,
  table,
}: {
  reservation: ReservationWithDetails;
  table: Table<ReservationWithDetails>;
}) {
  const router = useRouter();
  const status = reservation.status;

  const canBeCancelled =
    ["Cancelled", "Checked-out", "No-show"].includes(status) === false;
  const canBeCheckedIn = status === "Confirmed";
  const canBeCheckedOut = status === "Checked-in";
  const detailsId = reservation.subRows
    ? reservation.subRows[0].id
    : reservation.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => router.push(`/admin/reservations/${detailsId}`)}
        >
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            navigator.clipboard.writeText(
              formatBookingCode(reservation.bookingId),
            )
          }
        >
          Copy booking ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => table.options.meta?.checkInReservation?.(reservation)}
          disabled={!canBeCheckedIn}
        >
          Check-in
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => table.options.meta?.checkOutReservation?.(reservation)}
          disabled={!canBeCheckedOut}
        >
          Check-out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => table.options.meta?.openCancelDialog?.(reservation)}
          disabled={!canBeCancelled}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          Cancel Reservation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AmountCell({ row }: CellContext<ReservationWithDetails, unknown>) {
  const formatCurrency = useCurrencyFormatter();
  const rawValue = row.getValue("totalAmount");
  const normalizedTotal =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseFloat(String(rawValue ?? "")) || 0;
  const amount =
    typeof row.original.displayAmount === "number"
      ? row.original.displayAmount
      : normalizedTotal;
  return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
}

function PaidAmountCell({ row }: CellContext<ReservationWithDetails, unknown>) {
  const formatCurrency = useCurrencyFormatter();
  if (row.depth > 0) return null;
  const paid = row.original.paidAmount ?? 0;
  return (
    <div className="text-right font-medium text-emerald-600">
      {paid === 0 ? "-" : formatCurrency(paid)}
    </div>
  );
}

function RemainingBalanceCell({
  row,
}: CellContext<ReservationWithDetails, unknown>) {
  const formatCurrency = useCurrencyFormatter();
  if (row.depth > 0) return null;
  const balance = row.original.remainingBalance ?? 0;
  return (
    <div
      className={cn(
        "text-right font-medium",
        balance > 0 ? "text-rose-600" : "text-emerald-600",
      )}
    >
      {formatCurrency(balance)}
    </div>
  );
}

export const columns: ColumnDef<ReservationWithDetails>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      if (row.getCanExpand()) {
        return (
          <button
            {...{
              onClick: row.getToggleExpandedHandler(),
              className: "p-1 rounded-full hover:bg-muted",
            }}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        );
      }

      return (
        <span className="text-xs font-medium text-muted-foreground">
          {row.index + 1}
        </span>
      );
    },
  },
  {
    accessorKey: "bookingId",
    header: "Booking ID",
    filterFn: (row, id, value) => {
      const input = String(value ?? "")
        .trim()
        .toLowerCase();
      if (!input) return true;
      const rawValue = String(row.getValue(id) ?? "");
      const normalized = rawValue
        .replace(/^booking-/i, "")
        .replace(/^vik-/i, "")
        .toLowerCase();
      const formatted = formatBookingCode(rawValue).toLowerCase();
      return normalized.includes(input) || formatted.includes(input);
    },
    cell: ({ row }) => {
      if (row.depth > 0) {
        return null;
      }
      const reservation = row.original;
      const isGroup = !!reservation.subRows;

      const displayId = reservation.bookingId;
      const linkId = isGroup ? reservation.subRows![0].id : reservation.id;

      if (!displayId) {
        return <span className="font-mono text-xs">N/A</span>;
      }

      return (
        <Link
          href={`/admin/reservations/${linkId}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {formatBookingCode(displayId)}
        </Link>
      );
    },
  },
  {
    accessorKey: "bookingDate",
    header: "Booking Date",
    cell: ({ row }) => {
      if (row.depth > 0) return null;
      const dateValue = row.getValue("bookingDate") as string;
      if (!dateValue) return null;
      return format(new Date(dateValue), "MMM d, yyyy");
    },
  },
  {
    accessorKey: "guestName",
    header: "Customer Name",
    filterFn: (row, id, value) => {
      const input = String(value ?? "")
        .trim()
        .toLowerCase();
      if (!input) return true;
      const guestName = String(row.getValue(id) ?? "").toLowerCase();
      return guestName.includes(input);
    },
    cell: ({ row, getValue }) => {
      if (row.depth > 0) return null;
      return getValue();
    },
  },
  {
    accessorKey: "roomNumber",
    header: "Room",
    cell: ({ row, getValue }) => {
      const original = row.original;
      if (row.depth > 0) {
        return (
          <div style={{ paddingLeft: `${row.depth * 1}rem` }}>
            Room {getValue() as string}
          </div>
        );
      }

      const subRows = original.subRows ?? [];
      const roomCount =
        original.roomCount ?? (subRows.length > 0 ? subRows.length : 1);

      // Extract room numbers from subRows, filtering out "N/A" if possible
      const childRooms = subRows
        .map((sub) => sub.roomNumber)
        .filter((num): num is string => !!num && num !== "N/A");

      // If childRooms is empty but firstRes has a room number, use it
      const primaryRoomNumber =
        original.roomNumber && original.roomNumber !== "N/A"
          ? original.roomNumber
          : (childRooms[0] ?? "N/A");

      return (
        <div className="space-y-1">
          <span className="font-medium text-sm">
            {roomCount === 1 ? "1 Room" : `${roomCount} Rooms`}
          </span>
          {roomCount === 1 && primaryRoomNumber !== "N/A" && (
            <span className="block text-xs text-muted-foreground">
              Room {primaryRoomNumber}
            </span>
          )}
          {roomCount > 1 && childRooms.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground leading-tight">
              <span>{childRooms.slice(0, 3).join(", ")}</span>
              {childRooms.length > 3 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer font-medium text-primary">
                        +{childRooms.length - 3} more
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px]">
                      <p className="text-xs leading-relaxed">
                        {childRooms.slice(3).join(",  ")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "numberOfGuests",
    header: "Guests",
    cell: ({ row, getValue }) => {
      if (row.depth > 0) return null;
      return getValue();
    },
  },
  {
    accessorKey: "checkInDate",
    header: "Check-in",
    cell: ({ row }) => {
      if (row.depth > 0) return null;
      const dateValue = row.getValue("checkInDate") as string;
      if (!dateValue) return null;
      return format(new Date(dateValue), "MMM d, yyyy");
    },
  },
  {
    accessorKey: "checkOutDate",
    header: "Check-out",
    cell: ({ row }) => {
      if (row.depth > 0) return null;
      const dateValue = row.getValue("checkOutDate") as string;
      if (!dateValue) return null;
      return format(new Date(dateValue), "MMM d, yyyy");
    },
  },
  {
    accessorKey: "nights",
    header: "Nights",
    cell: ({ row, getValue }) => {
      if (row.depth > 0) return null;
      return getValue();
    },
  },
  {
    accessorKey: "totalAmount",
    header: () => <div className="text-right">Amount</div>,
    cell: AmountCell,
  },
  {
    id: "paidAmount",
    header: () => <div className="text-right">Paid</div>,
    cell: PaidAmountCell,
  },
  {
    id: "remainingBalance",
    header: () => <div className="text-right">Balance</div>,
    cell: RemainingBalanceCell,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    cell: ({ row }) => {
      const status = statuses.find((s) => s.value === row.getValue("status"));
      if (!status) return null;
      if (row.depth > 0) return null;

      const variant: "default" | "secondary" | "destructive" | "outline" =
        status.value === "Checked-in"
          ? "default"
          : status.value === "Confirmed"
            ? "secondary"
            : status.value === "Cancelled"
              ? "destructive"
              : "outline";
      return <Badge variant={variant}>{status.label}</Badge>;
    },
  },
  {
    accessorKey: "paymentMethod",
    header: "Payment",
    cell: ({ row }) => {
      if (row.depth > 0) return null;
      const method = row.getValue("paymentMethod") as string | undefined;
      return (
        <span className="text-sm text-muted-foreground">{method || "-"}</span>
      );
    },
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => {
      if (row.depth > 0) return null;
      const source = row.getValue("source") as ReservationSource;
      const iconMap: Record<
        ReservationSource,
        React.ComponentType<React.SVGProps<SVGSVGElement>>
      > = {
        website: Monitor,
        reception: User,
        vikbooking: DownloadCloud,
      };
      const Icon = iconMap[source] ?? User;
      const label =
        source === "vikbooking"
          ? "Imported from VikBooking"
          : source === "website"
            ? "Website"
            : "Reception";

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Icon className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "invoiceDownload",
    header: "Download",
    cell: InvoiceDownloadCell,
  },
  {
    id: "invoiceView",
    header: "View",
    cell: InvoiceViewCell,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      if (row.depth > 0) return null;
      return <ReservationActions reservation={row.original} table={table} />;
    },
  },
];
