"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/context/auth-context";
import { useReservationActivityLogs } from "@/hooks/use-reservation-activity-logs";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import {
  formatActivityActor,
  formatActivityOutcome,
  formatActivitySummary,
  formatActivityTimestamp,
} from "@/lib/activity/format";

interface ReservationActivityTimelineProps {
  reservationId: string;
}

const MANAGER_ROLES = new Set(["Administration", "Hotel Owner", "Hotel Manager"]);

export function ReservationActivityTimeline({
  reservationId,
}: ReservationActivityTimelineProps) {
  const { userRole } = useAuthContext();
  const canView = userRole?.name ? MANAGER_ROLES.has(userRole.name) : false;
  const { logs, isLoading, error } = useReservationActivityLogs(
    reservationId,
    canView
  );
  const formatCurrency = useCurrencyFormatter();

  if (!canView) {
    return null;
  }

  return (
    <div className="overflow-y-auto h-80">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Activity Log</CardTitle>
          <CardDescription>
            Track recent folio updates by staff role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading recent activity…
            </p>
          )}
          {!isLoading && error && (
            <p className="text-sm text-destructive">
              Unable to load activity right now.
            </p>
          )}
          {!isLoading && !error && logs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No activity recorded for this reservation yet.
            </p>
          )}
          {!isLoading && !error && logs.length > 0 && (
            <ol className="space-y-6">
              {logs.map((log) => (
                <li key={log.id} className="relative pl-6">
                  <span className="absolute left-0 top-2 block h-3 w-3 rounded-full border-2 border-primary" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {formatActivitySummary(log)}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {log.actorRole?.trim() ?? "Unknown role"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatActivityTimestamp(log.createdAt)} ·{" "}
                      {formatActivityActor(log)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatActivityOutcome(log, {
                        formatAmount: formatCurrency,
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
