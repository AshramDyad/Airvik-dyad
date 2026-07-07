import { NextResponse, type NextRequest } from "next/server";

import { GoogleSheetsTransactionsConfigError } from "@/lib/google-sheets/transactions";
import { HttpError, requireFeature } from "@/lib/server/auth";
import { getSettlementView } from "@/lib/settlements/settlements-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "ownerOverview");
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson({ message: error.message }, { status: error.status });
    }
    return noStoreJson({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const view = await getSettlementView();
    return noStoreJson(view);
  } catch (error) {
    return noStoreJson({ message: getPublicErrorMessage(error) }, { status: 500 });
  }
}

function getPublicErrorMessage(error: unknown): string {
  if (error instanceof GoogleSheetsTransactionsConfigError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return `Unable to build settlements: ${error.message}`;
  }
  return "Unable to build settlements.";
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}
