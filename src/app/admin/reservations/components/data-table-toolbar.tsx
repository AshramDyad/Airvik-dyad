"use client"

import * as React from "react"
import { Table } from "@tanstack/react-table"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ReservationStatus } from "@/data/types"
import { getReservationStatusLabel } from "@/lib/reservations/status"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

// The three statuses the team filters by every day. Kept minimal on purpose.
const STATUS_CHIPS: { value: ReservationStatus; label: string }[] = [
  { value: "Room Hold", label: getReservationStatusLabel("Room Hold") },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Checked-in", label: "Checked-in" },
]

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  totalCount?: number
  onRefresh?: () => void
  isRefreshing?: boolean
  isLoading?: boolean
  activeStatus?: ReservationStatus | null
  onStatusChange?: (status: ReservationStatus | null) => void
  statusCounts?: Partial<Record<ReservationStatus, number>>
}

export function DataTableToolbar<TData>({
  table,
  totalCount,
  onRefresh,
  isRefreshing,
  isLoading,
  activeStatus,
  onStatusChange,
  statusCounts,
}: DataTableToolbarProps<TData>) {
  const searchValue = String(table.getState().globalFilter ?? "")
  const fallbackCount = table.getCoreRowModel().rows.length
  const badgeCount = typeof totalCount === "number" ? totalCount : fallbackCount

  // Keep the input instant while debouncing the actual search so we fire one
  // refetch after typing settles instead of one per keystroke.
  const [inputValue, setInputValue] = React.useState(searchValue)
  const debouncedValue = useDebouncedValue(inputValue, 300)
  // Tracks the last value we synced with the table, so we can tell our own
  // debounced writes apart from an external reset (e.g. a programmatic clear).
  const lastSyncedValue = React.useRef(searchValue)

  React.useEffect(() => {
    if (debouncedValue === lastSyncedValue.current) return
    lastSyncedValue.current = debouncedValue
    table.setGlobalFilter(debouncedValue)
    table.getColumn("guestName")?.setFilterValue(undefined)
    table.getColumn("bookingId")?.setFilterValue(undefined)
  }, [debouncedValue, table])

  React.useEffect(() => {
    // Adopt external changes to the filter without clobbering in-progress typing.
    if (searchValue !== lastSyncedValue.current) {
      lastSyncedValue.current = searchValue
      setInputValue(searchValue)
    }
  }, [searchValue])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }

  const handleChipClick = (status: ReservationStatus) => {
    // Click the active chip again to clear the filter.
    onStatusChange?.(activeStatus === status ? null : status)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search guest or booking ID..."
            aria-label="Search by guest name or booking ID"
            value={inputValue}
            onChange={handleSearchChange}
            className="w-full sm:w-[280px] lg:w-[340px]"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {badgeCount} booking{badgeCount === 1 ? "" : "s"}
          </span>
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={Boolean(isLoading || isRefreshing)}
            >
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
          ) : null}
          <DataTableViewOptions table={table} />
          <Button asChild>
            <Link href="/admin/reservations/new">Add Reservation</Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((chip) => {
          const isActive = activeStatus === chip.value
          const count = statusCounts?.[chip.value] ?? 0
          return (
            <Button
              key={chip.value}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              aria-pressed={isActive}
              onClick={() => handleChipClick(chip.value)}
              className="h-8 gap-2"
            >
              {chip.label}
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className={cn(
                  "px-1.5 py-0 text-xs font-semibold",
                  !isActive && "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </Badge>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
