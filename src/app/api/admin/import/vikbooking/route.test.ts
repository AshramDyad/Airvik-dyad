import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminProfile: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));
const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());
const parserMocks = vi.hoisted(() => ({
  parseVikBookingCsv: vi.fn(),
}));
const jobMocks = vi.hoisted(() => ({
  createImportJobRecord: vi.fn(),
  fetchJobWithEntries: vi.fn(),
  updateImportJob: vi.fn(),
  updateImportJobWithoutReturning: vi.fn(),
  mergeImportJobPatch: vi.fn((job, patch) => ({
    ...job,
    status: patch.status ?? job.status,
    summary: typeof patch.summary !== "undefined" ? patch.summary : job.summary,
    metadata: typeof patch.metadata !== "undefined" ? patch.metadata : job.metadata,
    processedRows: typeof patch.processedRows === "number" ? patch.processedRows : job.processedRows,
    errorRows: typeof patch.errorRows === "number" ? patch.errorRows : job.errorRows,
    completedAt: typeof patch.completedAt !== "undefined" ? patch.completedAt : job.completedAt,
    lastError: typeof patch.lastError !== "undefined" ? patch.lastError : job.lastError,
  })),
  insertJobEntries: vi.fn(),
  fetchJobById: vi.fn(),
  extractStoredPayload: vi.fn(),
}));
const roomLinkMocks = vi.hoisted(() => ({
  fetchExternalRoomLinks: vi.fn(),
  resolveRoomMappings: vi.fn(),
}));
const roomNumberLinkMocks = vi.hoisted(() => ({
  fetchRoomNumberLinks: vi.fn(),
  buildRoomNumberAliasMap: vi.fn(),
}));
const roomNumberMapMocks = vi.hoisted(() => ({
  assignRoomIdsFromNumbers: vi.fn(),
  fetchRoomNumberMap: vi.fn(),
  normalizeRoomNumber: vi.fn(),
}));
const transformerMocks = vi.hoisted(() => ({
  buildRpcRows: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));
vi.mock("@/lib/importers/vikbooking/parser", () => parserMocks);
vi.mock("@/lib/importers/vikbooking/jobs", () => jobMocks);
vi.mock("@/lib/importers/vikbooking/room-links", () => roomLinkMocks);
vi.mock("@/lib/importers/vikbooking/room-number-links", () => roomNumberLinkMocks);
vi.mock("@/lib/importers/vikbooking/room-number-map", () => roomNumberMapMocks);
vi.mock("@/lib/importers/vikbooking/transformers", () => transformerMocks);

import { SUMMARY_PREVIEW_LIMIT } from "@/lib/importers/vikbooking/constants";

import { POST } from "./route";

const buildParsedRow = (rowNumber: number) => ({
  rowNumber,
  bookingId: `BK-${rowNumber}`,
  externalId: `EXT-${rowNumber}`,
  roomLabel: `Room ${rowNumber}`,
  roomLabelDisplay: `Room ${rowNumber}`,
  roomNumber: `${rowNumber}`,
  checkInDate: "2026-05-14",
  checkOutDate: "2026-05-15",
  totalAmount: rowNumber * 100,
  guest: {
    firstName: `Guest ${rowNumber}`,
    lastName: "Visitor",
    email: `guest-${rowNumber}@example.com`,
    phone: "",
  },
});

describe("VikBooking import API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminProfile.mockResolvedValue({ userId: "admin-1" });
    createServerSupabaseClientMock.mockReturnValue({});
    jobMocks.createImportJobRecord.mockResolvedValue({
      id: "job-1",
      source: "vikbooking",
      status: "pending",
      totalRows: SUMMARY_PREVIEW_LIMIT + 5,
      processedRows: 0,
      errorRows: 0,
      summary: {},
      metadata: {},
      createdBy: "admin-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      completedAt: null,
      lastError: null,
    });
    jobMocks.insertJobEntries.mockResolvedValue(undefined);
    jobMocks.updateImportJob.mockResolvedValue(undefined);
    jobMocks.updateImportJobWithoutReturning.mockResolvedValue(undefined);
    roomNumberMapMocks.fetchRoomNumberMap.mockResolvedValue(new Map());
    roomNumberLinkMocks.fetchRoomNumberLinks.mockResolvedValue([]);
    roomNumberLinkMocks.buildRoomNumberAliasMap.mockReturnValue(new Map());
    roomNumberMapMocks.assignRoomIdsFromNumbers.mockImplementation((rows) =>
      new Map(
        rows.map((row: { rowNumber: number }) => [
          String(row.rowNumber),
          `room-${row.rowNumber}`,
        ]),
      ),
    );
    roomLinkMocks.fetchExternalRoomLinks.mockResolvedValue([]);
    roomLinkMocks.resolveRoomMappings.mockReturnValue({
      mapped: new Map(),
      missing: [],
    });
  });

  it("dry-run validation returns only the bounded preview rows without shared caching", async () => {
    const parsedRows = Array.from(
      { length: SUMMARY_PREVIEW_LIMIT + 5 },
      (_, index) => buildParsedRow(index + 1),
    );
    parserMocks.parseVikBookingCsv.mockResolvedValue({
      rows: parsedRows,
      issues: [],
      hash: "hash-1",
      uniqueRoomLabels: parsedRows.map((row) => row.roomLabel),
    });

    const formData = new FormData();
    formData.append("file", new File(["booking_id\n1"], "vikbooking.csv"));

    const response = await POST({
      url: "https://airvik.test/api/admin/import/vikbooking?dryRun=true",
      formData: async () => formData,
    } as Request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");

    const payload = await response.json();
    expect(payload.preview).toHaveLength(SUMMARY_PREVIEW_LIMIT);
    expect(payload.totalRows).toBe(SUMMARY_PREVIEW_LIMIT + 5);
    expect(jobMocks.insertJobEntries).toHaveBeenCalledWith(
      expect.anything(),
      "job-1",
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 1,
          payload: expect.objectContaining({ bookingId: "BK-1" }),
        }),
      ]),
    );
  });

  it("marks import jobs running without returning the updated job row", async () => {
    const jobId = "00000000-0000-0000-0000-000000000001";
    const job = {
      id: jobId,
      source: "vikbooking",
      status: "pending",
      totalRows: 1,
      processedRows: 0,
      errorRows: 0,
      summary: {},
      metadata: {},
      createdBy: "admin-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      completedAt: null,
      lastError: null,
    };
    const entry = {
      id: "entry-1",
      jobId,
      rowNumber: 1,
      status: "pending",
      payload: {},
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
    };
    const rpc = vi.fn(async () => ({ error: null }));
    createServerSupabaseClientMock.mockReturnValue({ rpc });
    jobMocks.fetchJobWithEntries.mockResolvedValue({ job, entries: [entry] });
    jobMocks.extractStoredPayload.mockReturnValue({
      ...buildParsedRow(1),
      externalId: undefined,
      roomNumber: "101",
    });
    jobMocks.fetchJobById.mockResolvedValue({
      ...job,
      status: "completed",
      processedRows: 1,
    });
    roomNumberMapMocks.assignRoomIdsFromNumbers.mockReturnValue(
      new Map([["entry-1", "room-1"]]),
    );
    transformerMocks.buildRpcRows.mockReturnValue([{ rowNumber: 1 }]);

    const response = await POST(
      new Request("https://airvik.test/api/admin/import/vikbooking", {
        method: "POST",
        body: JSON.stringify({ jobId }),
      }),
    );

    expect(response.status).toBe(200);
    expect(jobMocks.updateImportJobWithoutReturning).toHaveBeenCalledWith(
      expect.anything(),
      jobId,
      { status: "running" },
    );
    expect(jobMocks.updateImportJob).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("import_vikbooking_payload", {
      p_job_id: jobId,
      p_rows: [{ rowNumber: 1 }],
      p_mark_complete: true,
    });
    await expect(response.json()).resolves.toEqual({
      job: { ...job, status: "completed", processedRows: 1 },
    });
  });

  it("completes all-skipped import jobs without returning the updated job row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T02:00:00.000Z"));

    try {
      const jobId = "00000000-0000-0000-0000-000000000001";
      const job = {
        id: jobId,
        source: "vikbooking",
        status: "pending",
        totalRows: 1,
        processedRows: 0,
        errorRows: 0,
        summary: {},
        metadata: {},
        createdBy: "admin-1",
        createdAt: "2026-05-14T00:00:00.000Z",
        completedAt: null,
        lastError: null,
      };
      const entry = {
        id: "entry-1",
        jobId,
        rowNumber: 1,
        status: "pending",
        payload: {},
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z",
      };
      const reservationsQuery = {
        select: vi.fn(() => reservationsQuery),
        eq: vi.fn(() => reservationsQuery),
        in: vi.fn(async () => ({
          data: [{ external_id: "EXT-1", room_id: "room-1" }],
          error: null,
        })),
      };
      const entryUpdateQuery = {
        update: vi.fn(() => entryUpdateQuery),
        eq: vi.fn(async () => ({ error: null })),
      };
      const from = vi.fn((table: string) => {
        if (table === "reservations") return reservationsQuery;
        if (table === "import_job_entries") return entryUpdateQuery;
        throw new Error(`Unexpected table ${table}`);
      });
      createServerSupabaseClientMock.mockReturnValue({ from });
      jobMocks.fetchJobWithEntries.mockResolvedValue({ job, entries: [entry] });
      jobMocks.extractStoredPayload.mockReturnValue({
        ...buildParsedRow(1),
        externalId: "EXT-1",
        roomNumber: "101",
      });
      roomNumberMapMocks.assignRoomIdsFromNumbers.mockReturnValue(
        new Map([["entry-1", "room-1"]]),
      );

      const response = await POST(
        new Request("https://airvik.test/api/admin/import/vikbooking", {
          method: "POST",
          body: JSON.stringify({ jobId }),
        }),
      );

      expect(response.status).toBe(200);
      expect(jobMocks.updateImportJob).not.toHaveBeenCalled();
      expect(jobMocks.updateImportJobWithoutReturning).toHaveBeenCalledWith(
        expect.anything(),
        jobId,
        { status: "running" },
      );
      expect(jobMocks.updateImportJobWithoutReturning).toHaveBeenCalledWith(
        expect.anything(),
        jobId,
        expect.objectContaining({
          processedRows: 1,
          summary: expect.objectContaining({
            skippedRows: [
              expect.objectContaining({
                entryId: "entry-1",
                rowNumber: 1,
                reasonCode: "already_imported",
              }),
            ],
          }),
        }),
      );
      expect(jobMocks.updateImportJobWithoutReturning).toHaveBeenCalledWith(
        expect.anything(),
        jobId,
        expect.objectContaining({
          status: "completed",
          processedRows: 1,
          completedAt: "2026-05-14T02:00:00.000Z",
        }),
      );
      await expect(response.json()).resolves.toEqual({
        job: {
          ...job,
          status: "completed",
          processedRows: 1,
          summary: {
            skippedRows: [
              expect.objectContaining({
                entryId: "entry-1",
                rowNumber: 1,
                reasonCode: "already_imported",
              }),
            ],
          },
          completedAt: "2026-05-14T02:00:00.000Z",
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
