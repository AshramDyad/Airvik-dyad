import { NextResponse, type NextRequest } from "next/server";
import { isValid, parseISO, subDays } from "date-fns";

import type { GoogleSheetTransactionsPayload } from "@/data/types";
import {
  fetchGoogleSheetTransactions,
  GoogleSheetsTransactionsConfigError,
} from "@/lib/google-sheets/transactions";
import { HttpError, requireFeature } from "@/lib/server/auth";
import { computeOwnerOverview, type OwnerDateRange } from "@/lib/owner-overview/compute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 55_000;
const DEFAULT_RANGE_DAYS = 30;

let cachedPayload: GoogleSheetTransactionsPayload | null = null;
let cachedAt = 0;
let inFlightFetch: Promise<GoogleSheetTransactionsPayload> | null = null;

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "ownerOverview");
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson({ message: error.message }, { status: error.status });
    }
    return noStoreJson({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams);

  try {
    const payload = await getTransactionsPayload();
    const summary = computeOwnerOverview(payload.rows, range, new Date());
    return noStoreJson(summary);
  } catch (error) {
    return noStoreJson({ message: getPublicErrorMessage(error) }, { status: 500 });
  }
}

function parseRange(searchParams: URLSearchParams): OwnerDateRange {
  const today = new Date();
  const fromParam = parseDateParam(searchParams.get("from"));
  const toParam = parseDateParam(searchParams.get("to"));

  const from = fromParam ?? subDays(today, DEFAULT_RANGE_DAYS - 1);
  const to = toParam ?? today;

  // Guard against a reversed range.
  return from > to ? { from: to, to: from } : { from, to };
}

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

async function getTransactionsPayload(): Promise<GoogleSheetTransactionsPayload> {
  const now = Date.now();
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) {
    return cachedPayload;
  }

  if (!inFlightFetch) {
    inFlightFetch = fetchGoogleSheetTransactions()
      .then((payload) => {
        cachedPayload = payload;
        cachedAt = Date.now();
        return payload;
      })
      .finally(() => {
        inFlightFetch = null;
      });
  }

  return inFlightFetch;
}

function getPublicErrorMessage(error: unknown): string {
  if (error instanceof GoogleSheetsTransactionsConfigError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return `Unable to read Google Sheet: ${error.message}`;
  }
  return "Unable to read Google Sheet.";
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}
