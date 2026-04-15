"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils";
import type { BookingSummary } from "@/data/types";

type ExportApiResponse = { arrivals: BookingSummary[]; dispatches: BookingSummary[] };

export function BookingsReport() {
  const { property } = useDataContext();
  const [arrivalDate, setArrivalDate] = React.useState<Date | undefined>(undefined);
  const [dispatchDate, setDispatchDate] = React.useState<Date | undefined>(undefined);
  const [arrivalOpen, setArrivalOpen] = React.useState(false);
  const [dispatchOpen, setDispatchOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const arrivalStr = arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null;
  const dispatchStr = dispatchDate ? format(dispatchDate, "yyyy-MM-dd") : null;
  const canGenerate = Boolean(arrivalStr && dispatchStr) && !isGenerating;

  const handleGenerate = async () => {
    if (!arrivalStr || !dispatchStr) return;

    setIsGenerating(true);
    try {
      const res = await authorizedFetch(
        `/api/admin/reports/bookings/export?arrival=${arrivalStr}&dispatch=${dispatchStr}`
      );

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Failed to fetch bookings");
      }

      const payload = (await res.json()) as ExportApiResponse;

      const { generateBookingsReport } = await import(
        "@/lib/reports/generate-bookings-report"
      );

      await generateBookingsReport({
        arrivals: payload.arrivals,
        dispatches: payload.dispatches,
        property,
        dates: { arrival: arrivalStr, dispatch: dispatchStr },
      });

      toast.success("Bookings report downloaded.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not generate report.";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="font-serif text-lg font-semibold">
              Bookings Report
            </CardTitle>
            <CardDescription>
              Pick an arrival date and a dispatch date. The PDF will show
              arrivals first, then dispatches — one section per page.
            </CardDescription>
          </div>

          {/* Two side-by-side single-date pickers */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Arrival Date picker */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Arrival Date
              </span>
              <Popover open={arrivalOpen} onOpenChange={setArrivalOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 w-full justify-start gap-3 rounded-xl border-border/40 bg-card/80 text-left font-medium shadow-sm sm:w-[200px]",
                      !arrivalDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {arrivalDate ? format(arrivalDate, "dd MMM yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto rounded-2xl border border-border/50 bg-card/95 p-4 shadow-lg backdrop-blur"
                  align="end"
                >
                  <Calendar
                    initialFocus
                    mode="single"
                    selected={arrivalDate}
                    onSelect={(date) => { setArrivalDate(date); setArrivalOpen(false); }}
                    classNames={{
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                      day_selected: "bg-primary/10 text-primary hover:bg-primary/20 focus:bg-primary/10",
                      day_today: "text-primary font-semibold",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Dispatch Date picker */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Dispatch Date
              </span>
              <Popover open={dispatchOpen} onOpenChange={setDispatchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 w-full justify-start gap-3 rounded-xl border-border/40 bg-card/80 text-left font-medium shadow-sm sm:w-[200px]",
                      !dispatchDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {dispatchDate ? format(dispatchDate, "dd MMM yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto rounded-2xl border border-border/50 bg-card/95 p-4 shadow-lg backdrop-blur"
                  align="end"
                >
                  <Calendar
                    initialFocus
                    mode="single"
                    selected={dispatchDate}
                    onSelect={(date) => { setDispatchDate(date); setDispatchOpen(false); }}
                    classNames={{
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                      day_selected: "bg-primary/10 text-primary hover:bg-primary/20 focus:bg-primary/10",
                      day_today: "text-primary font-semibold",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Button
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
          className="w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Generate PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
