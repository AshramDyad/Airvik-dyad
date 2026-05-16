"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ImportJob, ImportJobEntryStatus, Room } from "@/data/types";
import type { ImportIssue, SkipReportEntry } from "@/lib/importers/vikbooking/types";
import { authorizedFetch } from "@/lib/auth/client-session";

type PreviewRow = Record<string, unknown>;
type RoomOption = Pick<Room, "id" | "roomNumber">;

type RoomOptionsResponse = {
  data?: RoomOption[];
};

type JobStatusResponse = {
  job: ImportJob;
  statusCounts: Record<string, number>;
  errors: Array<{ id: string; rowNumber: number; message?: string | null }>;
  skippedEntries: SkipReportEntry[];
};

export function CsvImportPanel() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = React.useRef<number | null>(null);
  const [rooms, setRooms] = React.useState<RoomOption[]>([]);
  const [isRoomsLoading, setIsRoomsLoading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [job, setJob] = React.useState<ImportJob | null>(null);
  const [issues, setIssues] = React.useState<ImportIssue[]>([]);
  const [missingRooms, setMissingRooms] = React.useState<string[]>([]);
  const [missingRoomNumbers, setMissingRoomNumbers] = React.useState<string[]>([]);
  const [previewRows, setPreviewRows] = React.useState<PreviewRow[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [statusCounts, setStatusCounts] = React.useState<Record<string, number>>({});
  const [recentErrors, setRecentErrors] = React.useState<
    Array<{ id: string; rowNumber: number; message?: string | null }>
  >([]);
  const [skipReport, setSkipReport] = React.useState<SkipReportEntry[]>([]);
  const [lastCompletedJobId, setLastCompletedJobId] = React.useState<string | null>(null);
  const [activeImportJobId, setActiveImportJobId] = React.useState<string | null>(null);

  const hasBlockingIssues = React.useMemo(
    () => issues.some((issue) => issue.severity === "error"),
    [issues]
  );

  const loadRoomOptions = React.useCallback(async () => {
    setIsRoomsLoading(true);
    try {
      const response = await authorizedFetch("/api/admin/rooms/options", {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to load room options");
      }
      const payload = (await response.json()) as RoomOptionsResponse;
      setRooms(payload.data ?? []);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message ?? "Unable to load room options");
    } finally {
      setIsRoomsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const needsRoomOptions =
      missingRooms.length > 0 || missingRoomNumbers.length > 0;
    if (!needsRoomOptions || rooms.length > 0 || isRoomsLoading) {
      return;
    }
    void loadRoomOptions();
  }, [
    isRoomsLoading,
    loadRoomOptions,
    missingRoomNumbers.length,
    missingRooms.length,
    rooms.length,
  ]);

  const progress = React.useMemo(() => {
    if (!job || job.totalRows === 0) return 0;
    const value = Math.floor(
      (Math.min(job.processedRows, job.totalRows) / job.totalRows) * 100
    );
    return Number.isFinite(value) ? value : 0;
  }, [job]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    setSelectedFile(nextFile ?? null);
  };

  const handleValidate = async () => {
    if (!selectedFile) {
      fileInputRef.current?.focus();
      return;
    }

    setIsUploading(true);
    setIssues([]);
    setPreviewRows([]);
    setJob(null);
    setMissingRooms([]);
    setMissingRoomNumbers([]);
    setStatusCounts({});
    setRecentErrors([]);
    setSkipReport([]);
    setActiveImportJobId(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await authorizedFetch(
        "/api/admin/import/vikbooking?dryRun=true",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message ?? "Validation failed");
      }

      const result = await response.json();
      setJob(result.job);
      setIssues(result.issues ?? []);
      setPreviewRows(result.preview ?? []);
      setMissingRooms(result.missingRoomLabels ?? []);
      setMissingRoomNumbers(result.missingRoomNumbers ?? []);
    } catch (error) {
      console.error(error);
      alert((error as Error).message ?? "Validation failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMapRoom = async (label: string, roomId: string) => {
    try {
      await authorizedFetch("/api/admin/external-room-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "vikbooking",
          externalLabel: label,
          roomId,
        }),
      });
      setMissingRooms((prev) => prev.filter((value) => value !== label));
    } catch (error) {
      console.error(error);
      alert("Failed to save room mapping");
    }
  };

  const handleMapRoomNumber = async (value: string, roomId: string) => {
    try {
      await authorizedFetch("/api/admin/external-room-links/room-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "vikbooking",
          externalNumber: value,
          roomId,
        }),
      });
      setMissingRoomNumbers((prev) => prev.filter((number) => number !== value));
    } catch (error) {
      console.error(error);
      alert("Failed to save room number mapping");
    }
  };

  const pollJob = React.useCallback(
    async (jobId: string) => {
      const response = await authorizedFetch(
        `/api/admin/import/vikbooking/jobs/${jobId}`
      );
      if (!response.ok) {
        throw new Error("Unable to fetch job status");
      }
      const payload = (await response.json()) as JobStatusResponse;
      setJob(payload.job);
      setStatusCounts(payload.statusCounts ?? {});
      setRecentErrors(payload.errors ?? []);
      setSkipReport(payload.skippedEntries ?? []);
      return payload.job;
    },
    []
  );

  React.useEffect(() => {
    if (!job || job.status !== "completed") {
      return;
    }
    if (job.id !== activeImportJobId) {
      return;
    }
    if (job.id === lastCompletedJobId) {
      return;
    }
    toast.success("VikBooking import completed");
    setLastCompletedJobId(job.id);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setActiveImportJobId(null);
  }, [job, lastCompletedJobId, activeImportJobId]);

  const handleImport = async () => {
    if (!job) return;
    setActiveImportJobId(job.id);
    setIsImporting(true);
    try {
      const response = await authorizedFetch("/api/admin/import/vikbooking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload?.missingRoomNumbers)) {
          setMissingRoomNumbers(payload.missingRoomNumbers);
        }
        throw new Error(payload.message ?? "Import failed");
      }
      await pollJob(job.id);

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const intervalId = window.setInterval(async () => {
        try {
          const latest = await pollJob(job.id);
          if (!latest || latest.status === "completed" || latest.status === "failed") {
            clearInterval(intervalId);
            pollIntervalRef.current = null;
          }
        } catch (error) {
          console.error(error);
          clearInterval(intervalId);
          pollIntervalRef.current = null;
        }
      }, 2500);
      pollIntervalRef.current = intervalId;
    } catch (error) {
      console.error(error);
      setActiveImportJobId(null);
      alert((error as Error).message ?? "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const statusChip = (status: ImportJobEntryStatus, label: string) => {
    const count = statusCounts[status] ?? 0;
    return (
      <div className="flex items-center gap-2" key={status}>
        <Badge variant={status === "error" ? "destructive" : "secondary"}>
          {label}
        </Badge>
        <span className="text-sm text-muted-foreground">{count}</span>
      </div>
    );
  };

  const formatSkippedAt = React.useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }, []);

  const jobLocked = job ? ["running", "completed"].includes(job.status) : false;
  const canImport = Boolean(
    job &&
      !jobLocked &&
      !hasBlockingIssues &&
      missingRooms.length === 0 &&
      missingRoomNumbers.length === 0 &&
      job.totalRows > 0
  );
  const previewRowLabel =
    job && job.totalRows > previewRows.length
      ? `first ${previewRows.length} of ${job.totalRows} rows`
      : `${previewRows.length} rows`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 1 · Validate VikBooking CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full rounded-md border border-dashed border-muted-foreground/50 p-4 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Export bookings from VikBooking as CSV, then upload the file here.
              </p>
            </div>
            <Button onClick={handleValidate} disabled={!selectedFile || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" /> Validate CSV
                </>
              )}
            </Button>
          </div>
          {issues.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <h4 className="mb-2 font-semibold">Validation issues</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {issues.slice(0, 10).map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.field}`}>
                    <Badge
                      variant={issue.severity === "error" ? "destructive" : "secondary"}
                      className="mr-2"
                    >
                      {issue.severity}
                    </Badge>
                    Row {issue.rowNumber}: {issue.field} – {issue.message}
                  </li>
                ))}
                {issues.length > 10 && (
                  <li className="text-xs text-muted-foreground">
                    +{issues.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          )}
          {previewRows.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <h4 className="mb-2 font-semibold">Preview ({previewRowLabel})</h4>
              <div className="max-h-48 overflow-auto text-xs">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="px-2 py-1">Row</th>
                      <th className="px-2 py-1">Booking ID</th>
                      <th className="px-2 py-1">Room</th>
                      <th className="px-2 py-1">Guest</th>
                      <th className="px-2 py-1">Check-in</th>
                      <th className="px-2 py-1">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const rowNumber = Number(row.rowNumber ?? 0);
                      return (
                        <tr key={rowNumber} className="border-t">
                          <td className="px-2 py-1">{rowNumber}</td>
                          <td className="px-2 py-1">{String(row.bookingId ?? "")}</td>
                          <td className="px-2 py-1">{String(row.roomLabel ?? "")}</td>
                          <td className="px-2 py-1">
                            {String((row.guest as Record<string, unknown> | undefined)?.firstName ?? "")}
                          </td>
                          <td className="px-2 py-1">{String(row.checkInDate ?? "")}</td>
                          <td className="px-2 py-1">{String(row.totalAmount ?? "")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2 · Map rooms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h4 className="mb-2 font-semibold">Room label mappings</h4>
            {missingRooms.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                All room labels are mapped to Airvik rooms.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The following room labels need to be mapped to Airvik rooms:
                </p>
                {missingRooms.map((label) => (
                  <RoomMappingRow
                    key={label}
                    label={label}
                    rooms={rooms}
                    isRoomsLoading={isRoomsLoading}
                    onSave={handleMapRoom}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Room number mappings</h4>
            {missingRoomNumbers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                All room numbers are mapped to Airvik rooms.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The following VikBooking room numbers need to be mapped to specific Airvik rooms:
                </p>
                {missingRoomNumbers.map((roomNumber) => (
                  <RoomNumberMappingRow
                    key={roomNumber}
                    roomNumber={roomNumber}
                    rooms={rooms}
                    isRoomsLoading={isRoomsLoading}
                    onSave={handleMapRoomNumber}
                  />
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3 · Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleImport} disabled={!canImport || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...
                </>
              ) : (
                "Start Import"
              )}
            </Button>
            {job && (
              <span className="text-sm text-muted-foreground">
                {job.processedRows}/{job.totalRows} processed
              </span>
            )}
          </div>
          {job && (
            <div className="space-y-3">
              <Progress value={progress} />
              <div className="grid gap-3 md:grid-cols-2">
                {statusChip("pending", "Pending")}
                {statusChip("imported", "Imported")}
                {statusChip("skipped", "Skipped")}
                {statusChip("error", "Errors")}
              </div>
              {recentErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" /> Recent errors
                  </div>
                  <ul className="space-y-1">
                    {recentErrors.map((entry) => (
                      <li key={entry.id}>
                        Row {entry.rowNumber}: {entry.message ?? "Unknown error"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Skip report
            {skipReport.length > 0 ? ` (${skipReport.length} rows)` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skipReport.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No skipped rows recorded for this import job yet.
            </p>
          ) : (
            <div className="max-h-64 overflow-auto text-xs sm:text-sm">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-2 py-1">Row</th>
                    <th className="px-2 py-1">Booking ID</th>
                    <th className="px-2 py-1">Room</th>
                    <th className="px-2 py-1">Guest</th>
                    <th className="px-2 py-1">Reason</th>
                    <th className="px-2 py-1">Skipped at</th>
                  </tr>
                </thead>
                <tbody>
                  {skipReport.map((entry) => (
                    <tr key={entry.entryId} className="border-t">
                      <td className="px-2 py-1">{entry.rowNumber}</td>
                      <td className="px-2 py-1">{entry.bookingId}</td>
                      <td className="px-2 py-1">{entry.roomLabel ?? "—"}</td>
                      <td className="px-2 py-1">{entry.guestName ?? "—"}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-col gap-1">
                        <span>{entry.reason}</span>
                        {entry.reasonCode && (
                          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">
                            {entry.reasonCode}
                          </Badge>
                        )}
                      </div>
                    </td>
                      <td className="px-2 py-1">{formatSkippedAt(entry.skippedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type RoomMappingRowProps = {
  label: string;
  rooms: RoomOption[];
  isRoomsLoading: boolean;
  onSave: (label: string, roomId: string) => Promise<void>;
};

function RoomMappingRow({
  label,
  rooms,
  isRoomsLoading,
  onSave,
}: RoomMappingRowProps) {
  const [roomId, setRoomId] = React.useState<string>(rooms[0]?.id ?? "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!roomId && rooms[0]) {
      setRoomId(rooms[0].id);
    }
  }, [roomId, rooms]);

  const handleSave = async () => {
    if (!roomId) return;
    setIsSaving(true);
    try {
      await onSave(label, roomId);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Map to an Airvik room</p>
      </div>
      {rooms.length > 0 ? (
        <select
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          className="flex-1 rounded-md border border-input bg-background p-2 text-sm"
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Room {room.roomNumber}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-destructive">
          {isRoomsLoading
            ? "Loading room options..."
            : "No rooms are available. Add rooms before mapping."}
        </p>
      )}
      <Button onClick={handleSave} disabled={isSaving || !roomId}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
}

type RoomNumberMappingRowProps = {
  roomNumber: string;
  rooms: RoomOption[];
  isRoomsLoading: boolean;
  onSave: (roomNumber: string, roomId: string) => Promise<void>;
};

function RoomNumberMappingRow({
  roomNumber,
  rooms,
  isRoomsLoading,
  onSave,
}: RoomNumberMappingRowProps) {
  const [roomId, setRoomId] = React.useState<string>(rooms[0]?.id ?? "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!roomId && rooms[0]) {
      setRoomId(rooms[0].id);
    }
  }, [roomId, rooms]);

  const handleSave = async () => {
    if (!roomId) return;
    setIsSaving(true);
    try {
      await onSave(roomNumber, roomId);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center">
      <div className="flex-1">
        <p className="text-sm font-medium">Room #{roomNumber}</p>
        <p className="text-xs text-muted-foreground">Map to an Airvik room number</p>
      </div>
      {rooms.length > 0 ? (
        <select
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          className="flex-1 rounded-md border border-input bg-background p-2 text-sm"
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Room {room.roomNumber}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-destructive">
          {isRoomsLoading
            ? "Loading room options..."
            : "No rooms are available. Add rooms before mapping."}
        </p>
      )}
      <Button onClick={handleSave} disabled={isSaving || !roomId}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
}
