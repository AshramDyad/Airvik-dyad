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
import { RatePlanFormDialog } from "./rate-plan-form-dialog"
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog"
import { useDataContext } from "@/context/data-context"
import { useAuthContext } from "@/context/auth-context"
import type { RatePlan } from "@/data/types"

export function RatePlansDataTable<TData extends RatePlan, TValue>({
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
  const { deleteRatePlan } = useDataContext()
  const { hasPermission } = useAuthContext()

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      const success = await deleteRatePlan(itemToDelete.id, itemToDelete);
      if (success) {
        toast.success(`Rate plan "${itemToDelete.name}" has been deleted.`);
        await onRefresh();
      } else {
        toast.error("Failed to delete rate plan.", {
          description: "This rate plan is in use by one or more reservations.",
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
          {hasPermission("create:rate_plan") && (
            <RatePlanFormDialog onSaved={onRefresh}>
              <Button>Add Rate Plan</Button>
            </RatePlanFormDialog>
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
