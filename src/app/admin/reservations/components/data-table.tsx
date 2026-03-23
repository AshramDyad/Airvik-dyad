"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
  Updater,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableToolbar } from "./data-table-toolbar"
import { DataTablePagination } from "./data-table-pagination"
import { CancelReservationDialog } from "./cancel-reservation-dialog"
import type { ReservationWithDetails } from "./columns"
import { GeistSpinner } from "@/components/shared/vercel-spinner"
interface DataTableProps {
  columns: ColumnDef<ReservationWithDetails, unknown>[]
  data: ReservationWithDetails[]
  onCancelReservation: (bookingId: string) => Promise<void> | void
  onCheckInReservation: (reservationId: string) => void
  onCheckOutReservation: (reservationId: string) => void
  onRefresh?: () => void
  isLoading?: boolean
  isRefreshing?: boolean
  isBackgroundLoading?: boolean
  totalCount?: number
  pagination?: {
    pageIndex: number;
    pageSize: number;
    onPageChange: (index: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  onSearch?: (query: string) => void;
}

export function DataTable({
  columns,
  data,
  onCancelReservation,
  onCheckInReservation,
  onCheckOutReservation,
  onRefresh,
  isLoading,
  isRefreshing,
  isBackgroundLoading,
  totalCount,
  pagination,
  onSearch,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "bookingDate", desc: true },
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const [localPagination, setLocalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Sync internal state if pagination is controlled
  React.useEffect(() => {
    if (pagination) {
      setLocalPagination({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      });
    }
  }, [pagination]);

  const handlePaginationChange = (updater: Updater<PaginationState>) => {
    const nextPagination = typeof updater === "function" ? updater(localPagination) : updater;
    setLocalPagination(nextPagination);
    if (pagination) {
      if (nextPagination.pageIndex !== localPagination.pageIndex) {
        pagination.onPageChange(nextPagination.pageIndex);
      }
      if (nextPagination.pageSize !== localPagination.pageSize) {
        pagination.onPageSizeChange(nextPagination.pageSize);
      }
    }
  };

  const handleGlobalFilterChange = (value: string) => {
    setGlobalFilter(value);
    onSearch?.(value);
  };

  const [reservationToCancel, setReservationToCancel] =
    React.useState<ReservationWithDetails | null>(null)

  const handleOpenCancelDialog = (reservation: ReservationWithDetails) => {
    setReservationToCancel(reservation);
  };

  const handleConfirmCancellation = () => {
    if (!reservationToCancel) {
      return
    }

    const bookingId = reservationToCancel.bookingId ?? reservationToCancel.id
    void onCancelReservation(bookingId)
    setReservationToCancel(null)
  };

  const handleGroupAction = (
    reservation: ReservationWithDetails,
    action: (id: string) => void
  ) => {
    const reservations = reservation.subRows?.length
      ? reservation.subRows
      : [reservation]

    reservations.forEach((item) => action(item.id))
  }

  const reservationGlobalFilter = React.useCallback(
    (row: Row<ReservationWithDetails>, _columnId: string, filterValue: string): boolean => {
      const term = String(filterValue ?? "").trim().toLowerCase()
      if (!term) return true

      const bookingIdRaw = String(
        row.original.bookingId ?? row.getValue("bookingId") ?? ""
      ).toLowerCase()
      const normalizedBookingId = bookingIdRaw
        .replace(/^booking-/i, "")
        .replace(/^vik-/i, "")
      const guestName = String(row.original.guestName ?? row.getValue("guestName") ?? "")
        .trim()
        .toLowerCase()

      const matchesCurrent =
        bookingIdRaw.includes(term) ||
        normalizedBookingId.includes(term) ||
        guestName.includes(term)

      if (matchesCurrent) return true

      if (row.subRows?.length) {
        return row.subRows.some((subRow) =>
          reservationGlobalFilter(subRow as Row<ReservationWithDetails>, _columnId, term)
        )
      }

      return false
    },
    []
  )

  const table = useReactTable<ReservationWithDetails>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: handlePaginationChange,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    globalFilterFn: reservationGlobalFilter,
    onGlobalFilterChange: handleGlobalFilterChange,
    manualPagination: true,
    manualFiltering: true,
    pageCount: totalCount ? Math.ceil(totalCount / localPagination.pageSize) : 0,
    autoResetAll: false,
    autoResetPageIndex: false,
    autoResetExpanded: false,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      expanded,
      pagination: localPagination,
    },
    meta: {
      checkInReservation: (res: ReservationWithDetails) =>
        handleGroupAction(res, onCheckInReservation),
      checkOutReservation: (res: ReservationWithDetails) =>
        handleGroupAction(res, onCheckOutReservation),
      openCancelDialog: handleOpenCancelDialog,
    }
  })

  const hasRows = table.getRowModel().rows.length > 0
  const showLoadingState = Boolean(isLoading) && !hasRows

  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const isDragging = React.useRef(false)
  const dragStartX = React.useRef(0)
  const dragStartY = React.useRef(0)
  const scrollLeftStart = React.useRef(0)
  const scrollTopStart = React.useRef(0)

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !scrollContainerRef.current) return
      scrollContainerRef.current.scrollLeft = scrollLeftStart.current - (dragStartX.current - e.clientX)
      scrollContainerRef.current.scrollTop = scrollTopStart.current - (dragStartY.current - e.clientY)
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.cursor = ""
        scrollContainerRef.current.style.userSelect = ""
      }
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, [role="button"]')) return
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    scrollLeftStart.current = scrollContainerRef.current?.scrollLeft ?? 0
    scrollTopStart.current = scrollContainerRef.current?.scrollTop ?? 0
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = "grabbing"
      scrollContainerRef.current.style.userSelect = "none"
    }
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-110px)]">
      <div className="shrink-0">
        <DataTableToolbar
          table={table}
          totalCount={totalCount}
          onRefresh={onRefresh}
          isRefreshing={Boolean(isRefreshing)}
          isLoading={Boolean(isLoading)}
        />
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto rounded-2xl border border-border/50 bg-card shadow-lg scrollbar-hide cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <Table className="relative min-w-max" baseWrapper={false}>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-0">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {showLoadingState ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-3 lg:py-60 text-muted-foreground">
                    <GeistSpinner size={36} label="Loading reservations" />
                    <p className="text-sm font-medium">Loading reservations...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : hasRows ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {isBackgroundLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="py-4 text-center text-sm text-muted-foreground"
                    >
                      Loading older reservations…
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="lg:py-60 text-center text-muted-foreground"
                >
                  No results founds.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="shrink-0">
        <DataTablePagination table={table} totalCount={totalCount} />
      </div>
      <CancelReservationDialog
        isOpen={!!reservationToCancel}
        onOpenChange={(isOpen) => !isOpen && setReservationToCancel(null)}
        onConfirm={handleConfirmCancellation}
      />
    </div>
  )
}
