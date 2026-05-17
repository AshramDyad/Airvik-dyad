import "server-only";

import { JWT } from "google-auth-library";

import type {
  GoogleSheetTransaction,
  GoogleSheetTransactionRawRow,
  GoogleSheetTransactionsPayload,
} from "@/data/types";

const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const DEFAULT_RANGE = "Transactions!A:L";
const SHEETS_VALUES_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

type FieldKey =
  | "fetchedAt"
  | "date"
  | "amount"
  | "description"
  | "payer"
  | "method"
  | "reference"
  | "status";

type SheetsConfig = {
  spreadsheetId: string;
  range: string;
  clientEmail: string;
  privateKey: string;
};

type FieldIndexes = Partial<Record<FieldKey, number>>;

const FIELD_ALIASES: Record<FieldKey, readonly string[]> = {
  fetchedAt: [
    "fetched_at",
    "fetched at",
    "fetch timestamp",
    "sync timestamp",
    "synced at",
  ],
  date: [
    "date",
    "transaction date",
    "payment date",
    "paid date",
    "paid at",
    "timestamp",
    "created at",
  ],
  amount: [
    "amount",
    "paid amount",
    "payment amount",
    "received amount",
    "credit",
    "deposit",
    "total amount",
  ],
  description: [
    "description",
    "details",
    "remarks",
    "note",
    "narration",
    "particulars",
    "purpose",
  ],
  payer: [
    "payer",
    "paid by",
    "customer",
    "guest",
    "guest name",
    "name",
    "sender",
    "from",
  ],
  method: [
    "method",
    "payment method",
    "payment mode",
    "mode",
    "type",
    "channel",
  ],
  reference: [
    "reference",
    "reference no",
    "reference number",
    "utr",
    "transaction id",
    "txn id",
    "transaction reference",
    "rrn",
  ],
  status: [
    "status",
    "payment status",
    "state",
  ],
};

export class GoogleSheetsTransactionsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSheetsTransactionsConfigError";
  }
}

export class GoogleSheetsTransactionsFetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "GoogleSheetsTransactionsFetchError";
  }
}

export async function fetchGoogleSheetTransactions(): Promise<GoogleSheetTransactionsPayload> {
  const config = getSheetsConfig();
  const values = await fetchSheetValues(config);
  return parseTransactions(values, config.spreadsheetId, config.range);
}

function getSheetsConfig(): SheetsConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID?.trim();
  const range =
    process.env.GOOGLE_TRANSACTIONS_RANGE?.trim() ||
    process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE?.trim() ||
    DEFAULT_RANGE;
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim();

  const missing = [
    ["GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID", spreadsheetId],
    ["GOOGLE_SHEETS_CLIENT_EMAIL", clientEmail],
    ["GOOGLE_SHEETS_PRIVATE_KEY", privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new GoogleSheetsTransactionsConfigError(
      `Missing Google Sheets configuration: ${missing.join(", ")}.`
    );
  }

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new GoogleSheetsTransactionsConfigError(
      "Missing Google Sheets configuration."
    );
  }

  return {
    spreadsheetId,
    range,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

async function fetchSheetValues(config: SheetsConfig): Promise<string[][]> {
  const authClient = new JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: [READONLY_SCOPE],
  });

  const accessToken = await getAccessToken(authClient);
  const endpoint = new URL(
    `${SHEETS_VALUES_BASE_URL}/${encodeURIComponent(
      config.spreadsheetId
    )}/values/${encodeURIComponent(config.range)}`
  );
  endpoint.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  endpoint.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readGoogleErrorMessage(response);
    throw new GoogleSheetsTransactionsFetchError(message, response.status);
  }

  const body: unknown = await response.json();
  return readValuesResponse(body);
}

async function getAccessToken(authClient: JWT): Promise<string> {
  const tokenResponse: unknown = await authClient.getAccessToken();

  if (typeof tokenResponse === "string" && tokenResponse.trim()) {
    return tokenResponse;
  }

  if (isRecord(tokenResponse)) {
    const token = tokenResponse.token;
    if (typeof token === "string" && token.trim()) {
      return token;
    }
  }

  throw new GoogleSheetsTransactionsFetchError(
    "Google Sheets authentication did not return an access token."
  );
}

async function readGoogleErrorMessage(response: Response): Promise<string> {
  const fallback = `Google Sheets request failed with status ${response.status}.`;

  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      return fallback;
    }

    const error = body.error;
    if (isRecord(error) && typeof error.message === "string") {
      return error.message;
    }

    if (typeof body.message === "string") {
      return body.message;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readValuesResponse(body: unknown): string[][] {
  if (!isRecord(body)) {
    throw new GoogleSheetsTransactionsFetchError(
      "Google Sheets returned an unexpected response."
    );
  }

  const values = body.values;
  if (values === undefined) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new GoogleSheetsTransactionsFetchError(
      "Google Sheets returned values in an unexpected format."
    );
  }

  return values.map((row) => {
    if (!Array.isArray(row)) {
      return [];
    }

    return row.map(cellToString);
  });
}

