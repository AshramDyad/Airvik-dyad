"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Users, Minus, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReservationDateRangePicker } from "@/components/reservations/date-range-picker";

const enhancedSearchSchema = z
  .object({
    dateRange: z.object({
      from: z.date({ required_error: "Check-in date is required." }),
      to: z.date({ required_error: "Check-out date is required." }),
    }),
    roomOccupancies: z
      .array(
        z.object({
          adults: z.coerce.number().min(0, "Adults cannot be negative."),
          children: z.coerce.number().min(0, "Children cannot be negative."),
        })
      )
      .min(1, "At least one room is required."),
  })
  .superRefine((data, ctx) => {
    const totalRooms = data.roomOccupancies.length;
    const totals = data.roomOccupancies.reduce(
      (acc, room) => {
        acc.adults += room.adults;
        acc.children += room.children;
        return acc;
      },
      { adults: 0, children: 0 }
    );

    if (totalRooms < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roomOccupancies"],
        message: "Select at least one room.",
      });
    }

    if (totals.adults + totals.children < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roomOccupancies"],
        message: "Add at least one guest (adult or child).",
      });
    }
  });


export type EnhancedBookingSearchFormValues = z.infer<typeof enhancedSearchSchema>;

type ClosureDateRange = { startDate: string; endDate: string; roomTypeId?: string };

interface BookingWidgetProps {
  onSearch: (values: EnhancedBookingSearchFormValues) => void;
  isLoading?: boolean;
  blockedRanges?: ClosureDateRange[];
}

