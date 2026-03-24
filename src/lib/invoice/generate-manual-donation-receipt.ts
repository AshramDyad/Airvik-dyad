import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { Property } from "@/data/types";

// ── jsPDF extension types ───────────────────────────────────────────────────
// Note: module augmentation for jsPDF.autoTable is declared in generate-invoice.ts
// and applies project-wide, so we only define the local helper interfaces here.

interface jsPDFInternal {
  getNumberOfPages: () => number;
  getCurrentPageInfo: () => { pageNumber: number };
}

interface AutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: (string | number)[][];
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
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  styles?: {
    cellPadding?: number;
    lineColor?: [number, number, number] | number | string;
    lineWidth?: number;
  };
  didDrawPage?: (data: { doc: jsPDF; pageNumber: number }) => void;
}

interface ImageResult {
  base64: string;
  width: number;
  height: number;
}

// ── Public interfaces ───────────────────────────────────────────────────────

export interface ManualDonationReceiptInput {
  slipNo: number;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  pancard?: string | null;
  aadharCard?: string | null;
  dob?: string | null;
  amount: number;
  trust?: string | null;
  donationType?: string | null;
  donationIn?: string | null;
  paymentMode?: string | null;
  transactionId?: string | null;
  byHand?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ManualDonationReceiptData {
  receipt: ManualDonationReceiptInput;
  property: Property;
}

// ── Constants (identical to generate-invoice.ts) ───────────────────────────

const COLORS = {
  PRIMARY: "#e56824",
  TEXT_DARK: "#333333",
  TEXT_LIGHT: "#666666",
  BORDER: "#e0e0e0",
  WHITE: "#ffffff",
};

const MARGIN = 20;
const FOOTER_HEIGHT = 20;
const LOGO_PATH = "/logo.png";

const LOGO_CONFIG = {
  height: 25,
  width: "auto" as const,
};

// ── Helpers (mirrors generate-invoice.ts) ──────────────────────────────────

function formatCurrency(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const group = (n: number): string => {
    let s = "";
    if (n > 99) {
      s += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 19) {
      s += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else {
      s += a[n];
    }
    return s.trim();
  };

  let words = "";
  let r = num;
  const crore = Math.floor(r / 10000000);
  r %= 10000000;
  const lakh = Math.floor(r / 100000);
  r %= 100000;
  const thou = Math.floor(r / 1000);
  r %= 1000;
  if (crore > 0) words += group(crore) + " Crore ";
  if (lakh > 0) words += group(lakh) + " Lakh ";
  if (thou > 0) words += group(thou) + " Thousand ";
  if (r > 0) words += group(r);
  return "Rupees " + words.trim() + " Only";
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
        if (!ctx) {
          resolve(null);
          return;
        }
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

function calcDimensions(
  origW: number,
  origH: number,
  targetH: number,
  targetW: number | "auto",
): { width: number; height: number } {
  if (targetW === "auto") {
    return { width: targetH * (origW / origH), height: targetH };
  }
  return { width: targetW, height: targetH };
}

function drawRoundedCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
}

function drawFooter(doc: jsPDF) {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  const internal = (doc as unknown as { internal: jsPDFInternal }).internal;
  const page = internal.getCurrentPageInfo().pageNumber;
  doc.saveGraphicsState();
  doc.setFontSize(9);
  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${page} of {total_pages_count_string}`, pw - MARGIN, ph - 10, {
    align: "right",
  });
  doc.restoreGraphicsState();
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - FOOTER_HEIGHT - 10) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

// Inline bold-label + light-value helper — returns total width consumed
function drawGridItem(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.TEXT_DARK);
  doc.text(label, x, y);
  const lw = doc.getTextWidth(label + " ");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.text(value, x + lw, y);
  return lw + doc.getTextWidth(value);
}

function formatDob(dob: string | null | undefined): string {
  if (!dob) return "N/A";
  try {
    return format(parseISO(dob), "dd-MM-yyyy");
  } catch {
    return dob;
  }
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function generateManualDonationReceipt(
  data: ManualDonationReceiptData,
  options?: { returnBlob?: boolean },
): Promise<Blob | void> {
  const { receipt, property } = data;

  const logoResult = await loadImage(LOGO_PATH);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = MARGIN;

  // ── 1. HEADER ─────────────────────────────────────────────────────────────
  // Logo — left side
  if (logoResult) {
    const { width, height } = calcDimensions(
      logoResult.width,
      logoResult.height,
      LOGO_CONFIG.height,
      LOGO_CONFIG.width,
    );
    doc.addImage(logoResult.base64, "PNG", MARGIN, yPos, width, height);
  }

  // "Donation Receipt" — right side (matches "Booking Receipt" style)
  doc.setTextColor(COLORS.PRIMARY);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Donation Receipt", pageWidth - MARGIN, yPos + 12, {
    align: "right",
  });

  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Receipt No:", pageWidth - MARGIN - 35, yPos + 22, {
    align: "right",
  });
  doc.setTextColor(COLORS.TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.text(`DR-MR-${receipt.slipNo}`, pageWidth - MARGIN, yPos + 22, {
    align: "right",
  });

  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.text("Date:", pageWidth - MARGIN - 35, yPos + 28, { align: "right" });
  doc.setTextColor(COLORS.TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.text(
    format(parseISO(receipt.createdAt), "dd MMM yyyy"),
    pageWidth - MARGIN,
    yPos + 28,
    { align: "right" },
  );

  // ── 2. PROPERTY DETAILS (below logo, left-aligned) ────────────────────────
  const hotelY = yPos + LOGO_CONFIG.height + 10;

  doc.setFontSize(11);
  doc.setTextColor(COLORS.TEXT_DARK);
  doc.setFont("helvetica", "bold");
  doc.text(property.name, MARGIN, hotelY);

  doc.setFontSize(9);
  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.text(property.address.replace(/\n/g, ", "), MARGIN, hotelY + 5);

  let detailY = hotelY + 9;
  let detailX = MARGIN;

  if (property.phone) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.TEXT_DARK);
    doc.text("Phone:", detailX, detailY);
    const lw = doc.getTextWidth("Phone: ");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.TEXT_LIGHT);
    doc.text(property.phone, detailX + lw, detailY);
    detailX += lw + doc.getTextWidth(property.phone) + 8;
  }
  if (property.email) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.TEXT_DARK);
    doc.text("Email:", detailX, detailY);
    const lw = doc.getTextWidth("Email: ");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.TEXT_LIGHT);
    doc.text(property.email, detailX + lw, detailY);
  }
  detailY += 6;

  // Trust / NGO inline details (same pattern as booking receipt)
  let trustX = MARGIN;
  const drawTrustItem = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.TEXT_DARK);
    doc.text(label, trustX, detailY);
    const lw = doc.getTextWidth(label + " ");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.TEXT_LIGHT);
    doc.text(value, trustX + lw, detailY);
    trustX += lw + doc.getTextWidth(value) + 5;
  };
  if (property.trust_registration_no)
    drawTrustItem("Trust Reg. No:", property.trust_registration_no);
  if (property.trust_date) drawTrustItem("Dtd:", property.trust_date);
  if (property.pan_no) drawTrustItem("PAN:", property.pan_no);
  if (property.certificate_no)
    drawTrustItem("80G Cert:", property.certificate_no);

  yPos = detailY + 4;

  // ── 3. DONOR DETAILS CARD (mirrors "Guests Details" card) ────────────────
  const cardWidth = pageWidth - MARGIN * 2;

  // Build sequential items — each on its own row, no overflow risk
  const donorItems: { label: string; value: string }[] = [
    { label: "Name:", value: receipt.fullName || "N/A" },
    { label: "Phone:", value: receipt.phone },
  ];
  if (receipt.address)
    donorItems.push({ label: "Address:", value: receipt.address });
  if (receipt.city) donorItems.push({ label: "City:", value: receipt.city });
  if (receipt.pancard)
    donorItems.push({ label: "PAN:", value: receipt.pancard });
  if (receipt.aadharCard)
    donorItems.push({ label: "Aadhaar:", value: receipt.aadharCard });
  if (receipt.dob)
    donorItems.push({ label: "DOB:", value: formatDob(receipt.dob) });
  if (receipt.email) donorItems.push({ label: "Email:", value: receipt.email });

  const donorCardHeight = 12 + donorItems.length * 6 + 2;
  drawRoundedCard(doc, MARGIN, yPos, cardWidth, donorCardHeight);

  const cx = MARGIN + 5;
  let cy = yPos + 8;

  doc.setFontSize(9);
  doc.setTextColor(COLORS.PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text("Donor Details", cx, cy);
  doc.setDrawColor(COLORS.BORDER);
  doc.line(cx, cy + 2, MARGIN + cardWidth - 5, cy + 2);
  cy += 8;

  doc.setFontSize(9);
  for (const item of donorItems) {
    drawGridItem(doc, item.label, item.value, cx, cy);
    cy += 6;
  }

  yPos += donorCardHeight + 4;

  // ── 4. DONATION DETAILS CARD (mirrors "Reservation" card) ────────────────
  const hasDetails =
    receipt.trust ||
    receipt.donationType ||
    receipt.donationIn ||
    receipt.byHand;
  if (hasDetails) {
    const detItems: { label: string; value: string }[] = [];
    if (receipt.trust) detItems.push({ label: "Trust:", value: receipt.trust });
    if (receipt.donationType)
      detItems.push({ label: "Donation Type:", value: receipt.donationType });
    if (receipt.donationIn)
      detItems.push({ label: "Donation In:", value: receipt.donationIn });
    if (receipt.byHand)
      detItems.push({ label: "By Hand:", value: receipt.byHand });

    const detCardH = 12 + detItems.length * 6 + 2;
    drawRoundedCard(doc, MARGIN, yPos, cardWidth, detCardH);

    const dx = MARGIN + 5;
    let dy = yPos + 8;

    doc.setFontSize(9);
    doc.setTextColor(COLORS.PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.text("Donation Details", dx, dy);
    doc.setDrawColor(COLORS.BORDER);
    doc.line(dx, dy + 2, MARGIN + cardWidth - 5, dy + 2);
    dy += 8;

    for (const item of detItems) {
      drawGridItem(doc, item.label, item.value, dx, dy);
      dy += 6;
    }

    yPos += detCardH + 4;
  }

  // ── 5. PAYMENT TABLE (orange header — same as booking receipt charges table) ─
  const paymentHead = [["Description", "Mode", "Transaction No", "Amount"]];
  const paymentBody = [
    [
      receipt.donationType ?? "Donation",
      receipt.paymentMode ?? "-",
      receipt.transactionId ?? "-",
      formatCurrency(receipt.amount),
    ],
  ];

  doc.autoTable({
    startY: yPos,
    head: paymentHead,
    body: paymentBody,
    theme: "plain",
    headStyles: {
      fillColor: [229, 104, 36],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 51, 51],
    },
    columnStyles: {
      0: { halign: "left" },
      1: { cellWidth: 28, halign: "left" },
      2: { cellWidth: 38, halign: "left" },
      3: { cellWidth: 30, halign: "right" },
    },
    styles: {
      cellPadding: 2.5,
      lineColor: [224, 224, 224],
      lineWidth: 0.1,
    },
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_HEIGHT + 5 },
    didDrawPage: () => {
      drawFooter(doc);
    },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // ── 6. TOTALS (right-aligned, same as booking receipt) ────────────────────
  const totW = 80;
  const totX = pageWidth - MARGIN - totW;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    yPos = ensureSpace(doc, yPos, 8);
    if (bold) {
      doc.setTextColor(COLORS.TEXT_DARK);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(COLORS.TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
    }
    doc.text(label, totX, yPos);
    doc.text(value, pageWidth - MARGIN, yPos, { align: "right" });
    yPos += 8;
  };

  yPos = ensureSpace(doc, yPos, 32);

  // Amount in words — left side, aligned with totals section start
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.TEXT_DARK);
  doc.text("Amount in words:", MARGIN, yPos - 1);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.text(numberToWords(Math.floor(receipt.amount)), MARGIN, yPos + 5);

  drawTotalRow("Donation Amount", formatCurrency(receipt.amount));
  drawTotalRow("Total Donated", formatCurrency(receipt.amount), true);

  // Notes (if any)
  if (receipt.note) {
    yPos = ensureSpace(doc, yPos, 40);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.TEXT_DARK);
    doc.text("Note:", MARGIN, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.TEXT_LIGHT);
    const noteLines = doc.splitTextToSize(
      receipt.note,
      cardWidth - 20,
    ) as string[];
    noteLines.forEach((line: string) => {
      yPos = ensureSpace(doc, yPos, 5);
      doc.text(line, MARGIN, yPos);
      yPos += 5;
    });
  }

  // ── 7. BRANDING FOOTER (same as booking receipt) ──────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  const internal = (doc as unknown as { internal: jsPDFInternal }).internal;
  const origPage = internal.getCurrentPageInfo().pageNumber;

  doc.setPage(1);
  const brandY = pageHeight - FOOTER_HEIGHT - 10;

  doc.setFontSize(10);
  doc.setTextColor(COLORS.PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for your generous donation!", pageWidth / 2, brandY, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.setTextColor(COLORS.TEXT_LIGHT);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Donations may be eligible for tax exemption under Section 80G. Certificate No: ${property.certificate_no ?? "N/A"}`,
    pageWidth / 2,
    brandY + 5,
    { align: "center" },
  );

  if (origPage > 1) doc.setPage(origPage);

  // ── 8. PAGE NUMBERS ────────────────────────────────────────────────────────
  drawFooter(doc);
  if (typeof doc.putTotalPages === "function") {
    doc.putTotalPages("{total_pages_count_string}");
  }

  if (options?.returnBlob) return doc.output("blob") as Blob;
  doc.save(`Donation_Receipt_MR-${receipt.slipNo}.pdf`);
}
