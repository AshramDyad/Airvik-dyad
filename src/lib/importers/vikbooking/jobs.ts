import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ImportJob,
  ImportJobEntry,
  ImportJobEntryStatus,
  ImportJobStatus,
} from "@/data/types";

import type { StoredImportPayload } from "./types";
import { chunkArray } from "./utils";

type DbImportJob = {
  id: string;
  source: string;
  status: ImportJobStatus;
  file_name: string | null;
  file_hash: string | null;
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  last_error: string | null;
};

type DbImportJobCreateReturn = Pick<DbImportJob, "id" | "created_at">;

type DbImportJobEntry = {
  id: string;
  job_id: string;
  row_number: number;
  status: ImportJobEntryStatus;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const IMPORT_JOB_SELECT_COLUMNS =
  "id, source, status, file_name, file_hash, total_rows, processed_rows, error_rows, summary, metadata, created_by, created_at, completed_at, last_error" as const;

export const IMPORT_JOB_CREATE_RETURN_COLUMNS = "id, created_at" as const;

export const IMPORT_JOB_ENTRY_SELECT_COLUMNS =
  "id, job_id, row_number, status, message, payload, created_at, updated_at" as const;

export interface CreateJobArgs {
  source: string;
  profileId: string;
  fileName: string;
  fileHash: string;
  totalRows: number;
  status?: ImportJobStatus;
  summary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type ImportJobPatch = Partial<{
  status: ImportJobStatus;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  processedRows: number;
  errorRows: number;
  completedAt: string | null;
  lastError: string | null;
}>;

export function mergeImportJobPatch(job: ImportJob, patch: ImportJobPatch): ImportJob {
  return {
    ...job,
    status: patch.status ?? job.status,
    summary: typeof patch.summary !== "undefined" ? patch.summary : job.summary,
    metadata: typeof patch.metadata !== "undefined" ? patch.metadata : job.metadata,
    processedRows: typeof patch.processedRows === "number" ? patch.processedRows : job.processedRows,
    errorRows: typeof patch.errorRows === "number" ? patch.errorRows : job.errorRows,
    completedAt: typeof patch.completedAt !== "undefined" ? patch.completedAt : job.completedAt,
    lastError: typeof patch.lastError !== "undefined" ? patch.lastError : job.lastError,
  };
}

const toImportJobUpdatePayload = (patch: ImportJobPatch): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (typeof patch.summary !== "undefined") payload.summary = patch.summary;
  if (typeof patch.metadata !== "undefined") payload.metadata = patch.metadata;
  if (typeof patch.processedRows === "number") payload.processed_rows = patch.processedRows;
  if (typeof patch.errorRows === "number") payload.error_rows = patch.errorRows;
  if (typeof patch.completedAt !== "undefined") payload.completed_at = patch.completedAt;
  if (typeof patch.lastError !== "undefined") payload.last_error = patch.lastError;
  return payload;
};

export async function createImportJobRecord(
  client: SupabaseClient,
  args: CreateJobArgs
): Promise<ImportJob> {
  const insertPayload: Omit<
    DbImportJob,
    | "id"
    | "processed_rows"
    | "error_rows"
    | "created_at"
    | "completed_at"
    | "last_error"
  > = {
    source: args.source,
    status: args.status ?? "pending",
    file_name: args.fileName,
    file_hash: args.fileHash,
    total_rows: args.totalRows,
    summary: args.summary ?? {},
    metadata: args.metadata ?? {},
    created_by: args.profileId,
  };

  const { data, error } = await client
    .from("import_jobs")
    .insert(insertPayload)
    .select(IMPORT_JOB_CREATE_RETURN_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const generated = data as DbImportJobCreateReturn | null;
  if (!generated) {
    throw new Error("Failed to create import job: no row returned");
  }

  return mapImportJob({
    id: generated.id,
    ...insertPayload,
    processed_rows: 0,
    error_rows: 0,
    created_at: generated.created_at,
    completed_at: null,
    last_error: null,
  });
}

export async function insertJobEntries(
  client: SupabaseClient,
  jobId: string,
  entries: Array<{ rowNumber: number; payload: StoredImportPayload }>
): Promise<void> {
  const batches = chunkArray(entries, 500);
  for (const batch of batches) {
    const { error } = await client
      .from("import_job_entries")
      .insert(
        batch.map((entry) => ({
          job_id: jobId,
          row_number: entry.rowNumber,
          payload: entry.payload,
        }))
      );
    if (error) {
      throw error;
    }
  }
}

export async function fetchJobById(
  client: SupabaseClient,
  jobId: string
): Promise<ImportJob | null> {
  const { data, error } = await client
    .from("import_jobs")
    .select(IMPORT_JOB_SELECT_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapImportJob(data as DbImportJob) : null;
}

export async function fetchJobWithEntries(
  client: SupabaseClient,
  jobId: string
): Promise<{ job: ImportJob; entries: ImportJobEntry[] }> {
  const job = await fetchJobById(client, jobId);
  if (!job) {
    throw new Error("Import job not found");
  }

  const { data, error } = await client
    .from("import_job_entries")
    .select(IMPORT_JOB_ENTRY_SELECT_COLUMNS)
    .eq("job_id", jobId)
    .order("row_number", { ascending: true });

  if (error) {
    throw error;
  }

  const entries = (data as DbImportJobEntry[]).map(mapImportJobEntry);
  return { job, entries };
}

export async function updateImportJob(
  client: SupabaseClient,
  jobId: string,
  patch: ImportJobPatch
): Promise<ImportJob> {
  const payload = toImportJobUpdatePayload(patch);

  const { data, error } = await client
    .from("import_jobs")
    .update(payload)
    .eq("id", jobId)
    .select(IMPORT_JOB_SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapImportJob(data as DbImportJob);
}

export async function updateImportJobWithoutReturning(
  client: SupabaseClient,
  jobId: string,
  patch: ImportJobPatch
): Promise<void> {
  const payload = toImportJobUpdatePayload(patch);

  const { error } = await client
    .from("import_jobs")
    .update(payload)
    .eq("id", jobId);

  if (error) {
    throw error;
  }
}

export function mapImportJob(row: DbImportJob): ImportJob {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    fileName: row.file_name ?? undefined,
    fileHash: row.file_hash ?? undefined,
    totalRows: row.total_rows,
    processedRows: row.processed_rows,
    errorRows: row.error_rows,
    summary: row.summary ?? {},
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    lastError: row.last_error,
  };
}

export function mapImportJobEntry(row: DbImportJobEntry): ImportJobEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    rowNumber: row.row_number,
    status: row.status,
    message: row.message ?? undefined,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function extractStoredPayload(
  entry: ImportJobEntry
): StoredImportPayload {
  return entry.payload as unknown as StoredImportPayload;
}
