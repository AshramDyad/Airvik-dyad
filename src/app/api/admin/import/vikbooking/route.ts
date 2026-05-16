import { NextResponse } from "next/server";
import { z } from "zod";

import type { ImportJobEntry } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { SUMMARY_PREVIEW_LIMIT, IMPORT_CHUNK_SIZE, VIKBOOKING_SOURCE } from "@/lib/importers/vikbooking/constants";
import { parseVikBookingCsv } from "@/lib/importers/vikbooking/parser";
import {
  createImportJobRecord,
  fetchJobWithEntries,
  updateImportJob,
  updateImportJobWithoutReturning,
  mergeImportJobPatch,
  insertJobEntries,
  fetchJobById,
  extractStoredPayload,
} from "@/lib/importers/vikbooking/jobs";
import {
  fetchExternalRoomLinks,
  resolveRoomMappings,
} from "@/lib/importers/vikbooking/room-links";
import {
  fetchRoomNumberLinks,
  buildRoomNumberAliasMap,
} from "@/lib/importers/vikbooking/room-number-links";
import { buildRpcRows } from "@/lib/importers/vikbooking/transformers";
import { chunkArray } from "@/lib/importers/vikbooking/utils";
import {
  assignRoomIdsFromNumbers,
  fetchRoomNumberMap,
  normalizeRoomNumber,
} from "@/lib/importers/vikbooking/room-number-map";
import type { SkipReportEntry, StoredImportPayload } from "@/lib/importers/vikbooking/types";
import { requireAdminProfile, HttpError } from "@/lib/server/auth";

const ImportRunSchema = z.object({
  jobId: z.string().uuid(),
});

const DUPLICATE_LOOKUP_CHUNK = 200;
const SKIP_REASON_ALREADY_IMPORTED = "already_imported";
const SKIP_REASON_DUPLICATE_IN_FILE = "duplicate_in_file";
const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

const buildAssignmentKey = (payload: StoredImportPayload, roomId: string): string => {
  if (payload.externalId) {
    return `${payload.externalId}::${roomId}`;
  }
  return `${payload.bookingId}::${roomId}::${payload.rowNumber}`;
};

