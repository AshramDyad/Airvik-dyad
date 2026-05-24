"use client";

import QRCode from "qrcode";

import type { PaymentRequest } from "@/data/types";
import {
  buildUpiPaymentUri,
  getPaymentRequestCode,
  PAYMENT_MERCHANT_NAME,
} from "@/lib/payments/payment-request-matching";

const SHARE_IMAGE_WIDTH = 760;
const SHARE_IMAGE_HEIGHT = 1020;

export async function createShareablePaymentQrImage({
  request,
  currency,
  logoUrl,
  siteUrl,
}: {
  request: PaymentRequest;
  currency: string;
  logoUrl: string;
  siteUrl: string;
}): Promise<string> {
  const upiUri = buildUpiPaymentUri({
    identifier: request.identifier,
    amount: request.amount,
    upiId: request.upiId,
    merchantName: request.upiMerchantName,
  });
  const qrDataUrl = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 470,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });
  const qrImage = await loadImage(qrDataUrl);
  const logoImage = await loadImage(logoUrl).catch(() => null);

  const canvas = document.createElement("canvas");
  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = SHARE_IMAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare QR image.");
  }

  drawQrShareCard(context, {
    request,
    currency,
    siteUrl,
    qrImage,
    logoImage,
  });

  return canvas.toDataURL("image/png");
}

export async function createPaymentQrBlob(args: {
  request: PaymentRequest;
  currency: string;
  logoUrl: string;
  siteUrl: string;
}): Promise<Blob> {
  const dataUrl = await createShareablePaymentQrImage(args);
  const response = await fetch(dataUrl);
  return response.blob();
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function drawQrShareCard(
  context: CanvasRenderingContext2D,
  {
    request,
    currency,
    siteUrl,
    qrImage,
    logoImage,
  }: {
    request: PaymentRequest;
    currency: string;
    siteUrl: string;
    qrImage: HTMLImageElement;
    logoImage: HTMLImageElement | null;
  }
) {
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);

  drawRoundedRect(context, 46, 36, 668, 948, 26, "#ffffff");
  drawRoundedRect(context, 46, 36, 668, 948, 26, "transparent", "#dbe3ea");

  context.fillStyle = "#eef2f6";
  context.fillRect(47, 37, 666, 120);

  if (logoImage) {
    drawCircularImage(context, logoImage, 82, 60, 72);
  }

  drawText(context, PAYMENT_MERCHANT_NAME, 178, 84, {
    font: "700 31px system-ui, sans-serif",
    color: "#111827",
  });
  drawText(context, siteUrl, 180, 122, {
    font: "500 18px system-ui, sans-serif",
    color: "#64748b",
  });

  drawText(context, "Scan and pay with any BHIM UPI app", 380, 196, {
    font: "600 24px system-ui, sans-serif",
    color: "#334155",
    align: "center",
  });

  drawPaymentAppLabels(context, 98, 222);

  context.drawImage(qrImage, 145, 280, 470, 470);

  drawText(context, "Amount", 380, 790, {
    font: "600 20px system-ui, sans-serif",
    color: "#64748b",
    align: "center",
  });
  drawText(context, formatCurrency(request.amount, currency), 380, 836, {
    font: "800 44px system-ui, sans-serif",
    color: "#0f172a",
    align: "center",
  });

  drawText(
    context,
    `Payment ID: ${getPaymentRequestCode(request.identifier)}`,
    380,
    884,
    {
      font: "600 18px ui-monospace, SFMono-Regular, Menlo, monospace",
      color: "#94a3b8",
      align: "center",
    }
  );

  drawText(
    context,
    `Valid until ${formatDateTime(request.expiresAt)}`,
    380,
    928,
    {
      font: "700 20px system-ui, sans-serif",
      color: "#b45309",
      align: "center",
    }
  );
  drawText(context, `UPI: ${request.upiId}`, 380, 960, {
    font: "600 18px system-ui, sans-serif",
    color: "#475569",
    align: "center",
  });
}

function drawPaymentAppLabels(
  context: CanvasRenderingContext2D,
  startX: number,
  y: number
) {
  const labels = [
    { text: "BHIM", color: "#334155" },
    { text: "GPay", color: "#2563eb" },
    { text: "PhonePe", color: "#5b21b6" },
    { text: "Paytm", color: "#0ea5e9" },
    { text: "Amazon Pay", color: "#111827" },
  ];
  let x = startX;

  labels.forEach((label) => {
    const width = label.text.length * 13 + 28;
    drawRoundedRect(context, x, y, width, 36, 18, "#ffffff", "#dbe3ea");
    drawText(context, label.text, x + width / 2, y + 24, {
      font: "700 16px system-ui, sans-serif",
      color: label.color,
      align: "center",
    });
    x += width + 10;
  });
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font: string;
    color: string;
    align?: CanvasTextAlign;
  }
) {
  context.font = options.font;
  context.fillStyle = options.color;
  context.textAlign = options.align ?? "left";
  context.textBaseline = "alphabetic";
  context.fillText(text, x, y);
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
  strokeStyle?: string
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fillStyle !== "transparent") {
    context.fillStyle = fillStyle;
    context.fill();
  }
  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawCircularImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number
) {
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#ffffff";
  context.fillRect(x, y, size, size);
  context.drawImage(image, x + 8, y + 8, size - 16, size - 16);
  context.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load QR image asset."));
    image.src = src;
  });
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
