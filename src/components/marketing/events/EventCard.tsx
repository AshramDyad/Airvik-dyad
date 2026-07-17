"use client";

import Image from "@/components/ui/cloudflare-image";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import type { EventBanner } from "@/data/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: EventBanner;
  className?: string;
}

export function EventCard({ event, className }: EventCardProps) {
  const isScheduled = !!event.startsAt;
  const now = new Date();
  const start = event.startsAt ? new Date(event.startsAt) : null;
  const isUpcoming = start && start > now;

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col h-full border-border/60 transition-colors",
        className
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        {isUpcoming && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-primary text-primary-foreground">
              Upcoming
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex-1 p-4 space-y-4">
        <h3 className="text-xl font-semibold leading-tight text-primary line-clamp-2 tracking-tight">
          {event.title}
        </h3>

        {isScheduled && (
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            {event.startsAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  {format(new Date(event.startsAt), "EEE, MMM d, yyyy")}
                </span>
              </div>
            )}
            {event.startsAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <span>{format(new Date(event.startsAt), "h:mm a")}</span>
                {event.endsAt && (
                  <span>- {format(new Date(event.endsAt), "h:mm a")}</span>
                )}
              </div>
            )}
          </div>
        )}

        {event.description && (
          <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
            {event.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
