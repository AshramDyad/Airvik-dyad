"use client";

import * as React from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { AlertCircle, CalendarIcon, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import {
  FEEDBACK_STATUS_BADGE_VARIANT,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPE_OPTIONS,
  ROOM_OR_FACILITY_OPTIONS,
} from "@/constants/feedback";
import type { Feedback, FeedbackStatus, FeedbackType } from "@/data/types";
import { authorizedFetch, getValidSession } from "@/lib/auth/client-session";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFeedbackQueryParams } from "@/hooks/use-feedback-query-params";
import { truncateText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PermissionGate } from "@/components/admin/permission-gate";

const CLEAR_FILTER_VALUE = "__all";

type FeedbackResponse = {
  data: Feedback[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export default function FeedbackPanel() {
  const { params: urlFilters, updateParams } = useFeedbackQueryParams();
  const [feedback, setFeedback] = React.useState<Feedback[]>([]);
  const [meta, setMeta] = React.useState<FeedbackResponse["meta"]>({
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [detailFeedback, setDetailFeedback] = React.useState<Feedback | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isUpdatingDetail, setIsUpdatingDetail] = React.useState(false);

  const [searchInput, setSearchInput] = React.useState(urlFilters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    if (urlFilters.startDate && urlFilters.endDate) {
      return {
        from: new Date(urlFilters.startDate),
        to: new Date(urlFilters.endDate),
      };
    }
    return undefined;
  });

  React.useEffect(() => {
    setSearchInput(urlFilters.search ?? "");
  }, [urlFilters.search]);

  React.useEffect(() => {
    const normalized = urlFilters.search ?? "";
    if (debouncedSearch === normalized) return;
    updateParams({ search: debouncedSearch || undefined });
  }, [debouncedSearch, updateParams, urlFilters.search]);

  React.useEffect(() => {
    if (urlFilters.startDate && urlFilters.endDate) {
      const nextRange: DateRange = {
        from: new Date(urlFilters.startDate),
        to: new Date(urlFilters.endDate),
      };
      setDateRange(nextRange);
    } else {
      setDateRange(undefined);
    }
  }, [urlFilters.startDate, urlFilters.endDate]);

  React.useEffect(() => {
    setPage(1);
  }, [
    urlFilters.type,
    urlFilters.status,
    urlFilters.search,
    urlFilters.startDate,
    urlFilters.endDate,
    urlFilters.roomOrFacility,
  ]);

  const fetchFeedback = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await getValidSession();
      if (!session) {
        throw new Error("Please sign in to view feedback.");
      }

      const query = new URLSearchParams();
      query.set("page", page.toString());
      query.set("pageSize", pageSize.toString());
      if (urlFilters.type) query.set("type", urlFilters.type);
      if (urlFilters.status) query.set("status", urlFilters.status);
      if (urlFilters.search) query.set("search", urlFilters.search);
      if (urlFilters.roomOrFacility) query.set("roomOrFacility", urlFilters.roomOrFacility);
      if (urlFilters.startDate) query.set("startDate", urlFilters.startDate);
      if (urlFilters.endDate) query.set("endDate", urlFilters.endDate);

      const response = await authorizedFetch(`/api/admin/feedback?${query.toString()}`);

      const result = (await response.json()) as FeedbackResponse & { message?: string };
      if (!response.ok) {
        throw new Error(result?.message ?? "Unable to load feedback");
      }

      setFeedback(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error("Failed to fetch feedback", error);
      setError(error instanceof Error ? error.message : "Unable to load feedback");
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    pageSize,
    urlFilters.type,
    urlFilters.status,
    urlFilters.search,
    urlFilters.roomOrFacility,
    urlFilters.startDate,
    urlFilters.endDate,
  ]);

  React.useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  const totalPages = Math.max(1, Math.ceil(meta.total / pageSize));
  const startEntry = meta.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endEntry = meta.total === 0 ? 0 : Math.min(page * pageSize, meta.total);

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleResetFilters = () => {
    updateParams({
      type: undefined,
      status: undefined,
      search: undefined,
      startDate: undefined,
      endDate: undefined,
      roomOrFacility: undefined,
    });
    setSearchInput("");
    setDateRange(undefined);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    updateParams({
      startDate: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
      endDate: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
    });
  };

  const handleUpdateFeedback = async (
    id: string,
    updates: { status?: FeedbackStatus; internalNote?: string }
  ) => {
    setIsUpdatingDetail(true);
    try {
      const response = await authorizedFetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message ?? "Unable to update feedback");
      }

      setFeedback((prev) =>
        prev.map((item) => (item.id === id ? result.data : item))
      );
      setDetailFeedback(result.data);
      toast.success("Feedback updated");
    } catch (error) {
      console.error("Failed to update feedback", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to update feedback"
      );
    } finally {
      setIsUpdatingDetail(false);
    }
  };

  return (
    <PermissionGate feature="feedback">
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.5em] text-primary">Feedback</p>
          <h1 className="text-2xl font-serif font-semibold">Visitor feedback & insights</h1>
          <p className="text-sm text-muted-foreground">
            Review suggestions, praise, complaints, and questions in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => void fetchFeedback()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPage(1);
              setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="w-32 rounded-full">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-2 block text-sm font-medium text-muted-foreground">Type</Label>
              <Select
                value={urlFilters.type ?? CLEAR_FILTER_VALUE}
                onValueChange={(value) =>
                  updateParams({
                    type: value === CLEAR_FILTER_VALUE ? undefined : (value as FeedbackType),
                  })
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLEAR_FILTER_VALUE}>All types</SelectItem>
                  {FEEDBACK_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium text-muted-foreground">Status</Label>
              <Select
                value={urlFilters.status ?? CLEAR_FILTER_VALUE}
                onValueChange={(value) =>
                  updateParams({
                    status: value === CLEAR_FILTER_VALUE ? undefined : (value as FeedbackStatus),
                  })
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLEAR_FILTER_VALUE}>All statuses</SelectItem>
                  {FEEDBACK_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium text-muted-foreground">
                Room / facility
              </Label>
              <Select
                value={urlFilters.roomOrFacility ?? CLEAR_FILTER_VALUE}
                onValueChange={(value) =>
                  updateParams({
                    roomOrFacility: value === CLEAR_FILTER_VALUE ? undefined : value,
                  })
                }
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLEAR_FILTER_VALUE}>All areas</SelectItem>
                  {ROOM_OR_FACILITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium text-muted-foreground">
                Date range
              </Label>
              <DateRangeFilterPicker value={dateRange} onChange={handleDateRangeChange} />
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or message"
                className="h-12 rounded-full pl-12"
              />
            </div>
            <Button variant="ghost" type="button" className="self-start text-sm" onClick={handleResetFilters}>
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-3xl border border-border/40 bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="min-w-[140px]">Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead>Room / Facility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Loading feedback...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-destructive">
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                  </div>
                </TableCell>
              </TableRow>
            ) : feedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Inbox className="h-6 w-6" />
                    No feedback found for the selected filters.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              feedback.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="font-medium text-foreground">
                        {format(new Date(item.createdAt), "dd MMM yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.createdAt), "hh:mm a")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {FEEDBACK_TYPE_LABEL[item.feedbackType]}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.isAnonymous ? "Anonymous" : item.name ?? "—"}</TableCell>
                  <TableCell>{truncateText(item.message, 60)}</TableCell>
                  <TableCell className="text-center">
                    {item.rating ? `${item.rating} / 5` : "—"}
                  </TableCell>
                  <TableCell>{item.roomOrFacility ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={FEEDBACK_STATUS_BADGE_VARIANT[item.status]}>
                      {FEEDBACK_STATUS_LABEL[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      className="text-sm"
                      onClick={() => {
                        setDetailFeedback(item);
                        setIsDetailOpen(true);
                      }}
                    >
                      View details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          Showing {startEntry}-{endEntry} of {meta.total} feedback entries
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1 || isLoading}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isLoading}
          >
            Next
          </Button>
        </div>
      </div>

      <FeedbackDetailDialog
        feedback={detailFeedback}
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) setDetailFeedback(null);
        }}
        onSave={handleUpdateFeedback}
        isSaving={isUpdatingDetail}
      />
    </div>
    </PermissionGate>
  );
}

