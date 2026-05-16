"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { RoomCategory } from "@/data/types"
import { RoomCategoryFormDialog } from "./room-category-form-dialog"

export const columns: ColumnDef<RoomCategory>[] = [
  {
    accessorKey: "name",
    header: "Category Name",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const description = row.getValue("description") as string;
      return (
        <div className="max-w-md">
          <span className="text-sm text-muted-foreground">
            {description || <span className="italic">No description</span>}
          </span>
        </div>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const roomCategory = row.original
      const hasPermission = table.options.meta?.hasPermission;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {hasPermission?.("update:room_category") && (
                <RoomCategoryFormDialog
                  roomCategory={roomCategory}
                  onSaved={() => table.options.meta?.refreshData?.()}
                >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </RoomCategoryFormDialog>
            )}
            {hasPermission?.("delete:room_category") && (
                <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => table.options.meta?.openDeleteDialog?.(roomCategory)}
                >
                    Delete
                </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
