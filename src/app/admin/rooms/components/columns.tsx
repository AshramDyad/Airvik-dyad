"use client"

import Image from "@/components/ui/cloudflare-image"
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
import { Badge } from "@/components/ui/badge"
import type { Room } from "@/data/types"
import { RoomFormDialog } from "./room-form-dialog"
import { useDataContext } from "@/context/data-context"

function RoomImageCell({ room }: { room: Room }) {
  const { roomTypes } = useDataContext()
  const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId)
  const imageUrl =
    room.photos?.[0] ||
    roomType?.mainPhotoUrl ||
    roomType?.photos?.[0] ||
    "/room-placeholder.svg"

  return (
    <div className="relative h-10 w-16 overflow-hidden rounded-md">
      <Image
        src={imageUrl}
        alt={`Room ${room.roomNumber}`}
        fill
        className="object-cover"
        sizes="64px"
        unoptimized
      />
    </div>
  )
}

function RoomTypeCell({ roomTypeId }: { roomTypeId: string }) {
  const { roomTypes } = useDataContext()
  const roomType = roomTypes.find((rt) => rt.id === roomTypeId)

  return <span>{roomType?.name || "Unknown"}</span>
}

export const columns: ColumnDef<Room>[] = [
  {
    id: "image",
    header: "Image",
    cell: ({ row }) => <RoomImageCell room={row.original} />,
  },
  {
    accessorKey: "roomNumber",
    header: "Room Number",
  },
  {
    accessorKey: "roomTypeId",
    header: "Room Type",
    cell: ({ row }) => {
      const roomTypeId = row.getValue("roomTypeId") as string
      return <RoomTypeCell roomTypeId={roomTypeId} />
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <Badge variant="outline">{status}</Badge>
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const room = row.original
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
            {hasPermission?.("update:room") && (
                <RoomFormDialog room={room}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </RoomFormDialog>
            )}
            {hasPermission?.("delete:room") && (
                <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => table.options.meta?.openDeleteDialog?.(room)}
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
