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
import { RoomTypeFormDialog } from "./room-type-form-dialog"
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog"
import { useDataContext } from "@/context/data-context"
import { useAuthContext } from "@/context/auth-context"
import type { RoomType } from "@/data/types"
import type { AdminRoomTypeAmenityOption } from "./types"

export function RoomTypesDataTable<TData extends RoomType, TValue>({
  columns,
  data,
  amenities,
  onRefresh,
}: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  amenities: AdminRoomTypeAmenityOption[]
  onRefresh: () => void | Promise<void>
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [itemToDelete, setItemToDelete] = React.useState<TData | null>(null)
  const { deleteRoomType } = useDataContext()
  const { hasPermission } = useAuthContext()

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      const success = await deleteRoomType(itemToDelete.id, itemToDelete);
      if (success) {
        toast.success(`Room type "${itemToDelete.name}" has been deleted.`);
        await onRefresh();
      } else {
        toast.error("Failed to delete room type.", {
          description: "This room type is still in use by one or more rooms.",
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
      amenities,
      refreshData: onRefresh,
      hasPermission,
    },
  })

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end gap-3">
          {hasPermission("create:room_type") && (
            <RoomTypeFormDialog amenities={amenities} onSaved={onRefresh}>
              <Button>Add Room Type</Button>
            </RoomTypeFormDialog>
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
