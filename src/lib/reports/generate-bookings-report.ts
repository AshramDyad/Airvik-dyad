import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format, parseISO, differenceInDays } from "date-fns";
import type { BookingSummary, Property, ReservationStatus } from "@/data/types";
import {
  calculateReservationFinancials,
  resolveReservationTaxConfig,
} from "@/lib/reservations/calculate-financials";

// ── jsPDF internal type (for getCurrentPageInfo without 'any') ────────────────
interface jsPDFInternal {
  getCurrentPageInfo: () => { pageNumber: number };
}

// Local shape for the options we pass to doc.autoTable().
// The full AutoTableOptions is declared in generate-invoice.ts and is globally
// available via TypeScript's module augmentation (same project compilation).
// We define only what we use here so the structural check passes.
interface ReportAutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: string[][];
  theme?: "striped" | "grid" | "plain";
  headStyles?: {
    fillColor?: [number, number, number] | string;
    textColor?: [number, number, number] | string;
    fontSize?: number;
    fontStyle?: string;
    halign?: "left" | "center" | "right";
  };
  bodyStyles?: {
    fontSize?: number;
    textColor?: [number, number, number] | string;
  };
  columnStyles?: Record<
    number,
    { halign?: "left" | "center" | "right"; cellWidth?: number | "auto" }
  >;
  styles?: {
    cellPadding?: number;
    lineColor?: [number, number, number] | number;
    lineWidth?: number;
  };
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  didDrawPage?: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  PRIMARY: "#e56824",
  TEXT_DARK: "#333333",
  TEXT_LIGHT: "#666666",
  WHITE: "#ffffff",
} as const;

const MARGIN = 15;
const FOOTER_HEIGHT = 15;
const LOGO_PATH = "/logo.png";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ImageResult {
  base64: string;
  width: number;
  height: number;
}