export async function POST(request: Request) {
  try {
    const profile = await requireAdminProfile(request);
    const supabase = createServerSupabaseClient();
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

    if (dryRun) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return noStoreJson(
          { message: "CSV file is required" },
          { status: 400 }
        );
      }

      const parseResult = await parseVikBookingCsv(file);
      if (parseResult.rows.length === 0) {
        return noStoreJson(
          { message: "The CSV did not contain any rows" },
          { status: 400 }
        );
      }
      const roomNumberMap = await fetchRoomNumberMap(supabase);
      const roomNumberLinks = await fetchRoomNumberLinks(supabase, VIKBOOKING_SOURCE);
      const aliasMap = buildRoomNumberAliasMap(roomNumberLinks);
      const combinedRoomNumberMap = new Map(roomNumberMap);
      aliasMap.forEach((roomId, key) => combinedRoomNumberMap.set(key, roomId));
      const autoAssignments = assignRoomIdsFromNumbers(
        parseResult.rows,
        combinedRoomNumberMap,
        (row) => String(row.rowNumber),
        (row) => row.roomNumber ?? null
      );
      const autoMatchedCount = autoAssignments.size;
      const autoMatchedRowKeys = new Set(autoAssignments.keys());
      const rowsNeedingMapping = parseResult.rows.filter(
        (row) => !autoMatchedRowKeys.has(String(row.rowNumber))
      );
      const manualLabels = Array.from(
        new Set(rowsNeedingMapping.map((row) => row.roomLabel?.trim() ?? ""))
      );
      const links = await fetchExternalRoomLinks(supabase, VIKBOOKING_SOURCE);
      const { missing: missingRoomLabels } = resolveRoomMappings(
        manualLabels,
        links
      );

      const missingRoomNumberSet = new Set<string>();
      rowsNeedingMapping.forEach((row) => {
        if (!row.roomNumber) {
          return;
        }
        const normalized = normalizeRoomNumber(row.roomNumber);
        if (!normalized) {
          return;
        }
        if (!combinedRoomNumberMap.has(normalized)) {
          missingRoomNumberSet.add(row.roomNumber.trim());
        }
      });
      const missingRoomNumbers = Array.from(missingRoomNumberSet);

      const hasBlockingIssues = parseResult.issues.some(
        (issue) => issue.severity === "error"
      );

      const summaryPreview = parseResult.rows.slice(0, SUMMARY_PREVIEW_LIMIT);

      const job = await createImportJobRecord(supabase, {
        source: VIKBOOKING_SOURCE,
        profileId: profile.userId,
        fileName: file.name,
        fileHash: parseResult.hash,
        totalRows: parseResult.rows.length,
        status:
          missingRoomLabels.length > 0 || missingRoomNumbers.length > 0 || hasBlockingIssues
            ? "requires_mapping"
            : "pending",
        summary: {
          issues: parseResult.issues,
          preview: summaryPreview,
          autoMatchedCount,
          missingRoomLabels,
          missingRoomNumbers,
        },
        metadata: {
          roomLabels: parseResult.uniqueRoomLabels,
          autoMatchedCount,
          missingRoomNumbersCount: missingRoomNumbers.length,
        },
      });

      await insertJobEntries(
        supabase,
        job.id,
        parseResult.rows.map((row) => ({
          rowNumber: row.rowNumber,
          payload: row,
        }))
      );

      return noStoreJson({
        job,
        issues: parseResult.issues,
        missingRoomLabels,
        missingRoomNumbers,
        preview: summaryPreview,
        totalRows: parseResult.rows.length,
        autoMatchedCount,
      });
    }

    const body = await request.json();
    const { jobId } = ImportRunSchema.parse(body);

    const { job, entries } = await fetchJobWithEntries(supabase, jobId);
    if (job.source !== VIKBOOKING_SOURCE) {
      return noStoreJson({ message: "Job source mismatch" }, { status: 400 });
    }

    if (job.status === "completed") {
      return noStoreJson(
        { message: "Import job is already completed" },
        { status: 400 }
      );
    }

    if (job.status === "running") {
      return noStoreJson(
        { message: "Import job is currently running" },
        { status: 409 }
      );
    }

    if (!entries.length) {
      return noStoreJson(
        { message: "No rows available for import" },
        { status: 400 }
      );
    }

    const links = await fetchExternalRoomLinks(supabase, VIKBOOKING_SOURCE);
    const roomNumberMap = await fetchRoomNumberMap(supabase);
    const roomNumberLinks = await fetchRoomNumberLinks(supabase, VIKBOOKING_SOURCE);
    const roomNumberAliases = buildRoomNumberAliasMap(roomNumberLinks);
    const combinedRoomNumberMap = new Map(roomNumberMap);
    roomNumberAliases.forEach((roomId, key) => combinedRoomNumberMap.set(key, roomId));
    const entryPayloads = entries.map((entry) => ({
      entry,
      payload: extractStoredPayload(entry),
    }));
    const autoAssignments = assignRoomIdsFromNumbers(
      entryPayloads,
      combinedRoomNumberMap,
      ({ entry }) => entry.id,
      ({ payload }) => payload.roomNumber ?? null
    );
    const rowsMissingNumberMapping = entryPayloads.filter(
      ({ entry, payload }) => Boolean(payload.roomNumber) && !autoAssignments.has(entry.id)
    );
    if (rowsMissingNumberMapping.length > 0) {
      const missingRoomNumbers = Array.from(
        new Set(
          rowsMissingNumberMapping
            .map(({ payload }) => payload.roomNumber?.trim() ?? "")
            .filter(Boolean)
        )
      );
      return noStoreJson(
        {
          message: "Room number mappings are incomplete",
          missingRoomNumbers,
        },
        { status: 400 }
      );
    }
    const needsManual = entryPayloads.filter(
      ({ entry }) => !autoAssignments.has(entry.id)
    );
    const uniqueLabels = Array.from(
      new Set(needsManual.map(({ payload }) => payload.roomLabel?.trim() ?? ""))
    );

    const { mapped, missing } = resolveRoomMappings(uniqueLabels, links);

    if (missing.length > 0) {
      return noStoreJson(
        {
          message: "Room mappings are incomplete",
          missingRoomLabels: missing,
        },
        { status: 400 }
      );
    }

    await updateImportJobWithoutReturning(supabase, jobId, { status: "running" });

    const roomAssignments = new Map(autoAssignments);
    needsManual.forEach(({ entry, payload }) => {
      const normalized = payload.roomLabel?.trim() ?? "";
      const roomId = mapped.get(normalized);
      if (!roomId) {
        throw new Error(`Missing mapped room for label "${payload.roomLabel ?? ""}"`);
      }
      roomAssignments.set(entry.id, roomId);
    });

    if (roomAssignments.size !== entries.length) {
      throw new Error("Unable to resolve room assignments for all rows");
    }

    let summaryState: Record<string, unknown> = { ...(job.summary ?? {}) };
    let processedRowTally = job.processedRows ?? 0;

    type AssignmentRow = {
      entry: ImportJobEntry;
      payload: StoredImportPayload;
      roomId: string;
    };

    const appendSkippedRows = async (
      rowsToSkip: AssignmentRow[],
      options: { reasonCode: string; buildReason: (row: AssignmentRow) => string }
    ) => {
      if (!rowsToSkip.length) {
        return;
      }
      const timestamp = new Date().toISOString();
      const skipReportEntries: SkipReportEntry[] = rowsToSkip.map((row) => {
        const guestParts = [row.payload.guest.firstName, row.payload.guest.lastName]
          .map((part) => (part ?? "").trim())
          .filter(Boolean);
        const roomLabel = row.payload.roomLabelDisplay ?? row.payload.roomLabel ?? null;
        const reason = options.buildReason(row);
        return {
          entryId: row.entry.id,
          rowNumber: row.entry.rowNumber,
          bookingId: row.payload.bookingId,
          roomLabel,
          guestName: guestParts.length ? guestParts.join(" ") : undefined,
          reason,
          reasonCode: options.reasonCode,
          skippedAt: timestamp,
        } satisfies SkipReportEntry;
      });

      const existingSkippedRaw = (summaryState as { skippedRows?: unknown }).skippedRows;
      const existingSkipped = Array.isArray(existingSkippedRaw)
        ? (existingSkippedRaw as SkipReportEntry[])
        : [];

      summaryState = {
        ...summaryState,
        skippedRows: [...existingSkipped, ...skipReportEntries],
      };

      processedRowTally += rowsToSkip.length;

      for (const report of skipReportEntries) {
        const { error } = await supabase
          .from("import_job_entries")
          .update({
            status: "skipped",
            message: report.reason,
            skip_reason_code: options.reasonCode,
            updated_at: timestamp,
          })
          .eq("id", report.entryId);
        if (error) {
          throw error;
        }
      }

      await updateImportJobWithoutReturning(supabase, jobId, {
        summary: summaryState,
        processedRows: processedRowTally,
      });
    };

    const rowsWithAssignments: AssignmentRow[] = entryPayloads.map(({ entry, payload }) => {
      const roomId = roomAssignments.get(entry.id);
      if (!roomId) {
        throw new Error(`Missing room assignment for entry ${entry.id}`);
      }
      return { entry, payload, roomId };
    });

    const assignmentByKey = new Map<string, AssignmentRow>();
    const duplicateWithinJob: AssignmentRow[] = [];
    rowsWithAssignments.forEach((row) => {
      const key = buildAssignmentKey(row.payload, row.roomId);
      if (assignmentByKey.has(key)) {
        duplicateWithinJob.push(row);
      } else {
        assignmentByKey.set(key, row);
      }
    });

    if (duplicateWithinJob.length > 0) {
      await appendSkippedRows(duplicateWithinJob, {
        reasonCode: SKIP_REASON_DUPLICATE_IN_FILE,
        buildReason: (row) => {
          const roomLabel = row.payload.roomLabelDisplay ?? row.payload.roomLabel;
          return roomLabel
            ? `Duplicate booking for ${roomLabel} in CSV`
            : "Duplicate booking in CSV";
        },
      });
    }

    const uniqueRowsWithAssignments = Array.from(assignmentByKey.values());

    const externalIds = Array.from(
      new Set(uniqueRowsWithAssignments.map(({ payload }) => payload.externalId).filter(Boolean))
    );

    const duplicateKeys = new Set<string>();
    if (externalIds.length > 0) {
      const idChunks = chunkArray(externalIds, DUPLICATE_LOOKUP_CHUNK);
      for (const chunk of idChunks) {
        if (!chunk.length) continue;
        const { data, error } = await supabase
          .from("reservations")
          .select("external_id, room_id")
          .eq("external_source", VIKBOOKING_SOURCE)
          .in("external_id", chunk);
        if (error) {
          throw error;
        }
        (data ?? []).forEach((row) => {
          if (row.external_id && row.room_id) {
            duplicateKeys.add(`${row.external_id}::${row.room_id}`);
          }
        });
      }
    }

    const skippedRows = uniqueRowsWithAssignments.filter(
      ({ payload, roomId }) => Boolean(payload.externalId) && duplicateKeys.has(`${payload.externalId}::${roomId}`)
    );
    const rowsToImport = uniqueRowsWithAssignments.filter(
      ({ payload, roomId }) => !payload.externalId || !duplicateKeys.has(`${payload.externalId}::${roomId}`)
    );

    if (skippedRows.length > 0) {
      await appendSkippedRows(skippedRows, {
        reasonCode: SKIP_REASON_ALREADY_IMPORTED,
        buildReason: (row) => {
          const roomLabel = row.payload.roomLabelDisplay ?? row.payload.roomLabel;
          return roomLabel
            ? `Booking already imported for ${roomLabel}`
            : "Booking already imported";
        },
      });
    }

    if (rowsToImport.length === 0) {
      const completionPatch = {
        status: "completed",
        summary: summaryState,
        processedRows: processedRowTally,
        completedAt: new Date().toISOString(),
      } as const;
      await updateImportJobWithoutReturning(supabase, jobId, completionPatch);
      return noStoreJson({ job: mergeImportJobPatch(job, completionPatch) });
    }

    const entriesForImport = rowsToImport.map(({ entry }) => entry);

    const rpcRows = buildRpcRows({
      entries: entriesForImport,
      roomAssignments,
      actorUserId: profile.userId,
    });

    const chunks = chunkArray(rpcRows, IMPORT_CHUNK_SIZE);

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const isLast = index === chunks.length - 1;
        const { error } = await supabase.rpc("import_vikbooking_payload", {
          p_job_id: jobId,
          p_rows: chunk,
          p_mark_complete: isLast,
        });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      await updateImportJobWithoutReturning(supabase, jobId, {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Import RPC failed",
      });
      throw error;
    }

    const latestJob = await fetchJobById(supabase, jobId);
    return noStoreJson({ job: latestJob });
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error("VikBooking import error", error);
    return noStoreJson(
      { message: "Failed to process VikBooking import" },
      { status: 500 }
    );
  }
}