function parseTransactions(
  values: string[][],
  spreadsheetId: string,
  range: string
): GoogleSheetTransactionsPayload {
  const headers = (values[0] ?? []).map((header, index) => {
    const trimmed = header.trim();
    return trimmed || `Column ${index + 1}`;
  });
  const fieldIndexes = detectFieldIndexes(headers);
  const startRow = parseStartRow(range);

  const rows = values.slice(1).reduce<GoogleSheetTransaction[]>((acc, cells, index) => {
    if (cells.every((cell) => cell.trim().length === 0)) {
      return acc;
    }

    acc.push(parseTransactionRow(cells, headers, fieldIndexes, startRow + index + 1));
    return acc;
  }, []);

  return {
    spreadsheetId,
    range,
    fetchedAt: new Date().toISOString(),
    headers,
    rows,
  };
}

function parseTransactionRow(
  cells: string[],
  headers: string[],
  fieldIndexes: FieldIndexes,
  rowNumber: number
): GoogleSheetTransaction {
  const date = getCell(cells, fieldIndexes.date);
  const fetchedAt = getCell(cells, fieldIndexes.fetchedAt);
  const amountText = getCell(cells, fieldIndexes.amount);
  const description = getCell(cells, fieldIndexes.description);
  const payer = getCell(cells, fieldIndexes.payer);
  const method = getCell(cells, fieldIndexes.method);
  const reference = getCell(cells, fieldIndexes.reference);
  const status = getCell(cells, fieldIndexes.status);

  return {
    rowNumber,
    fetchedAt,
    date,
    amount: parseAmount(amountText),
    amountText,
    description,
    payer,
    method,
    reference,
    status,
    raw: buildRawRow(cells, headers),
    cells: cells.map((cell) => cell.trim()),
  };
}

function detectFieldIndexes(headers: string[]): FieldIndexes {
  return {
    fetchedAt: findHeaderIndex(headers, FIELD_ALIASES.fetchedAt),
    date: findHeaderIndex(headers, FIELD_ALIASES.date),
    amount: findHeaderIndex(headers, FIELD_ALIASES.amount),
    description: findHeaderIndex(headers, FIELD_ALIASES.description),
    payer: findHeaderIndex(headers, FIELD_ALIASES.payer),
    method: findHeaderIndex(headers, FIELD_ALIASES.method),
    reference: findHeaderIndex(headers, FIELD_ALIASES.reference),
    status: findHeaderIndex(headers, FIELD_ALIASES.status),
  };
}

function findHeaderIndex(
  headers: string[],
  aliases: readonly string[]
): number | undefined {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedAliases = aliases.map(normalizeHeader);

  for (const alias of normalizedAliases) {
    const index = normalizedHeaders.findIndex((header) => header === alias);
    if (index >= 0) {
      return index;
    }
  }

  for (const alias of normalizedAliases) {
    const index = normalizedHeaders.findIndex((header) =>
      alias.length > 2 ? header.includes(alias) : false
    );
    if (index >= 0) {
      return index;
    }
  }

  return undefined;
}

function buildRawRow(
  cells: string[],
  headers: string[]
): GoogleSheetTransactionRawRow {
  const raw: GoogleSheetTransactionRawRow = {};
  const length = Math.max(headers.length, cells.length);

  for (let index = 0; index < length; index += 1) {
    const baseHeader = headers[index]?.trim() || `Column ${index + 1}`;
    const key = createUniqueKey(raw, baseHeader);
    raw[key] = cells[index]?.trim() ?? "";
  }

  return raw;
}

function createUniqueKey(
  row: GoogleSheetTransactionRawRow,
  baseKey: string
): string {
  if (!(baseKey in row)) {
    return baseKey;
  }

  let suffix = 2;
  let key = `${baseKey} ${suffix}`;
  while (key in row) {
    suffix += 1;
    key = `${baseKey} ${suffix}`;
  }
  return key;
}

function getCell(cells: string[], index: number | undefined): string | null {
  if (index === undefined) {
    return null;
  }

  const value = cells[index]?.trim();
  return value ? value : null;
}

function parseAmount(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStartRow(range: string): number {
  const rangePart = range.split("!").pop() ?? range;
  const match = rangePart.match(/[A-Za-z]+(\d+)/);
  if (!match) {
    return 1;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
