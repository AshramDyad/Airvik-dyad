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
});
