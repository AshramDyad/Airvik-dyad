"use client"

import { ColumnDef, type CellContext } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { RatePlan } from "@/data/types"
import { RatePlanFormDialog } from "./rate-plan-form-dialog"
import { useCurrencyFormatter } from "@/hooks/use-currency";

function PriceCell({ row }: CellContext<RatePlan, unknown>) {
  const formatCurrency = useCurrencyFormatter();
  const amount = Number(row.getValue("price")) || 0;
  return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
}

export const columns: ColumnDef<RatePlan>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "price",
    header: () => <div className="text-right">Price (per night)</div>,
    cell: PriceCell,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const ratePlan = row.original
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
            {hasPermission?.("update:rate_plan") && (
                <RatePlanFormDialog
                  ratePlan={ratePlan}
                  onSaved={() => table.options.meta?.refreshData?.()}
                >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </RatePlanFormDialog>
            )}
            {hasPermission?.("delete:rate_plan") && (
                <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => table.options.meta?.openDeleteDialog?.(ratePlan)}
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
