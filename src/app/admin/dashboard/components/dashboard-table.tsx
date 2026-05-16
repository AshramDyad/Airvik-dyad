import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DashboardSummaryRow } from "@/lib/dashboard/summary";
import { cn } from "@/lib/utils";

export type DashboardTableRow = DashboardSummaryRow;

interface DashboardTableProps {
  headers: string[];
  rows: DashboardTableRow[];
  emptyMessage: string;
  className?: string;
  scrollAreaClassName?: string;
}

export function DashboardTable({
  headers,
  rows,
  emptyMessage,
  className,
  scrollAreaClassName,
}: DashboardTableProps) {
  return (
    <div className={cn("flex h-full min-w-0 flex-col", className)}>
      <div
        className={cn(
          "relative w-full min-w-0 max-w-full overflow-auto max-h-[320px] sm:max-h-[360px] md:max-h-[420px] lg:max-h-[min(60vh,560px)] [-webkit-overflow-scrolling:touch]",
          scrollAreaClassName
        )}
      >
        <Table className="table-auto w-max min-w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              {headers.map((header, index) => (
                <TableHead
                  key={header}
                  className={cn(
                    "h-11 uppercase tracking-wide text-xs sm:text-sm font-semibold px-4 py-3",
                    index === 0 && "",
                    index === headers.length - 1 && "text-right"
                  )}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "border-b border-border/40 transition-colors hover:bg-primary/5 dark:hover:bg-primary/10",
                    rowIndex % 2 === 0 ? "bg-card" : "bg-muted/20"
                  )}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="whitespace-nowrap font-medium">{row.guestName}</div>
                      {row.guestEmail && (
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          {row.guestEmail}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{row.roomNumber}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap font-medium"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={headers.length}
                  className="h-24 border-none text-center"
                >
                  <div className="flex items-center justify-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
