"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PermissionGate } from "@/components/admin/permission-gate";
import { useAuthContext } from "@/context/auth-context";
import { useAdminActivityLogs } from "@/hooks/use-admin-activity-logs";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import {
  formatActivityActor,
  formatActivityOutcome,
  formatActivityResource,
  formatActivitySummary,
  formatActivityTimestamp,
} from "@/lib/activity/format";

const ROLE_OPTIONS = [
  "all",
  "Hotel Owner",
  "Hotel Manager",
  "Receptionist",
  "Housekeeper",
  "Guest",
] as const;

const LIMIT_OPTIONS = [10, 25, 50, 100, 200] as const;

export function ActivityPanel() {
  const { hasFeatureAccess } = useAuthContext();
  const canView = hasFeatureAccess("activity");
  const {
    logs,
    filters,
    setFilters,
    page,
    totalPages,
    canPrevious,
    canNext,
    setPage,
    isLoading,
    error,
    refetch,
  } = useAdminActivityLogs({ limit: 10 }, { enabled: canView });
  const formatCurrency = useCurrencyFormatter();
  const handleTextFilterChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target;
    setFilters({ [name]: value } as Partial<typeof filters>);
  };

  const handleDateFilterChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target;
    if (name === "from" || name === "to") {
      setFilters({ [name]: value || undefined } as Partial<typeof filters>);
    }
  };

  const tableHasRows = !isLoading && !error && logs.length > 0;

  const noAccessCard = (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>
          Only hotel owners and managers can view this page.
        </CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <PermissionGate feature="activity" fallback={noAccessCard}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity Filters</CardTitle>
            <CardDescription>
              Match the table columns to narrow down the activity feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Time</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="from"
                  name="from"
                  type="date"
                  value={filters.from ?? ""}
                  onChange={handleDateFilterChange}
                />
                <Input
                  id="to"
                  name="to"
                  type="date"
                  value={filters.to ?? ""}
                  onChange={handleDateFilterChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actorRole">Actor (Role)</Label>
              <div className="grid gap-2">
                <Select
                  value={filters.actorRole}
                  onValueChange={(value) => setFilters({ actorRole: value })}
                >
                  <SelectTrigger id="actorRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === "all" ? "All roles" : role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Input
                id="action"
                name="action"
                placeholder="e.g. RESERVATION_ADD"
                value={filters.action}
                onChange={handleTextFilterChange}
              />
            </div>
            <div className="flex items-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setFilters({
                    actorRole: "all",
                    actorName: "",
                    action: "",
                    resource: "",
                    summary: "",
                    outcome: "",
                    from: undefined,
                    to: undefined,
                  })
                }
              >
                Reset
              </Button>
              <Button type="button" onClick={refetch} disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Showing {logs.length} entr{logs.length === 1 ? "y" : "ies"} on page {page} of {totalPages}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead>Actor (Role)</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Loading activity…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && error && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-destructive"
                      >
                        {error.message}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !error && logs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No activity found for the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    !error &&
                    logs.length > 0 &&
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatActivityTimestamp(log.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {formatActivityActor(log)}
                        </TableCell>
                        <TableCell className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                          {log.action}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {formatActivityResource(log)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatActivitySummary(log)}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {formatActivityOutcome(log, {
                            formatAmount: (amount) => formatCurrency(amount),
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {tableHasRows && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Label
                    htmlFor="rowsPerPage"
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Rows per page
                  </Label>
                  <Select
                    value={String(filters.limit)}
                    onValueChange={(value) =>
                      setFilters({ limit: Number(value) })
                    }
                  >
                    <SelectTrigger id="rowsPerPage" className="h-9 w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIMIT_OPTIONS.map((limit) => (
                        <SelectItem key={limit} value={String(limit)}>
                          {limit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div>
                  {totalPages > 1 ? (
                    <Pagination className="w-auto">
                      <PaginationContent className="gap-2">
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            aria-disabled={!canPrevious || isLoading}
                            className={`px-4 py-2 text-sm hover:bg-primary/10 ${
                              !canPrevious || isLoading
                                ? "pointer-events-none opacity-50"
                                : ""
                            }`}
                            onClick={(event) => {
                              event.preventDefault();
                              if (canPrevious && !isLoading) {
                                setPage((prev) => prev - 1);
                              }
                            }}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            aria-disabled={!canNext || isLoading}
                            className={`px-4 py-2 text-sm hover:bg-primary/10 ${
                              !canNext || isLoading
                                ? "pointer-events-none opacity-50"
                                : ""
                            }`}
                            onClick={(event) => {
                              event.preventDefault();
                              if (canNext && !isLoading) {
                                setPage((prev) => prev + 1);
                              }
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
