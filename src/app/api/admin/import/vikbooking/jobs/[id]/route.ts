import { NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportJobEntryStatus } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { fetchJobById } from "@/lib/importers/vikbooking/jobs";
import type { SkipReportEntry, StoredImportPayload } from "@/lib/importers/vikbooking/types";
import { requireAdminProfile, HttpError } from "@/lib/server/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const SKIPPED_FETCH_PAGE_SIZE = 500;
const RECENT_ERROR_LIMIT = 10;
const ENTRY_STATUSES: ImportJobEntryStatus[] = [
  "pending",
  "imported",
  "skipped",
  "error",
];
const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdminProfile(request);
    const supabase = createServerSupabaseClient();
    const { id } = await context.params;
    const job = await fetchJobById(supabase, id);
    if (!job) {
      return noStoreJson({ message: "Job not found" }, { status: 404 });
    }

    const statusCounts = await fetchEntryStatusCounts(supabase, id);
    const errors = await fetchRecentErroredEntries(supabase, id);

    const skippedEntries =
      getSummarySkippedEntries(job.summary) ??
      (await fetchAllSkippedEntries(supabase, id)).map(mapSkippedEntryRow);

    return noStoreJson({ job, statusCounts, errors, skippedEntries });
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error("Failed to fetch import job", error);
    return noStoreJson(
      { message: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}

function getSummarySkippedEntries(summary: Record<string, unknown> | undefined): SkipReportEntry[] | null {
  const skippedRows = summary?.skippedRows;
  if (!Array.isArray(skippedRows)) {
    return null;
  }

  return skippedRows.filter(isSkipReportEntry);
}

function isSkipReportEntry(value: unknown): value is SkipReportEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<SkipReportEntry>;
  return (
    typeof entry.entryId === "string" &&
    typeof entry.rowNumber === "number" &&
    typeof entry.bookingId === "string" &&
    typeof entry.reason === "string" &&
    typeof entry.skippedAt === "string"
  );
}

function mapSkippedEntryRow(entry: SkippedEntryRow): SkipReportEntry {
  const payload = entry.payload ?? undefined;
  const guestParts = payload
    ? [payload.guest.firstName, payload.guest.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
    : [];

  return {
    entryId: entry.id,
    rowNumber: entry.row_number,
    bookingId: payload?.bookingId ?? payload?.externalId ?? "Unknown booking",
    roomLabel: payload?.roomLabelDisplay ?? payload?.roomLabel ?? null,
    guestName: guestParts.length ? guestParts.join(" ") : undefined,
    reason: entry.message ?? "Skipped during import",
    reasonCode: entry.skip_reason_code ?? undefined,
    skippedAt: entry.updated_at ?? new Date().toISOString(),
  };
}

async function fetchEntryStatusCounts(
  client: SupabaseClient,
  jobId: string
): Promise<Record<string, number>> {
  const pairs = await Promise.all(
    ENTRY_STATUSES.map(async (status) => {
      const { count, error } = await client
        .from("import_job_entries")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("status", status);

      if (error) {
        throw error;
      }

      return [status, count ?? 0] as const;
    })
  );

  return Object.fromEntries(pairs);
}

async function fetchRecentErroredEntries(
  client: SupabaseClient,
  jobId: string
): Promise<Array<{ id: string; rowNumber: number; message?: string | null }>> {
  const { data, error } = await client
    .from("import_job_entries")
    .select("id,row_number,message")
    .eq("job_id", jobId)
    .eq("status", "error")
    .order("row_number", { ascending: true })
    .limit(RECENT_ERROR_LIMIT);

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => ({
    id: entry.id,
    rowNumber: entry.row_number,
    message: entry.message,
  }));
}

type SkippedEntryRow = {
  id: string;
  row_number: number;
  message: string | null;
  payload: StoredImportPayload | null;
  updated_at: string | null;
  skip_reason_code: string | null;
};

async function fetchAllSkippedEntries(
  client: SupabaseClient,
  jobId: string
): Promise<SkippedEntryRow[]> {
  const rows: SkippedEntryRow[] = [];
  let lastRowNumber = 0;

  while (true) {
    const { data, error } = await client
      .from("import_job_entries")
      .select("id,row_number,message,payload,updated_at,skip_reason_code")
      .eq("job_id", jobId)
      .eq("status", "skipped")
      .gt("row_number", lastRowNumber)
      .order("row_number", { ascending: true })
      .limit(SKIPPED_FETCH_PAGE_SIZE);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as SkippedEntryRow[];
    if (batch.length === 0) {
      break;
    }

    rows.push(...batch);
    lastRowNumber = batch[batch.length - 1].row_number;

    if (batch.length < SKIPPED_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}
