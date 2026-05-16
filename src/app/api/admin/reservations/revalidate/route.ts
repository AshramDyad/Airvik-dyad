import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";

import {
  RESERVATIONS_CACHE_TAG,
  RESERVATIONS_COUNT_CACHE_TAG,
} from "@/server/reservations/cache";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

export async function POST(request: Request) {
  try {
    await requireFeature(request, "reservations");

    revalidateTag(RESERVATIONS_CACHE_TAG);
    revalidateTag(RESERVATIONS_COUNT_CACHE_TAG);

    return noStoreJson({ revalidated: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson(
        { revalidated: false, message: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to revalidate cache";
    return noStoreJson({ revalidated: false, message }, { status: 500 });
  }
}
