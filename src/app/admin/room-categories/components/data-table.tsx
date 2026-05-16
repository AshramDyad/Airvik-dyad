"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
import { DataTablePagination } from "@/app/admin/reservations/components/data-table-pagination"
import { RoomCategoryFormDialog } from "./room-category-form-dialog"
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog"
import { useDataContext } from "@/context/data-context"
import { useAuthContext } from "@/context/auth-context"
import type { RoomCategory } from "@/data/types"

export function RoomCategoriesDataTable<TData extends RoomCategory, TValue>({
  columns,
  data,
  onRefresh,
}: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRefresh: () => void | Promise<void>
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [itemToDelete, setItemToDelete] = React.useState<TData | null>(null)
  const { deleteRoomCategory } = useDataContext()
  const { hasPermission } = useAuthContext()

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      const success = await deleteRoomCategory(itemToDelete.id, itemToDelete);
      if (success) {
        await onRefresh();
        toast.success(`Room category "${itemToDelete.name}" has been deleted.`);
      } else {
        toast.error("Failed to delete room category.", {
          description: "This room category is still in use by one or more room types.",
        });
      }
      setItemToDelete(null);
    }
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    meta: {
      openDeleteDialog: (item: TData) => {
        setItemToDelete(item)
      },
      refreshData: onRefresh,
      hasPermission,
    },
  })

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end gap-3">
          {hasPermission("create:room_category") && (
            <RoomCategoryFormDialog onSaved={onRefresh}>
              <Button>Add Room Category</Button>
            </RoomCategoryFormDialog>
          )}
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
              {table.getRowModel().rows?.length ? (
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
        <DataTablePagination table={table} />
      </div>
      <DeleteConfirmationDialog
        isOpen={!!itemToDelete}
        onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
        itemName={itemToDelete ? itemToDelete.name : "the item"}
      />
    </>
  )
}
