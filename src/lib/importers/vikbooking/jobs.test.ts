import { describe, expect, it, vi } from "vitest";

import {
  createImportJobRecord,
  IMPORT_JOB_CREATE_RETURN_COLUMNS,
  mergeImportJobPatch,
  updateImportJobWithoutReturning,
} from "./jobs";

const createInsertQuery = (response: unknown) => {
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => response),
  };
  return query;
};

const createUpdateQuery = (response: { error: unknown }) => {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(async () => response),
    select: vi.fn(() => query),
    single: vi.fn(),
  };
  return query;
};

describe("VikBooking import job data access", () => {
  it("merges import job patches locally for no-return updates", () => {
    const job = {
      id: "job-1",
      source: "vikbooking",
      status: "pending",
      fileName: "vikbooking.csv",
      fileHash: "hash-1",
      totalRows: 12,
      processedRows: 2,
      errorRows: 0,
      summary: { skippedRows: [] },
      metadata: { source: "vikbooking" },
      createdBy: "admin-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      completedAt: null,
      lastError: null,
    } as const;

    expect(mergeImportJobPatch(job, {
      status: "completed",
      summary: { skippedRows: [{ rowNumber: 1 }] },
      processedRows: 12,
      completedAt: "2026-05-14T02:00:00.000Z",
      lastError: null,
    })).toEqual({
      ...job,
      status: "completed",
      summary: { skippedRows: [{ rowNumber: 1 }] },
      processedRows: 12,
      completedAt: "2026-05-14T02:00:00.000Z",
      lastError: null,
    });
  });

  it("creates import jobs while selecting only generated fields", async () => {
    const query = createInsertQuery({
      data: {
        id: "job-1",
        created_at: "2026-05-14T00:00:00.000Z",
      },
      error: null,
    });
    const client = { from: vi.fn(() => query) };

    await expect(createImportJobRecord(client as never, {
      source: "vikbooking",
      profileId: "admin-1",
      fileName: "vikbooking.csv",
      fileHash: "hash-1",
      totalRows: 12,
      status: "requires_mapping",
      summary: { issues: [] },
      metadata: { roomLabels: ["Room 1"] },
    })).resolves.toEqual({
      id: "job-1",
      source: "vikbooking",
      status: "requires_mapping",
      fileName: "vikbooking.csv",
      fileHash: "hash-1",
      totalRows: 12,
      processedRows: 0,
      errorRows: 0,
      summary: { issues: [] },
      metadata: { roomLabels: ["Room 1"] },
      createdBy: "admin-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      completedAt: null,
      lastError: null,
    });

    expect(client.from).toHaveBeenCalledWith("import_jobs");
    expect(query.insert).toHaveBeenCalledWith({
      source: "vikbooking",
      status: "requires_mapping",
      file_name: "vikbooking.csv",
      file_hash: "hash-1",
      total_rows: 12,
      summary: { issues: [] },
      metadata: { roomLabels: ["Room 1"] },
      created_by: "admin-1",
    });
    expect(query.select).toHaveBeenCalledWith(IMPORT_JOB_CREATE_RETURN_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("updates import jobs without selecting the row when the caller ignores the result", async () => {
    const query = createUpdateQuery({ error: null });
    const client = { from: vi.fn(() => query) };

    await updateImportJobWithoutReturning(client as never, "job-1", {
      status: "running",
      summary: { skippedRows: [] },
      metadata: { source: "vikbooking" },
      processedRows: 3,
      errorRows: 1,
      completedAt: null,
      lastError: null,
    });

    expect(client.from).toHaveBeenCalledWith("import_jobs");
    expect(query.update).toHaveBeenCalledWith({
      status: "running",
      summary: { skippedRows: [] },
      metadata: { source: "vikbooking" },
      processed_rows: 3,
      error_rows: 1,
      completed_at: null,
      last_error: null,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "job-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });
});