type DateRangeFilterPickerProps = {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
};

function DateRangeFilterPicker({ value, onChange }: DateRangeFilterPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [months, setMonths] = React.useState(2);

  React.useEffect(() => {
    const handleResize = () => {
      setMonths(window.innerWidth < 768 ? 1 : 2);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formattedLabel = value?.from
    ? value.to
      ? `${format(value.from, "MMM d, yyyy")} → ${format(value.to, "MMM d, yyyy")}`
      : format(value.from, "MMM d, yyyy")
    : "Select dates";

  const handleSelect = (range: DateRange | undefined) => {
    onChange(range);
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left"
        >
          <span className={cn("text-sm", !value?.from && "text-muted-foreground")}>{formattedLabel}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-2xl border border-border/40 bg-card p-4 shadow-xl" align="start">
        <Calendar
          initialFocus
          mode="range"
          numberOfMonths={months}
          selected={value}
          onSelect={handleSelect}
        />
        <div className="mt-3 flex items-center justify-between text-sm">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleClear}
            disabled={!value?.from}
          >
            Clear
          </Button>
          {value?.from && (
            <span className="text-muted-foreground">
              {value.to
                ? `${format(value.from, "MMM d")} → ${format(value.to, "MMM d")}`
                : `${format(value.from, "MMM d, yyyy")} (start)`}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type FeedbackDetailDialogProps = {
  feedback: Feedback | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    updates: { status?: FeedbackStatus; internalNote?: string }
  ) => Promise<void>;
  isSaving: boolean;
};

function FeedbackDetailDialog({ feedback, open, onOpenChange, onSave, isSaving }: FeedbackDetailDialogProps) {
  const [status, setStatus] = React.useState<FeedbackStatus | undefined>(feedback?.status);
  const [note, setNote] = React.useState(feedback?.internalNote ?? "");

  React.useEffect(() => {
    setStatus(feedback?.status);
    setNote(feedback?.internalNote ?? "");
  }, [feedback]);

  if (!feedback) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Feedback details</DialogTitle>
            <DialogDescription>Feedback details will appear here.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSave = async () => {
    const normalizedNote = note.trim();
    const noteChanged = normalizedNote !== (feedback.internalNote ?? "");
    const statusChanged = Boolean(status && status !== feedback.status);

    if (!statusChanged && !noteChanged) {
      onOpenChange(false);
      return;
    }

    await onSave(feedback.id, {
      status: statusChanged && status ? status : undefined,
      internalNote: noteChanged ? normalizedNote : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl space-y-6">
        <DialogHeader>
          <DialogTitle>Feedback from {feedback.isAnonymous ? "Anonymous" : feedback.name ?? "Guest"}</DialogTitle>
          <DialogDescription>
            Submitted on {format(new Date(feedback.createdAt), "dd MMM yyyy, hh:mm a")}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/20 p-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{FEEDBACK_TYPE_LABEL[feedback.feedbackType]}</Badge>
            {feedback.roomOrFacility && <Badge variant="secondary">{feedback.roomOrFacility}</Badge>}
            {feedback.rating && (
              <Badge variant="default">Rating: {feedback.rating} / 5</Badge>
            )}
          </div>
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
            {feedback.message}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label className="text-sm text-muted-foreground">Name</Label>
            <p className="text-base font-medium">
              {feedback.isAnonymous ? "Anonymous" : feedback.name ?? "Not provided"}
            </p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Email</Label>
            <p className="text-base font-medium">{feedback.email ?? "Not provided"}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select value={status ?? feedback.status} onValueChange={(value) => setStatus(value as FeedbackStatus)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Created at</Label>
            <p className="mt-2 text-base font-medium">
              {format(new Date(feedback.createdAt), "dd MMM yyyy, hh:mm a")}
            </p>
          </div>
        </div>

        <div>
          <Label>Internal note</Label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a private note for the admin team"
            className="mt-2 min-h-[120px]"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