async function loadImage(url: string): Promise<ImageResult | null> {
  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve({ base64: canvas.toDataURL("image/png"), width: w, height: h });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

function formatCurrency(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
}

function drawFooter(doc: jsPDF): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const internal = (doc as unknown as { internal: jsPDFInternal }).internal;
  const currentPage = internal.getCurrentPageInfo().pageNumber;

  doc.saveGraphicsState();
  doc.setFontSize(8);
  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Page ${currentPage} of {total_pages_count_string}`,
    pageWidth - MARGIN,
    pageHeight - 6,
    { align: "right" }
  );
  doc.restoreGraphicsState();
}

// ── Financial helpers ────────────────────────────────────────────────────────

const EXCLUDED_STATUSES = new Set<ReservationStatus>(["Cancelled", "No-show"]);

interface BookingFinancials {
  displayAmount: number;
  paid: number;
  balance: number;
}

function computeBookingFinancials(
  booking: BookingSummary,
  property: Pick<Property, "tax_enabled" | "tax_percentage">
): BookingFinancials {
  if (EXCLUDED_STATUSES.has(booking.status)) {
    return { displayAmount: 0, paid: 0, balance: 0 };
  }

  const subRows = booking.subRows;

  if (subRows.length === 0) {
    const taxConfig = resolveReservationTaxConfig(null, property);
    const financials = calculateReservationFinancials(
      { folio: booking.folio, totalAmount: booking.totalAmount },
      taxConfig
    );
    return {
      displayAmount: financials.totalCharges,
      paid: financials.totalPaid,
      balance: financials.balance,
    };
  }

  let displayAmount = 0;
  let paid = 0;
  let balance = 0;

  for (const sub of subRows) {
    if (EXCLUDED_STATUSES.has(sub.status)) continue;
    const taxConfig = resolveReservationTaxConfig(sub, property);
    const financials = calculateReservationFinancials(sub, taxConfig);
    displayAmount += financials.totalCharges;
    paid += financials.totalPaid;
    balance += financials.balance;
  }

  return { displayAmount, paid, balance };
}

// ── Section renderer ─────────────────────────────────────────────────────────

interface SectionOptions {
  sectionTitle: string;
  emptyMessage: string;
  bookings: BookingSummary[];
  property: Property;
  startY: number;
}

/** Draws one section (title + summary line + table) onto `doc` starting at `startY`. */
function renderSection(doc: jsPDF, opts: SectionOptions): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const { sectionTitle, emptyMessage, bookings, property, startY } = opts;

  let yPos = startY;

  // Section title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.PRIMARY);
  doc.text(sectionTitle, MARGIN, yPos);
  yPos += 6;

  // Thin rule under the section title
  doc.setDrawColor(COLORS.PRIMARY);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
  yPos += 5;

  // Summary line
  const totalBookings = bookings.length;
  const totalRooms    = bookings.reduce((sum, b) => sum + b.roomCount, 0);
  const totalNights   = bookings.reduce(
    (sum, b) => sum + differenceInDays(parseISO(b.checkOutDate), parseISO(b.checkInDate)),
    0
  );
  const totalAmount   = bookings.reduce((sum, b) => {
    const { displayAmount } = computeBookingFinancials(b, property);
    return sum + displayAmount;
  }, 0);

  const summaryText = totalBookings === 0
    ? emptyMessage
    : `${totalBookings} booking${totalBookings !== 1 ? "s" : ""}  ·  ${totalRooms} room${totalRooms !== 1 ? "s" : ""}  ·  ${totalNights} night${totalNights !== 1 ? "s" : ""}  ·  Total ${formatCurrency(totalAmount)}`;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.TEXT_DARK);
  doc.text(summaryText, MARGIN, yPos);
  yPos += 7;

  // Table
  const head: string[][] = [
    ["Booking ID", "Guest", "Check-in", "Check-out", "Nights", "Rooms", "Total", "Paid", "Balance", "Status"],
  ];

  const body: string[][] =
    bookings.length === 0
      ? [["", "", "", "", "", "", "", "", "", ""]]
      : bookings.map((b) => {
          const nights = differenceInDays(
            parseISO(b.checkOutDate),
            parseISO(b.checkInDate)
          );
          const { displayAmount, paid, balance } = computeBookingFinancials(b, property);
          return [
            b.bookingId,
            b.guestName,
            format(parseISO(b.checkInDate), "dd MMM yyyy"),
            format(parseISO(b.checkOutDate), "dd MMM yyyy"),
            String(nights),
            String(b.roomCount),
            formatCurrency(displayAmount),
            formatCurrency(paid),
            formatCurrency(balance),
            b.status,
          ];
        });

  const tableOptions: ReportAutoTableOptions = {
    startY: yPos,
    head,
    body,
    theme: "striped",
    headStyles: {
      fillColor: [229, 104, 36],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 51, 51],
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "left" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "center" },
    },
    styles: {
      cellPadding: 2,
      lineColor: [224, 224, 224],
      lineWidth: 0.1,
    },
    margin: {
      top: MARGIN,
      left: MARGIN,
      right: MARGIN,
      bottom: FOOTER_HEIGHT + 5,
    },
    didDrawPage: () => {
      drawFooter(doc);
    },
  };

  doc.autoTable(tableOptions);
}

// ── Public input type ─────────────────────────────────────────────────────────

export interface BookingsReportInput {
  arrivals: BookingSummary[];
  dispatches: BookingSummary[];
  property: Property;
  dates: { arrival: string; dispatch: string }; // YYYY-MM-DD
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateBookingsReport(input: BookingsReportInput): Promise<void> {
  const { arrivals, dispatches, property, dates } = input;

  const logoResult = await loadImage(LOGO_PATH);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  const arrivalLabel  = format(parseISO(dates.arrival),  "dd MMM yyyy");
  const dispatchLabel = format(parseISO(dates.dispatch), "dd MMM yyyy");
  const generatedAt   = format(new Date(), "dd MMM yyyy, hh:mm a");

  // ── PAGE 1: HEADER ───────────────────────────────────────────────────────────
  let yPos = MARGIN;

  if (logoResult) {
    const logoH = 18;
    const logoW = (logoResult.width / logoResult.height) * logoH;
    doc.addImage(logoResult.base64, "PNG", MARGIN, yPos, logoW, logoH);
  }

  doc.setTextColor(COLORS.PRIMARY);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Arrivals & Dispatches Report", pageWidth - MARGIN, yPos + 8, { align: "right" });

  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${generatedAt}`, pageWidth - MARGIN, yPos + 15, { align: "right" });

  yPos += 26;

  doc.setTextColor(COLORS.TEXT_DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(property.name, MARGIN, yPos);
  yPos += 5;

  if (property.address) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.TEXT_LIGHT);
    doc.text(property.address, MARGIN, yPos);
    yPos += 5;
  }

  yPos += 3;

  // ── SECTION 1: ARRIVALS ──────────────────────────────────────────────────────
  renderSection(doc, {
    sectionTitle: `Arrivals — ${arrivalLabel}`,
    emptyMessage:  `No arrivals found on ${arrivalLabel}`,
    bookings:      arrivals,
    property,
    startY:        yPos,
  });

  // ── PAGE 2: DISPATCHES ───────────────────────────────────────────────────────
  doc.addPage();

  // Minimal header repeated on page 2
  let y2 = MARGIN;

  doc.setTextColor(COLORS.TEXT_DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(property.name, MARGIN, y2);

  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Arrivals & Dispatches Report", pageWidth - MARGIN, y2, { align: "right" });

  y2 += 7;

  doc.setDrawColor(COLORS.PRIMARY);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y2, pageWidth - MARGIN, y2);
  y2 += 6;

  // ── SECTION 2: DISPATCHES ────────────────────────────────────────────────────
  renderSection(doc, {
    sectionTitle: `Dispatches — ${dispatchLabel}`,
    emptyMessage:  `No dispatches found on ${dispatchLabel}`,
    bookings:      dispatches,
    property,
    startY:        y2,
  });

  // Replace the page-number placeholder across all pages
  if (typeof doc.putTotalPages === "function") {
    doc.putTotalPages("{total_pages_count_string}");
  }

  const arrivalFormatted  = dates.arrival.replace(/-/g, "");
  const dispatchFormatted = dates.dispatch.replace(/-/g, "");
  const fileName = `BookingsReport_ARR${arrivalFormatted}_DSP${dispatchFormatted}.pdf`;

  doc.setProperties({ title: fileName });

  const blob = doc.output("blob") as Blob;
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
}