export function BookingWidget({ onSearch, isLoading = false, blockedRanges = [] }: BookingWidgetProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [guestsPopoverOpen, setGuestsPopoverOpen] = React.useState(false);
  const hasInitializedRoomState = React.useRef(false);
  
  // Simple state for UI display
  const [totalAdults, setTotalAdults] = React.useState(0);
  const [totalChildren, setTotalChildren] = React.useState(0);
  const [totalRooms, setTotalRooms] = React.useState(0);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const popoverOffset = isMobile ? 12 : 40;

  const form = useForm<EnhancedBookingSearchFormValues>({
    resolver: zodResolver(enhancedSearchSchema),
    defaultValues: {
      dateRange: {
        from: undefined,
        to: undefined,
      },
      roomOccupancies: [],
    },
  });

  const roomOccupancies = form.watch("roomOccupancies");
  const dateRange = form.watch("dateRange");
  const hasDatesSelected = Boolean(dateRange?.from && dateRange?.to);
  const totalGuests = totalAdults + totalChildren;
  const hasValidGuestSelection = totalRooms > 0 && totalGuests > 0;
  const canSubmit = hasDatesSelected && hasValidGuestSelection;
  
  // Helper function to distribute guests across rooms
  const updateRoomOccupancies = React.useCallback(
    (adults: number, children: number, rooms: number) => {
      if (rooms < 1) {
        form.setValue("roomOccupancies", []);
        return;
      }

      const adultsPerRoom = Math.floor(adults / rooms);
      const extraAdults = adults % rooms;
      const childrenPerRoom = Math.floor(children / rooms);
      const extraChildren = children % rooms;
      
      const newRoomOccupancies = Array.from({ length: rooms }, (_, index) => ({
        adults: adultsPerRoom + (index < extraAdults ? 1 : 0),
        children: childrenPerRoom + (index < extraChildren ? 1 : 0),
      }));
      
      form.setValue("roomOccupancies", newRoomOccupancies);
    },
    [form]
  );
  
  // Update roomOccupancies when simple values change
  React.useEffect(() => {
    updateRoomOccupancies(totalAdults, totalChildren, totalRooms);
  }, [totalAdults, totalChildren, totalRooms, updateRoomOccupancies]);
  
  // Initialize simple values from roomOccupancies
  React.useEffect(() => {
    if (hasInitializedRoomState.current) return;
    if (roomOccupancies.length > 0) {
      const guests = roomOccupancies.reduce((sum, room) => sum + room.adults, 0);
      const children = roomOccupancies.reduce((sum, room) => sum + room.children, 0);
      const rooms = roomOccupancies.length;
      setTotalAdults(guests);
      setTotalChildren(children);
      setTotalRooms(rooms);
      hasInitializedRoomState.current = true;
    }
  }, [roomOccupancies]);

  return (
    <Card className="w-full bg-white max-w-5xl mx-auto backdrop-blur-md border-border/20 shadow-md">
      <div className="absolute inset-0 pointer-events-none" />
      <CardContent className="relative p-8">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSearch)}
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[2fr_1.5fr_auto] gap-6 items-start"
          >
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ReservationDateRangePicker
                      value={field.value}
                      onChange={field.onChange}
                      blockedRanges={blockedRanges}
                    />
                  </FormControl>
                  <FormMessage className="pl-2" />
                </FormItem>
              )}
            />
            {/* Guests & Rooms Configuration */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="roomOccupancies"
                render={() => (
                  <FormItem>
                    <Popover open={guestsPopoverOpen} onOpenChange={setGuestsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className="w-full h-14 justify-start text-left font-normal text-base border hover:border-primary/50 transition-all duration-300 bg-background/50"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <Users className="mr-3 h-5 w-5 text-primary" />
                                <div className="flex flex-col items-start">
                                  <span className="text-xs text-muted-foreground">Guests & Rooms</span>
                                  {hasValidGuestSelection ? (
                                    <span className="text-sm font-medium">
                                      {totalAdults} {totalAdults === 1 ? "Guest" : "Guests"}
                                      {totalChildren > 0
                                        ? `, ${totalChildren} ${
                                            totalChildren === 1 ? "Child" : "Children"
                                          }`
                                        : ""}
                                      , {totalRooms} {totalRooms === 1 ? "Room" : "Rooms"}
                                    </span>
                                  ) : (
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Select guests & rooms
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        side="bottom"
                        align="center"
                        sideOffset={popoverOffset}
                        className="w-full max-w-[min(100vw-1.5rem,360px)] md:max-w-360 border border-border/40 rounded-2xl bg-white shadow-xl px-5 py-5"
                      >
                        <div className="space-y-5">
                            {/* Rooms */}
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-foreground">Rooms</div>
                              <div className="text-sm text-muted-foreground">Number of rooms</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  const next = Math.max(0, totalRooms - 1);
                                  if (next !== totalRooms) {
                                    setTotalRooms(next);
                                  }
                                }}
                                disabled={totalRooms <= 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">{totalRooms}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  const next = totalRooms + 1;
                                  setTotalRooms(next);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Adults */}
                          <div className="flex items-center justify-between gap-5">
                            <div>
                              <div className="font-medium text-foreground">Adults</div>
                              <div className="text-sm text-muted-foreground">Ages 13 or above</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  const next = Math.max(0, totalAdults - 1);
                                  if (next !== totalAdults) {
                                    setTotalAdults(next);
                                  }
                                }}
                                disabled={totalAdults <= 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">{totalAdults}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  const next = totalAdults + 1;
                                  setTotalAdults(next);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Children */}
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-foreground">Children</div>
                              <div className="text-sm text-muted-foreground">Ages 2-12</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  const next = Math.max(0, totalChildren - 1);
                                  if (next !== totalChildren) {
                                    setTotalChildren(next);
                                  }
                                }}
                                disabled={totalChildren <= 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">{totalChildren}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => {
                                  const next = totalChildren + 1;
                                  setTotalChildren(next);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                        
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage className="pl-2" />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full hover:bg-primary-hover" 
              size="lg"
              disabled={isLoading || !canSubmit}
            >
              <Search className="h-5 w-5 mr-2" />
              {isLoading ? "Searching..." : "Search Availability"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}