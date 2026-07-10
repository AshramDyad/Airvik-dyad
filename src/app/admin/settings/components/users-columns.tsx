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
import type { User } from "@/data/types"
import { useDataContext } from "@/context/data-context"
import { useAuthContext } from "@/context/auth-context"
import { UserFormDialog } from "./user-form-dialog"
import { canManageRole, findRoleById } from "@/lib/roles"

function UserRoleCell({ roleId }: { roleId: string | null }) {
  const { roles } = useDataContext()

  if (!roleId) {
    return <span className="text-muted-foreground">No role</span>
  }

  const role = roles.find((item) => item.id === roleId)

  return <span>{role?.name || "Unknown"}</span>
}

function UserActionsCell({
  user,
  onDelete,
}: {
  user: User
  onDelete?: (user: User) => void
}) {
  const { hasPermission, userRole } = useAuthContext()
  const { roles } = useDataContext()
  const targetRole = findRoleById(roles, user.roleId)
  // Unassigned (no role) users sit below everyone: any actor that has a role can manage them.
  const isUnassigned = !user.roleId
  const canManage = canManageRole(userRole, targetRole) || (isUnassigned && !!userRole)

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
        {hasPermission("update:user") && canManage && (
          <UserFormDialog user={user}>
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Edit
            </DropdownMenuItem>
          </UserFormDialog>
        )}
        {hasPermission("delete:user") && canManage && (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => onDelete?.(user)}
          >
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "roleId",
    header: "Role",
    cell: ({ row }) => (
      <UserRoleCell roleId={row.getValue("roleId") as string | null} />
    ),
  },
  {
    id: "actions",
    cell: ({ row, table }) => (
      <UserActionsCell
        user={row.original}
        onDelete={table.options.meta?.openDeleteDialog}
      />
    ),
  },
]
