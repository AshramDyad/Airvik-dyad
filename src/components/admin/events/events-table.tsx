"use client";

import Link from "next/link";
import Image from "@/components/ui/cloudflare-image";
import { format } from "date-fns";
import { Pencil, Trash, AlertCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { EventBanner } from "@/data/types";
import { deleteEvent, toggleEventBanner } from "@/lib/server/events";
import { cn } from "@/lib/utils";

interface EventsTableProps {
  events: EventBanner[];
}

export function EventsTable({ events }: EventsTableProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteEvent(id);
        toast.success("Event deleted");
      } catch (error) {
        toast.error("Failed to delete event");
        console.error(error);
      }
    });
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    // Optimistic UI could be handled via useOptimistic but simple transition is fine for now
    startTransition(async () => {
      try {
        await toggleEventBanner(id, newStatus);
        if (newStatus) {
            toast.success("Event banner activated (others disabled)");
        } else {
            toast.success("Event banner deactivated");
        }
      } catch (error) {
        toast.error("Failed to update status");
        console.error(error);
      }
    });
  };

  const formatDate = (d?: string) => {
    if (!d) return "—";
    return format(new Date(d), "MMM d, yyyy h:mm a");
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Image</TableHead>
            <TableHead className="w-[300px]">Title & Status</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Active Banner</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No events found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => {
                const isScheduled = !!(event.startsAt || event.endsAt);
                const now = new Date();
                const start = event.startsAt ? new Date(event.startsAt) : null;
                const end = event.endsAt ? new Date(event.endsAt) : null;
                const isUpcoming = start && start > now;
                const isPast = end && end < now;
                
                return (
              <TableRow key={event.id}>
                <TableCell>
                  <div className="relative h-12 w-20 overflow-hidden rounded-md border bg-muted">
                    {event.imageUrl ? (
                      <Image
                        src={event.imageUrl}
                        alt={event.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No Img
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{event.title}</span>
                    <div className="flex items-center gap-2">
                         {isUpcoming && <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">Upcoming</Badge>}
                         {isPast && <Badge variant="secondary" className="text-xs">Past</Badge>}
                         {!isUpcoming && !isPast && isScheduled && <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700">Running</Badge>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <span className="w-12 text-xs uppercase font-medium">From:</span>
                        <span>{formatDate(event.startsAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-12 text-xs uppercase font-medium">To:</span>
                        <span>{formatDate(event.endsAt)}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <Switch 
                            checked={event.isActive}
                            onCheckedChange={() => handleToggle(event.id, event.isActive)}
                            disabled={isPending}
                        />
                        <span className={cn("text-sm", event.isActive ? "text-primary font-medium" : "text-muted-foreground")}>
                            {event.isActive ? "On" : "Off"}
                        </span>
                        {event.isActive && (isUpcoming || isPast) && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <AlertCircle className="h-4 w-4 text-amber-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>This banner is active but outside its scheduled dates.<br/>It might not show if logic strictly enforces dates.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/events/${event.id}`}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                            </Link>
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(event.id)}
                            disabled={isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                        </Button>
                    </div>
                </TableCell>
              </TableRow>
            )})
          )}
        </TableBody>
      </Table>
    </div>
  );
}
