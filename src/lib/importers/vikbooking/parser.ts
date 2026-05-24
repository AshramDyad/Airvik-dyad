import { parse as parseCsv } from "@fast-csv/parse";
import { createHash } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { parse as parseDate, isValid as isValidDate } from "date-fns";
import { z } from "zod";

import type { ReservationPaymentMethod } from "@/data/types";

import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHOD_MAP,
  REQUIRED_COLUMNS,
  STATUS_MAP,
} from "./constants";
import type {
  ImportIssue,
  ParseResultSummary,
  PeopleBreakdown,
  VikBookingExtraLine,
  VikBookingGuestInfo,
  VikBookingNormalizedRow,
} from "./types";
import { normalizeCurrency } from "./utils";

const DATE_FORMATS = [
  "d/M/yyyy",
  "dd/M/yyyy",
  "M/d/yyyy",
  "MM/d/yyyy",
  "yyyy-MM-dd",
  "yyyy/MM/dd",
];

const RequiredRowSchema = z.object({
  row: z.record(z.any()),
  rowNumber: z.number().int().positive(),
});

type NormalizedFieldMap = Record<string, string>;

export async function parseVikBookingCsv(file: File): Promise<ParseResultSummary> {
  const rows: VikBookingNormalizedRow[] = [];
  const issues: ImportIssue[] = [];
  const roomLabels = new Set<string>();

  const stream = Readable.fromWeb(
    file.stream() as unknown as NodeReadableStream<Uint8Array>
  );
  const hashingStream = new PassThrough();
  const parsingStream = new PassThrough();

  const hashPromise = computeStreamHash(hashingStream);

  stream.on("error", (error) => {
    hashingStream.destroy(error);
    parsingStream.destroy(error);
  });

  stream.pipe(hashingStream).pipe(parsingStream);

  await new Promise<void>((resolve, reject) => {
    let rowNumber = 1;

    parsingStream
      .pipe(parseCsv({ headers: true, ignoreEmpty: true, trim: true }))
      .on("error", reject)
      .on("headers", (headers: string[]) => {
        const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
        REQUIRED_COLUMNS.forEach((required) => {
          if (!normalizedHeaders.includes(required.toLowerCase())) {
            issues.push({
              rowNumber: 0,
              field: required,
              message: `Missing required column: ${required}`,
              severity: "error",
            });
          }
        });
      })
      .on("data", (rawRow: Record<string, string>) => {
        const normalizedRow = normalizeRow(rawRow);
        const { row, issues: rowIssues } = buildNormalizedRow({
          row: normalizedRow,
          rowNumber,
        });
        rows.push(row);
        rowIssues.forEach((issue) => issues.push(issue));
        if (row.roomLabel) {
          roomLabels.add(row.roomLabel);
        }
        rowNumber += 1;
      })
      .on("end", () => resolve())
      .on("close", () => resolve());
  });

  const hash = await hashPromise;

  return {
    rows,
    issues,
    uniqueRoomLabels: Array.from(roomLabels),
    hash,
  };
}

function computeStreamHash(stream: PassThrough): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    stream
      .on("data", (chunk: Buffer) => {
        hash.update(chunk);
      })
      .on("end", () => {
        resolve(hash.digest("hex"));
      })
      .on("error", reject);
  });
}

function normalizeRow(rawRow: Record<string, string>): NormalizedFieldMap {
  const normalized: NormalizedFieldMap = {};
  Object.entries(rawRow ?? {}).forEach(([key, value]) => {
    if (typeof key !== "string") return;
    normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : String(value ?? "");
  });
  return normalized;
}

