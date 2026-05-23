import { NextResponse, type NextRequest } from "next/server";

import type {
  GoogleSheetTransactionsApiResponse,
  GoogleSheetTransactionsPayload,
} from "@/data/types";
import {
  fetchGoogleSheetTransactions,
  GoogleSheetsTransactionsConfigError,
} from "@/lib/google-sheets/transactions";
import { HttpError, requireFeature } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 55_000;

let cachedPayload: GoogleSheetTransactionsPayload | null = null;
let cachedAt = 0;
let inFlightFetch: Promise<GoogleSheetTransactionsPayload> | null = null;

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "payments");
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson({ message: error.message }, { status: error.status });
    }

    return noStoreJson({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceRefresh = isRefreshRequested(url.searchParams);

  try {
    const payload = await getTransactionsPayload(forceRefresh);
    return noStoreJson(toApiResponse(payload, false));
  } catch (error) {
    const message = getPublicErrorMessage(error);

    if (cachedPayload) {
      return noStoreJson(toApiResponse(cachedPayload, true, message));
    }

    return noStoreJson({ message }, { status: 500 });
  }
}

async function getTransactionsPayload(
  forceRefresh: boolean
): Promise<GoogleSheetTransactionsPayload> {
  const now = Date.now();
  if (!forceRefresh && cachedPayload && now - cachedAt < CACHE_TTL_MS) {
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

function isRefreshRequested(searchParams: URLSearchParams): boolean {
  const refresh = searchParams.get("refresh");
  return refresh === "1" || refresh === "true";
}

function toApiResponse(
  payload: GoogleSheetTransactionsPayload,
  stale: boolean,
  message?: string
): GoogleSheetTransactionsApiResponse {
  return {
    ...payload,
    stale,
    ...(message ? { message } : {}),
  };
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

function noStoreJson(
  body: unknown,
  init: ResponseInit = {}
): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}
