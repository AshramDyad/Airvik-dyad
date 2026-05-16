"use client";

import * as React from "react";
import { format, eachDayOfInterval, parseISO, isSameDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useReportReservations } from "@/hooks/use-report-reservations";
import { cn } from "@/lib/utils";
import { useCurrencyFormatter } from "@/hooks/use-currency";

export function RevenueReport() {
  const currencyFormatter = useCurrencyFormatter();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const { reservations } = useReportReservations({
    from: date?.from,
    to: date?.to,
  });

  const chartData = React.useMemo(() => {
    if (!date?.from || !date?.to) return [];

    const days = eachDayOfInterval({ start: date.from, end: date.to });

    return days.map((day) => {
      const dailyRevenue = reservations
        .filter(
          (res) =>
            res.status === "Checked-out" &&
            isSameDay(parseISO(res.checkOutDate), day)
        )
        .reduce((sum, res) => sum + res.totalAmount, 0);

      return {
        date: format(day, "MMM d"),
        revenue: dailyRevenue,
      };
    });
  }, [date, reservations]);

  const formatCurrency = React.useCallback(
    (value: number) => currencyFormatter(value, { notation: "compact" }),
    [currencyFormatter]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="font-serif text-lg font-semibold">Revenue Report</CardTitle>
            <CardDescription>
              Total revenue from checked-out reservations for the selected period.
            </CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-11 w-full justify-start gap-3 rounded-xl border-border/40 bg-card/80 text-left font-medium shadow-sm sm:w-[320px]",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <span className="truncate">
                      {format(date.from, "LLL dd, y")} – {format(date.to, "LLL dd, y")}
                    </span>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-2xl border border-border/50 bg-card/95 p-4 shadow-lg backdrop-blur" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ChartContainer config={{}} className="h-[350px] w-full rounded-2xl border border-border/40 bg-card/80 p-4">
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickFormatter={formatCurrency} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
              cursor={{ fill: "hsl(var(--accent))" }}
            />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