function buildNormalizedRow(input: z.infer<typeof RequiredRowSchema>): {
  row: VikBookingNormalizedRow;
  issues: ImportIssue[];
} {
  const { row, rowNumber } = RequiredRowSchema.parse(input);
  const issues: ImportIssue[] = [];

  const bookingIdRaw = getField(row, "booking id");
  const confirmationRaw = getField(row, "id-confirmation number");
  const externalId = confirmationRaw || bookingIdRaw || `row-${rowNumber}`;
  const bookingId = `vik-${externalId}`;

  const roomLabel = getField(row, "room");
  const roomNumber = getField(row, "room number") || null;
  const roomLabelDisplay = getField(row, "room label") || null;
  if (!roomLabel) {
    issues.push({
      rowNumber,
      field: "Room",
      message: "Room label is required",
      severity: "error",
    });
  }

  const bookingDate = normalizeDate(getField(row, "date"));
  if (!bookingDate) {
    issues.push({
      rowNumber,
      field: "Date",
      message: "Unable to parse booking date",
      severity: "warning",
    });
  }

  const checkInDate = normalizeDate(getField(row, "check-in"));
  const checkOutDate = normalizeDate(getField(row, "check-out"));
  if (!checkInDate || !checkOutDate) {
    issues.push({
      rowNumber,
      field: "Stay",
      message: "Check-in and check-out dates are required",
      severity: "error",
    });
  }

  const nightsColumn = parseInt(getField(row, "nights"), 10);
  const calculatedNights = deriveNights(checkInDate, checkOutDate);
  const nights = Number.isFinite(nightsColumn) && nightsColumn > 0 ? nightsColumn : calculatedNights;
  if (nightsColumn && nightsColumn !== calculatedNights) {
    issues.push({
      rowNumber,
      field: "Nights",
      message: `CSV nights (${nightsColumn}) differ from date range (${calculatedNights})`,
      severity: "warning",
    });
  }

  const people = derivePeople(getField(row, "people"));
  if (people.total <= 0) {
    issues.push({
      rowNumber,
      field: "People",
      message: "Unable to parse guest counts; defaulted to 1 adult",
      severity: "warning",
    });
  }

  const rawStatus = getField(row, "booking status");
  const status = STATUS_MAP[rawStatus.toLowerCase()] ?? "Room Hold";
  if (!STATUS_MAP[rawStatus.toLowerCase()]) {
    issues.push({
      rowNumber,
      field: "Booking Status",
      message: `Unrecognized booking status "${rawStatus}"; defaulted to Room Hold`,
      severity: "warning",
    });
  }

  const rawPayment = getField(row, "payment method");
  const paymentMethod = derivePaymentMethod(rawPayment);

  const optionLines = parseOptionLines(getField(row, "options"));
  const paymentAmount = normalizeCurrency(getField(row, "total paid"));
  const paymentLines = paymentAmount > 0 ? [{ type: "payment", description: "Payment from VikBooking", amount: paymentAmount } satisfies VikBookingExtraLine] : [];
  const totalAmount = normalizeCurrency(getField(row, "total"));
  const totalTaxes = normalizeCurrency(getField(row, "total taxes"));
  const taxLine = totalTaxes > 0 ? ({ type: "tax", description: "Imported tax total", amount: totalTaxes } satisfies VikBookingExtraLine) : undefined;

  const customerInfo = parseCustomerInfo(getField(row, "customer information"));
  const email = getField(row, "customer email") || customerInfo.email;
  const phone = getField(row, "phone") || customerInfo.phone;

  const guest = buildGuest(customerInfo, email, externalId);

  const specialRequests = getField(row, "special requests");
  const notes = getField(row, "notes");

  if (!totalAmount) {
    issues.push({
      rowNumber,
      field: "Total",
      message: "Reservation total is missing or invalid",
      severity: "error",
    });
  }

  const normalizedRow: VikBookingNormalizedRow = {
    rowNumber,
    bookingId,
    externalId,
    confirmationNumber: confirmationRaw || undefined,
    bookingDate: bookingDate ?? new Date().toISOString(),
    checkInDate: checkInDate ?? new Date().toISOString(),
    checkOutDate: checkOutDate ?? new Date().toISOString(),
    nights,
    roomLabel,
    roomNumber,
    roomLabelDisplay,
    guest,
    people,
    email: email || undefined,
    phone: phone || undefined,
    specialRequests: specialRequests || undefined,
    notes: notes || undefined,
    createdBy: getField(row, "created by") || undefined,
    status,
    statusRaw: rawStatus,
    paymentMethod,
    paymentMethodRaw: rawPayment || undefined,
    totalAmount,
    totalPaid: paymentAmount,
    totalTaxes,
    optionLines,
    paymentLines,
    taxLine,
    metadata: {
      raw: row,
      customerInfo,
      originalStatus: rawStatus,
      originalPaymentMethod: rawPayment,
    },
    raw: row,
  };

  return { row: normalizedRow, issues };
}

function getField(row: NormalizedFieldMap, key: string): string {
  return row[key.toLowerCase()] ?? "";
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime())) {
    return native.toISOString();
  }

  for (const format of DATE_FORMATS) {
    const parsed = parseDate(trimmed, format, new Date());
    if (isValidDate(parsed)) {
      return parsed.toISOString();
    }
  }
  return null;
}

function deriveNights(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 1;
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diffMs = outDate.getTime() - inDate.getTime();
  const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  return nights;
}

function derivePeople(peopleRaw: string): PeopleBreakdown {
  if (!peopleRaw) {
    return { adults: 1, children: 0, total: 1 };
  }
  const totalMatch = peopleRaw.match(/(\d+)/);
  const childrenMatch = peopleRaw.match(/children\s*:?\s*(\d+)/i);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 1;
  const children = childrenMatch ? parseInt(childrenMatch[1], 10) : 0;
  const adults = Math.max(1, total - children);
  return { adults, children, total: Math.max(total, adults + children) };
}

function derivePaymentMethod(raw: string): ReservationPaymentMethod {
  if (!raw) return DEFAULT_PAYMENT_METHOD;
  const key = raw.trim().toLowerCase();
  return PAYMENT_METHOD_MAP[key] ?? DEFAULT_PAYMENT_METHOD;
}

function parseOptionLines(optionsRaw: string): VikBookingExtraLine[] {
  if (!optionsRaw) return [];
  return optionsRaw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((line) => {
      const amount = normalizeCurrency(line);
      const description = line.replace(/\(.*?\)/g, "").trim() || "Imported option";
      return { type: "option", description, amount } satisfies VikBookingExtraLine;
    })
    .filter((line) => line.amount !== 0);
}

function parseCustomerInfo(block: string): Record<string, string> {
  if (!block) return {};
  const info: Record<string, string> = {};
  block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) return;
      info[key.trim().toLowerCase()] = rest.join(":").trim();
    });
  return info;
}

function buildGuest(info: Record<string, string>, email: string, fallbackId: string): VikBookingGuestInfo {
  const nameSource = info.name || "";
  const [firstName, ...rest] = nameSource.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");
  const resolvedFirst = firstName || `Guest ${fallbackId}`;
  const resolvedLast = lastName || "";
  return {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    email: email && email.includes("@") ? email : `${fallbackId}@example.invalid`,
    phone: info.phone ?? "",
    city: info.city,
    state: info.state,
    country: info.country,
    addressLines: info.address ? info.address.split(/\r?\n/) : undefined,
  };
}
