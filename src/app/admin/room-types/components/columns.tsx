"use client"

import Image from "next/image"
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
import type { RoomType } from "@/data/types"
import { RoomTypeFormDialog } from "./room-type-form-dialog"
import type { AdminRoomTypeAmenityOption } from "./types"

function RoomTypeImageCell({ roomType }: { roomType: RoomType }) {
  const imageUrl =
    roomType.mainPhotoUrl || roomType.photos?.[0] || "/room-placeholder.svg"

  return (
    <div className="relative h-10 w-16 overflow-hidden rounded-md">
      <Image
        src={imageUrl}
        alt={roomType.name}
        fill
        className="object-cover"
        sizes="64px"
        unoptimized
      />
    </div>
  )
}

function RoomTypeAmenitiesCell({
  amenityIds,
  amenities,
}: {
  amenityIds: string[]
  amenities: AdminRoomTypeAmenityOption[]
}) {
  if (!amenityIds?.length) {
    return <span className="text-muted-foreground">N/A</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {amenityIds.map((id) => {
        const amenity = amenities.find((item) => item.id === id)
        return (
          <Badge key={id} variant="secondary">
            {amenity?.name || id}
          </Badge>
        )
      })}
    </div>
  )
}

export const columns: ColumnDef<RoomType>[] = [
  {
    id: "image",
    header: "Image",
    cell: ({ row }) => <RoomTypeImageCell roomType={row.original} />,
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "maxOccupancy",
    header: "Max Occupancy",
  },
  {
    accessorKey: "bedTypes",
    header: "Bed Types",
    cell: ({ row }) => {
        const bedTypes = row.getValue("bedTypes") as string[];
        return <span>{bedTypes.join(", ")}</span>
    }
  },
  {
    accessorKey: "amenities",
    header: "Amenities",
    cell: ({ row, table }) => {
      const amenityIds = row.getValue("amenities") as string[]
      return (
        <RoomTypeAmenitiesCell
          amenityIds={amenityIds}
          amenities={table.options.meta?.amenities ?? []}
        />
      )
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const roomType = row.original
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
            {hasPermission?.("update:room_type") && (
                <RoomTypeFormDialog
                  roomType={roomType}
                  amenities={table.options.meta?.amenities ?? []}
                  onSaved={() => table.options.meta?.refreshData?.()}
                >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </RoomTypeFormDialog>
            )}
            {hasPermission?.("delete:room_type") && (
                <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => table.options.meta?.openDeleteDialog?.(roomType)}
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
