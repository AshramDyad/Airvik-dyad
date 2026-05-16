"use client"

import * as React from "react"
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { toast } from "sonner"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GuestFormDialog } from "./guest-form-dialog"
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog"
import { useDataContext } from "@/context/data-context"
import { useAuthContext } from "@/context/auth-context"
import type { Guest } from "@/data/types"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export function GuestsDataTable<TData extends Guest, TValue>({
  columns,
  data,
  totalCount,
  isLoading,
  pageIndex,
  pageSize,
  searchQuery,
  onSearch,
  onPageChange,
  onPageSizeChange,
  onDataChanged,
}: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  totalCount: number | null
  isLoading: boolean
  pageIndex: number
  pageSize: number
  searchQuery: string
  onSearch: (query: string) => void
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
  onDataChanged?: () => void
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [guestToDelete, setGuestToDelete] = React.useState<TData | null>(null)
  const { deleteGuest } = useDataContext()
  const { hasPermission } = useAuthContext()
  const pageCount = Math.max(
    1,
    Math.ceil((totalCount ?? data.length) / pageSize),
  )
  const pagination = React.useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  )

  const handleDeleteConfirm = async () => {
    if (guestToDelete) {
      const success = await deleteGuest(guestToDelete.id);
      if (success) {
        toast.success(`Guest "${guestToDelete.firstName} ${guestToDelete.lastName}" has been deleted.`);
        onDataChanged?.();
      } else {
        toast.error("Failed to delete guest.", {
          description: "This guest has active reservations and cannot be deleted.",
        });
      }
      setGuestToDelete(null);
    }
  }

  const handlePaginationChange = React.useCallback(
    (
      updater:
        | PaginationState
        | ((old: PaginationState) => PaginationState),
    ) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater

      if (next.pageSize !== pageSize) {
        onPageSizeChange(next.pageSize)
        return
      }

      if (next.pageIndex !== pageIndex) {
        onPageChange(next.pageIndex)
      }
    },
    [onPageChange, onPageSizeChange, pageIndex, pageSize, pagination],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount,
    onPaginationChange: handlePaginationChange,
    state: {
      sorting,
      pagination,
    },
    meta: {
      openDeleteDialog: (guest: TData) => {
        setGuestToDelete(guest)
      },
      onItemSaved: () => {
        onDataChanged?.()
      },
      hasPermission,
    },
  })

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(event.target.value)
  }

  const currentPageCount = data.length
  const displayTotal = totalCount ?? currentPageCount
  const rangeStart = displayTotal === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd =
    displayTotal === 0
      ? 0
      : Math.min(pageIndex * pageSize + currentPageCount, displayTotal)

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search guests..."
            aria-label="Search guests by name"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full sm:w-[280px] lg:w-[340px]"
          />
          <div className="flex items-center justify-end gap-3">
            {hasPermission("create:guest") && (
              <GuestFormDialog onGuestSaved={onDataChanged}>
                <Button>Add Guest</Button>
              </GuestFormDialog>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
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
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading guests...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-4 px-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="text-sm text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {displayTotal} guest
            {displayTotal === 1 ? "" : "s"}.
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  onPageSizeChange(Number(value))
                }}
              >
                <SelectTrigger className="h-9 w-[90px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
              Page {pageIndex + 1} of {pageCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden h-9 w-9 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-9 w-9 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-9 w-9 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-9 w-9 p-0 lg:flex"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DeleteConfirmationDialog
        isOpen={!!guestToDelete}
        onOpenChange={(isOpen) => !isOpen && setGuestToDelete(null)}
        onConfirm={handleDeleteConfirm}
        itemName={guestToDelete ? `${guestToDelete.firstName} ${guestToDelete.lastName}` : "the guest"}
      />
    </>
  )
}
