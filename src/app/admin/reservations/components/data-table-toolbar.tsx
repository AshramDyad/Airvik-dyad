"use client"

import * as React from "react"
import { Table } from "@tanstack/react-table"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { statuses } from "./columns"
import { Button } from "@/components/ui/button"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  totalCount?: number
  onRefresh?: () => void
  isRefreshing?: boolean
  isLoading?: boolean
}

export function DataTableToolbar<TData>({
  table,
  totalCount,
  onRefresh,
  isRefreshing,
  isLoading,
}: DataTableToolbarProps<TData>) {
  const searchValue = String(table.getState().globalFilter ?? "")
  const fallbackCount = table.getCoreRowModel().rows.length
  const badgeCount = typeof totalCount === "number" ? totalCount : fallbackCount

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    table.setGlobalFilter(value)
    table.getColumn("guestName")?.setFilterValue(undefined)
    table.getColumn("bookingId")?.setFilterValue(undefined)
  }
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search guest or booking ID..."
          aria-label="Search by guest name or booking ID"
          value={searchValue}
          onChange={handleSearchChange}
          className="w-full sm:w-[280px] lg:w-[340px]"
        />
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statuses}
          />
        )}
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
          <Link href="/admin/reservations/new" prefetch={false}>Add Reservation</Link>
        </Button>
      </div>
    </div>
  )
}
