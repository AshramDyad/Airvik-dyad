"use client";

import * as React from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  IndianRupee,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataContext } from "@/context/data-context";
import type { PaymentRequest, PaymentRequestStatus } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import {
  buildUpiPaymentUri,
  getPaymentRequestCode,
  PAYMENT_MERCHANT_NAME,
} from "@/lib/payments/payment-request-matching";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_MS = 60_000;
const EMPTY_REQUESTS: PaymentRequest[] = [];
const SHARE_IMAGE_WIDTH = 760;
const SHARE_IMAGE_HEIGHT = 1020;

export function CreatePaymentClient() {
  const { property } = useDataContext();
  const [amount, setAmount] = React.useState("");
  const [requests, setRequests] = React.useState<PaymentRequest[]>(EMPTY_REQUESTS);
  const [activeRequest, setActiveRequest] = React.useState<PaymentRequest | null>(null);
  const [siteUrl, setSiteUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = React.useState(false);
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = React.useState<string | null>(null);
  const [isPreparingQr, setIsPreparingQr] = React.useState(false);

  const currency = property?.currency || "INR";
  const logoUrl = property?.logo_url || "/logo.png";

  const loadRequests = React.useCallback(async (sync = false) => {
    setIsRefreshing(true);
    try {
      const response = await authorizedFetch(
        `/api/admin/payment-requests${sync ? "?sync=1" : ""}`,
        { cache: "no-store" }
      );
      const body: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Unable to load payment requests.");
      }

      const next = readRequests(body);
      setRequests(next);
      setActiveRequest((current) => {
        if (!current) {
          return next[0] ?? null;
        }
        return next.find((request) => request.id === current.id) ?? current;
      });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payment requests."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    setSiteUrl(window.location.origin);
    void loadRequests(true);
  }, [loadRequests]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadRequests(true);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [loadRequests]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const response = await authorizedFetch("/api/admin/payment-requests", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readMessage(body) ?? "Unable to create payment QR.");
      }

      const created = readRequest(body);
      setActiveRequest(created);
      setQrPreviewDataUrl(null);
      setAmount("");
      await loadRequests(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create payment QR."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const prepareQrImage = React.useCallback(
    async (request: PaymentRequest): Promise<string> => {
      setIsPreparingQr(true);
      try {
        const dataUrl = await createShareableQrImage({
          request,
          currency,
          logoUrl,
          siteUrl,
        });
        setQrPreviewDataUrl(dataUrl);
        return dataUrl;
      } finally {
        setIsPreparingQr(false);
      }
    },
    [currency, logoUrl, siteUrl]
  );

  const handleViewQr = async (request: PaymentRequest) => {
    setActiveRequest(request);
    setIsQrDialogOpen(true);
    setError(null);
    try {
      await prepareQrImage(request);
    } catch (viewError) {
      setError(
        viewError instanceof Error
          ? viewError.message
          : "Unable to prepare QR preview."
      );
    }
  };

  const handleDownloadQr = async (request: PaymentRequest) => {
    setActiveRequest(request);
    setError(null);
    try {
      const dataUrl = await prepareQrImage(request);
      downloadDataUrl(dataUrl, `payment-${request.identifier}.png`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download QR."
      );
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment request unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(420px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Payment</CardTitle>
            <CardDescription>
              Generate a UPI QR with a unique 5-character identifier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount</Label>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="payment-amount"
                    inputMode="decimal"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Enter amount"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generate QR
              </Button>
            </form>
          </CardContent>
        </Card>

        <PaymentQrCard
          request={activeRequest}
          currency={currency}
          onViewQr={handleViewQr}
          onDownloadQr={handleDownloadQr}
          isPreparingQr={isPreparingQr}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Created Payments</CardTitle>
            <CardDescription>
              Pending requests auto-update when a matching credited Sheet entry appears.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadRequests(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-44 items-center justify-center text-muted-foreground">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payment requests
              </span>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
              No payment requests created
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>QR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setActiveRequest(request);
                      setQrPreviewDataUrl(null);
                    }}
                  >
                    <TableCell className="font-mono font-semibold">
                      {getPaymentRequestCode(request.identifier)}
                    </TableCell>
                    <TableCell>{formatCurrency(request.amount, currency)}</TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                    <TableCell>{formatDateTime(request.expiresAt)}</TableCell>
                    <TableCell>
                      <span className="block max-w-[180px] truncate">
                        {request.paymentReference ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleViewQr(request);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDownloadQr(request);
                          }}
                          disabled={isPreparingQr}
                        >
                          {isPreparingQr ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="max-w-[520px] p-6">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">Payment QR</DialogTitle>
            <DialogDescription>
              This is the guest-facing QR image with payment details included.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            {qrPreviewDataUrl ? (
              <div
                role="img"
                aria-label="Payment QR with amount, identifier, expiry, and UPI details"
                className="h-[70vh] max-h-[660px] w-full max-w-[492px] rounded-lg border bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${qrPreviewDataUrl}")` }}
              />
            ) : (
              <div className="flex h-[420px] w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing QR
              </div>
            )}
          </div>
          {activeRequest ? (
            <Button
              onClick={() => void handleDownloadQr(activeRequest)}
              disabled={isPreparingQr}
            >
              {isPreparingQr ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download QR
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentQrCard({
  request,
  currency,
  onViewQr,
  onDownloadQr,
  isPreparingQr,
}: {
  request: PaymentRequest | null;
  currency: string;
  onViewQr: (request: PaymentRequest) => void;
  onDownloadQr: (request: PaymentRequest) => void;
  isPreparingQr: boolean;
}) {
  if (!request) {
    return (
      <Card>
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <QrCode className="h-9 w-9" />
          <p className="text-sm font-medium">Generate a payment to create a guest QR</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Latest Generated QR</CardTitle>
        <CardDescription>
          Share the downloaded QR image with the guest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock
            label="Payment ID"
            value={getPaymentRequestCode(request.identifier)}
            mono
          />
          <InfoBlock label="Status" value={request.status} />
          <InfoBlock
            label="Amount"
            value={formatCurrency(request.amount, currency)}
          />
          <InfoBlock label="Expires" value={formatDateTime(request.expiresAt)} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onViewQr(request)}
          >
            <Eye className="h-4 w-4" />
            View QR
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => onDownloadQr(request)}
            disabled={isPreparingQr}
          >
            {isPreparingQr ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download QR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  const icon = status === "paid" ? CheckCircle2 : Clock3;
  const Icon = icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "paid" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
        status === "expired" && "border-slate-200 bg-slate-50 text-slate-600",
        status === "cancelled" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </Badge>
  );
}

function readRequests(body: unknown): PaymentRequest[] {
  if (!isRecord(body) || !Array.isArray(body.requests)) {
    return EMPTY_REQUESTS;
  }

  return body.requests.filter(isPaymentRequest);
}

function readRequest(body: unknown): PaymentRequest {
  if (!isRecord(body) || !isPaymentRequest(body.request)) {
    throw new Error("Payment request response was not valid.");
  }

  return body.request;
}

function readMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function isPaymentRequest(value: unknown): value is PaymentRequest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.identifier === "string" &&
    typeof value.amount === "number" &&
    typeof value.status === "string" &&
    typeof value.upiUri === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

async function createShareableQrImage({
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

  drawText(context, `Valid for 3 hours, until ${formatDateTime(request.expiresAt)}`, 380, 928, {
    font: "700 20px system-ui, sans-serif",
    color: "#b45309",
    align: "center",
  });
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

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
