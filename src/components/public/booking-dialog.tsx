"use client";

import * as React from "react";
import NextImage from "@/components/ui/cloudflare-image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Users, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getRoomTypeImageUrl } from "@/lib/room-type-images";
import type { EnhancedBookingSearchFormValues } from "./booking-widget";
import { useAvailabilitySearch } from "@/hooks/use-availability-search";
import type { RoomOccupancy } from "@/data/types";

// Legacy type for backward compatibility in this dialog
type BookingSearchFormValues = {
  dateRange: {
    from?: Date;
    to?: Date;
  } | undefined;
  guests: number;
  children: number;
  rooms: number;
};

const searchSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: "Check-in date is required." }),
    to: z.date({ required_error: "Check-out date is required." }),
  }),
  guests: z.coerce.number().min(1, "At least one adult is required."),
  children: z.coerce.number().min(0),
  rooms: z.coerce.number().min(1, "At least one room is required."),
});

interface BookingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialSearchValues?: BookingSearchFormValues;
}

export function BookingDialog({
  isOpen,
  onOpenChange,
  initialSearchValues,
}: BookingDialogProps) {
  const router = useRouter();
  const { search, availableRoomTypes, isLoading, setAvailableRoomTypes } =
    useAvailabilitySearch();

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: initialSearchValues || {
      guests: 2,
      children: 0,
      rooms: 1,
    },
  });

  const runSearch = React.useCallback(
    (values: BookingSearchFormValues) => {
      // Don't search if dateRange is undefined or missing required properties
      if (!values.dateRange || !values.dateRange.from || !values.dateRange.to) return;
      
      // Transform legacy values to RoomOccupancy format
      const roomOccupancies: RoomOccupancy[] = Array.from({ length: values.rooms }, () => ({
        adults: Math.floor(values.guests / values.rooms) + (values.guests % values.rooms > 0 ? 1 : 0),
        children: Math.floor(values.children / values.rooms)
      }));
      
      // Ensure we have at least one room with correct guest distribution
      if (roomOccupancies.length > 0) {
        roomOccupancies[0].adults = values.guests - (roomOccupancies.length - 1) * Math.floor(values.guests / roomOccupancies.length);
        roomOccupancies[0].children = values.children - (roomOccupancies.length - 1) * Math.floor(values.children / roomOccupancies.length);
      }
      
      // Cast to DateRange type as we've verified required properties
      search(values.dateRange as { from: Date; to: Date }, roomOccupancies);
    },
    [search]
  );

  React.useEffect(() => {
    if (isOpen && initialSearchValues) {
      form.reset(initialSearchValues);
      runSearch(initialSearchValues);
    }
    if (!isOpen) {
      setAvailableRoomTypes(null);
      form.reset({ guests: 2, children: 0, rooms: 1, dateRange: undefined });
    }
  }, [isOpen, initialSearchValues, runSearch, form, setAvailableRoomTypes]);

  const onSubmit = (values: z.infer<typeof searchSchema>) => {
    runSearch(values);
  };

  const handleBookNow = (roomTypeId: string) => {
    const { dateRange, guests, children, rooms } = form.getValues();
    if (!dateRange?.from || !dateRange?.to) return;

    const query = new URLSearchParams({
      from: format(dateRange.from, "yyyy-MM-dd"),
      to: format(dateRange.to, "yyyy-MM-dd"),
      guests: guests.toString(),
      children: children.toString(),
      rooms: rooms.toString(),
    });
    router.push(`/rooms/${roomTypeId}?${query.toString()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book Your Stay</DialogTitle>
          <DialogDescription>
            Select your dates to check for available rooms.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="p-1">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="dateRange"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-in / Check-out</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value?.from && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value?.from ? (
                                field.value.to ? (
                                  <>
                                    {format(field.value.from, "LLL dd, y")} -{" "}
                                    {format(field.value.to, "LLL dd, y")}
                                  </>
                                ) : (
                                  format(field.value.from, "LLL dd, y")
                                )
                              ) : (
                                <span>Pick a date range</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={field.value?.from}
                            selected={{
                              from: field.value?.from,
                              to: field.value?.to,
                            }}
                            onSelect={field.onChange}
                            numberOfMonths={2}
                            disabled={{ before: new Date() }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Rooms</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Adults</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="children"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Children</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Searching..." : "Check Availability"}
                </Button>
              </form>
            </Form>
          </div>
          <div className="border-l -ml-3 pl-6">
            <h3 className="font-semibold mb-2 text-center">
              Available Rooms
            </h3>
            <ScrollArea className="h-80">
              <div className="space-y-4 pr-4">
                {isLoading && (
                  <div className="flex items-center justify-center h-full">
                    <Search className="h-8 w-8 animate-pulse text-muted-foreground" />
                  </div>
                )}
                {availableRoomTypes && availableRoomTypes.length > 0 && (
                  availableRoomTypes.map((rt) => (
                    <div key={rt.id}>
                      <div className="flex gap-4">
                        <div className="w-24 h-16 relative rounded-md overflow-hidden flex-shrink-0">
                          <NextImage
                            src={getRoomTypeImageUrl(rt)}
                            alt={rt.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{rt.name}</h4>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            <span>Up to {rt.maxOccupancy} guests</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleBookNow(rt.id)}
                        >
                          Book
                        </Button>
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))
                )}
                {availableRoomTypes && availableRoomTypes.length === 0 && (
                  <div className="text-center text-muted-foreground pt-12">
                    <p>No rooms available for the selected dates.</p>
                  </div>
                )}
                {!availableRoomTypes && !isLoading && (
                  <div className="text-center text-muted-foreground pt-12">
                    <p>Please select dates to see availability.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
