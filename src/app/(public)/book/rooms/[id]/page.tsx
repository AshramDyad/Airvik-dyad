"use client";

import * as React from "react";
import {
  notFound,
  useParams,
  useSearchParams,
  useRouter,
} from "next/navigation";
import type { DateRange } from "react-day-picker";
import {
  Calendar as CalendarIcon,
  MapPin,
  Star,
  Share2,
  MoreHorizontal,
  ArrowLeft,
  Clock,
  ParkingCircle,
  Info,
  ChevronDown,
  Building,
  Users,
  Wifi,
  Shield,
  CheckCircle,
  Baby,
  Minus,
  Plus,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  format,
  formatISO,
  eachDayOfInterval,
  parseISO,
  parse,
  differenceInDays,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useDataContext } from "@/context/data-context";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/shared/icon";
import type { IconName } from "@/lib/icons";
import { RoomTypeCard } from "@/components/public/room-type-card";
import { RoomDetailsSkeleton } from "@/components/public/room-details-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ShareDialog } from "@/components/public/share-dialog";
import { calculateRoomPricing } from "@/lib/pricing-calculator";
import { PricingBreakdown } from "@/components/ui/pricing-breakdown";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { isBookableRoom } from "@/lib/rooms";

const bookingSchema = z.object({
  dateRange: z
    .object({
      from: z.date({ required_error: "Check-in date is required." }),
      to: z.date({ required_error: "Check-out date is required." }),
    })
    .refine((data) => data.from < data.to, {
      message: "Check-out date must be after check-in date.",
      path: ["to"],
    }),
  guests: z.coerce.number().min(1, "At least one adult is required."),
  children: z.coerce.number().min(0),
  rooms: z.coerce.number().min(1, "At least one room is required."),
  specialRequests: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const amenityIcons: Record<string, IconName> = {
  "Free Wi-Fi": "Wifi",
  "Air Conditioning": "AirVent",
  "Flat-screen TV": "Tv",
  "Mini-bar": "Refrigerator",
  "Ocean View": "Waves",
  "Private Balcony": "GalleryVertical",
  "Ensuite Bathroom": "Bath",
  "Room Service": "ConciergeBell",
  "Lounge chairs": "Armchair",
  "Washing Machine": "WashingMachine",
  Refrigerator: "Refrigerator",
  Bedroom: "Bed",
  Oven: "CookingPot",
  Wifi: "Wifi",
  Bathroom: "Bath",
  "Air Conditioner": "AirVent",
  "Swimming Pool": "Waves",
};

export default function RoomDetailsPage() {
  const params = useParams<{ id: string }>();
  const roomTypeIdFromParams = React.useMemo(() => {
    if (!params) return "";
    const value = params.id;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params]);
  const searchParams = useSearchParams();
  const safeSearchParams = React.useMemo(() => searchParams ?? new URLSearchParams(), [searchParams]);
  const router = useRouter();
  const {
    reservations,
    roomTypes,
    amenities: allAmenities,
    rooms,
    ratePlans,
    seasonalPrices,
    propertyClosures,
    isLoading,
    property,
  } = useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const visibleRoomTypes = React.useMemo(
    () => roomTypes.filter((rt) => rt.isVisible !== false),
    [roomTypes]
  );
  const roomType = visibleRoomTypes.find((rt) => rt.id === roomTypeIdFromParams);
  const capacitySchema = React.useMemo(() => {
    if (!roomType) {
      return bookingSchema;
    }

    return bookingSchema.superRefine((data, ctx) => {
      const perRoomCapacity = roomType.maxOccupancy;
      const perRoomChildCapacity =
        typeof roomType.maxChildren === "number"
          ? roomType.maxChildren
          : roomType.maxOccupancy;
      const totalCapacity = data.rooms * perRoomCapacity;
      const totalChildCapacity = data.rooms * perRoomChildCapacity;

      if (data.guests + data.children > totalCapacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Select up to ${totalCapacity} total guest${
            totalCapacity === 1 ? "" : "s"
          } across ${data.rooms} room${data.rooms === 1 ? "" : "s"}.`,
          path: ["guests"],
        });
      }

      if (data.children > totalChildCapacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `You can include up to ${totalChildCapacity} child${
            totalChildCapacity === 1 ? "" : "ren"
          } across ${data.rooms} room${data.rooms === 1 ? "" : "s"}.`,
          path: ["children"],
        });
      }
    });
  }, [roomType]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] =
    React.useState(false);
  const [isDatesPopoverOpen, setIsDatesPopoverOpen] = React.useState(false);
  const [isGuestsPopoverOpen, setIsGuestsPopoverOpen] = React.useState(false);
  const [isRoomsPopoverOpen, setIsRoomsPopoverOpen] = React.useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState("");

  const standardRatePlan =
    ratePlans.find((rp) => rp.name === "Standard Rate") || ratePlans[0];
  const taxConfig = React.useMemo(
    () => ({
      enabled: Boolean(property.tax_enabled),
      percentage: property.tax_percentage ?? 0,
    }),
    [property.tax_enabled, property.tax_percentage]
  );

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(capacitySchema),
    defaultValues: {
      guests: safeSearchParams.get("guests")
        ? Number(safeSearchParams.get("guests"))
        : 2,
      children: safeSearchParams.get("children")
        ? Number(safeSearchParams.get("children"))
        : 0,
      rooms: safeSearchParams.get("rooms") ? Number(safeSearchParams.get("rooms")) : 1,
      dateRange: safeSearchParams.get("from") && safeSearchParams.get("to")
        ? {
            from: parse(safeSearchParams.get("from")!, "yyyy-MM-dd", new Date()),
            to: parse(safeSearchParams.get("to")!, "yyyy-MM-dd", new Date()),
          }
        : undefined,
      specialRequests: "",
    },
  });

  const dateRange = form.watch("dateRange");
  const guestsCount = form.watch("guests");
  const childrenCount = form.watch("children");
  const roomsCount = form.watch("rooms");
  const totalCapacity = roomType ? roomsCount * roomType.maxOccupancy : 0;
  const perRoomChildLimit = roomType
    ? roomType.maxChildren ?? roomType.maxOccupancy
    : 0;
  const totalChildCapacity = roomsCount * perRoomChildLimit;
  const maxConfiguredChildCapacity =
    roomType?.maxChildren !== undefined
      ? roomsCount * roomType.maxChildren
      : undefined;
  const maxChildrenAllowed = Math.max(
    0,
    Math.min(totalChildCapacity, totalCapacity - guestsCount)
  );
  const isAtTotalCapacity =
    totalCapacity > 0 && guestsCount + childrenCount >= totalCapacity;
  const isAtChildCapacity =
    typeof maxConfiguredChildCapacity === "number" &&
    childrenCount >= maxConfiguredChildCapacity;
  const capacityHelperMessage = React.useMemo(() => {
    if (!roomType) {
      return "";
    }

    if (roomsCount === 1) {
      const childSnippet =
        roomType.maxChildren !== undefined
          ? `, including up to ${roomType.maxChildren} child${
              roomType.maxChildren === 1 ? "" : "ren"
            }`
          : "";
      return `This room fits up to ${roomType.maxOccupancy} guest${
        roomType.maxOccupancy === 1 ? "" : "s"
      }${childSnippet}.`;
    }

    const childSnippet =
      roomType.maxChildren !== undefined
        ? `, including up to ${roomsCount * roomType.maxChildren} child${
            roomsCount * roomType.maxChildren === 1 ? "" : "ren"
          } total.`
        : ".";

    return `Your ${roomsCount} room selection fits up to ${totalCapacity} guest${
      totalCapacity === 1 ? "" : "s"
    } (${roomType.maxOccupancy} per room)${childSnippet}`;
  }, [roomType, roomsCount, totalCapacity]);
  const roomsParam = safeSearchParams.get("rooms");
  const parsedRequestedRooms = roomsParam ? Number(roomsParam) : undefined;
  const requestedRoomsLimit =
    parsedRequestedRooms && Number.isFinite(parsedRequestedRooms) && parsedRequestedRooms > 0
      ? Math.floor(parsedRequestedRooms)
      : undefined;

  // Get current URL for sharing (client-side only)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  const photosToShow = React.useMemo(() => {
    if (!roomType || !roomType.photos || roomType.photos.length === 0) {
      return [
        "/room-placeholder.svg",
        "/room-placeholder.svg",
        "/room-placeholder.svg",
      ];
    }
    const sortedPhotos = [...roomType.photos];
    if (roomType.mainPhotoUrl) {
      const mainIndex = sortedPhotos.indexOf(roomType.mainPhotoUrl);
      if (mainIndex > -1) {
        sortedPhotos.splice(mainIndex, 1);
        sortedPhotos.unshift(roomType.mainPhotoUrl);
      }
    }
    const paddedPhotos = [...sortedPhotos];
    while (paddedPhotos.length < 3) {
      paddedPhotos.push("/room-placeholder.svg");
    }
    return paddedPhotos;
  }, [roomType]);

  const roomAvailability = React.useMemo(() => {
    if (!roomType) {
      return {
        disabledDates: [{ before: new Date() }],
        minAvailableRoomsForStay: undefined,
        totalBookableRooms: 0,
      };
    }

    const roomsOfType = rooms.filter(
      (room) => room.roomTypeId === roomType.id && isBookableRoom(room)
    );
    const numberOfRooms = roomsOfType.length;
    if (numberOfRooms === 0) {
      return {
        disabledDates: [{ before: new Date() }],
        minAvailableRoomsForStay: undefined,
        totalBookableRooms: 0,
      };
    }

    const bookingsCountByDate: Record<string, number> = {};
    const relevantReservations = reservations.filter(
      (res) =>
        roomsOfType.some((room) => room.id === res.roomId) &&
        res.status !== "Cancelled"
    );

    relevantReservations.forEach((res) => {
      const interval = {
        start: parseISO(res.checkInDate),
        end: parseISO(res.checkOutDate),
      };
      const bookingDays = eachDayOfInterval(interval);
      if (bookingDays.length > 0) bookingDays.pop();

      bookingDays.forEach((day) => {
        const dayString = formatISO(day, { representation: "date" });
        bookingsCountByDate[dayString] =
          (bookingsCountByDate[dayString] || 0) + 1;
      });
    });

    const fullyBookedDates = Object.entries(bookingsCountByDate)
      .filter(([, count]) => count >= numberOfRooms)
      .map(([dateString]) => parseISO(dateString));

    let minAvailableRoomsForStay: number | undefined;
    if (dateRange?.from && dateRange?.to) {
      const stayInterval = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to,
      });
      if (stayInterval.length > 0) stayInterval.pop();
      if (stayInterval.length > 0) {
        let minAvailable = numberOfRooms;
        stayInterval.forEach((day) => {
          const dayString = formatISO(day, { representation: "date" });
          const bookedCount = bookingsCountByDate[dayString] || 0;
          const availableRoomsCount = numberOfRooms - bookedCount;
          if (availableRoomsCount < minAvailable) {
            minAvailable = availableRoomsCount;
          }
        });
        minAvailableRoomsForStay = Math.max(0, minAvailable);
      }
    }

    // Convert property closures to react-day-picker date range matchers
    const closureMatchers = propertyClosures
      .filter((c) => !c.roomTypeId || c.roomTypeId === roomType.id)
      .map((c) => ({ from: parseISO(c.startDate), to: parseISO(c.endDate) }));

    return {
      disabledDates: [{ before: new Date() }, ...fullyBookedDates, ...closureMatchers],
      minAvailableRoomsForStay,
      totalBookableRooms: numberOfRooms,
    };
  }, [roomType, rooms, reservations, dateRange, propertyClosures]);

  const { disabledDates, minAvailableRoomsForStay, totalBookableRooms } = roomAvailability;

  const cappedByInventory = totalBookableRooms > 0
    ? Math.min(requestedRoomsLimit ?? totalBookableRooms, totalBookableRooms)
    : requestedRoomsLimit ?? 0;

  const computedMaxRooms =
    minAvailableRoomsForStay !== undefined
      ? Math.min(cappedByInventory, minAvailableRoomsForStay)
      : cappedByInventory;

  const maxSelectableRooms = Math.max(0, computedMaxRooms);
  const roomsUnavailableForDates = Boolean(
    dateRange?.from &&
      dateRange?.to &&
      maxSelectableRooms === 0 &&
      totalBookableRooms > 0
  );
  const isRoomsCappedByRequest = Boolean(
    requestedRoomsLimit &&
      maxSelectableRooms > 0 &&
      maxSelectableRooms < requestedRoomsLimit
  );

  React.useEffect(() => {
    if (maxSelectableRooms > 0 && roomsCount > maxSelectableRooms) {
      form.setValue("rooms", maxSelectableRooms);
    }
  }, [form, roomsCount, maxSelectableRooms]);

  React.useEffect(() => {
    if (!roomType) {
      return;
    }

    const maxAdults = Math.max(1, totalCapacity - childrenCount);
    if (guestsCount > maxAdults) {
      form.setValue("guests", maxAdults, { shouldValidate: true });
    }

    if (childrenCount > maxChildrenAllowed) {
      form.setValue("children", maxChildrenAllowed, { shouldValidate: true });
    }
  }, [
    form,
    roomType,
    totalCapacity,
    totalChildCapacity,
    guestsCount,
    childrenCount,
    maxChildrenAllowed,
  ]);

  // Calculate pricing based on selected dates
  const nightCount =
    dateRange?.from && dateRange?.to
      ? differenceInDays(dateRange.to, dateRange.from)
      : 0;

  // Use shared pricing calculation
  const checkInDate = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : undefined;
  const pricing = React.useMemo(() => {
    return calculateRoomPricing({
      roomType,
      ratePlan: standardRatePlan,
      nights: nightCount,
      rooms: roomsCount,
      taxConfig,
      seasonalPrices,
      checkInDate,
    });
  }, [roomType, standardRatePlan, nightCount, roomsCount, taxConfig, seasonalPrices, checkInDate]);

  // Show loading skeleton while data is loading
  if (isLoading) {
    return <RoomDetailsSkeleton />;
  }

  if (!roomType) {
    notFound();
  }

  const relatedRoomTypes = visibleRoomTypes.filter((rt) => rt.id !== roomType.id);

  function onSubmit(values: BookingFormValues) {
    const totalGuests = values.guests + values.children;
    const query = new URLSearchParams();

    const roomsRequested = Math.max(1, Number(values.rooms) || 1);
    for (let index = 0; index < roomsRequested; index += 1) {
      query.append("roomTypeId", roomType!.id);
    }

    query.set("from", formatISO(values.dateRange.from, { representation: "date" }));
    query.set("to", formatISO(values.dateRange.to, { representation: "date" }));
    query.set("guests", totalGuests.toString());
    query.set("children", values.children.toString());
    query.set("rooms", values.rooms.toString());

    if (values.specialRequests) {
      query.set("specialRequests", values.specialRequests);
    }

    router.push(`/book/review?${query.toString()}`);
  }

  const description = roomType.description;
  const truncatedDescription =
    description.length > 200
      ? description.substring(0, 200) + "..."
      : description;



  const newLocal = "container mx-auto p-4 py-6";
  return (
    <div className="min-h-screen">
      {/* Hero Summary Section */}
      <div className={newLocal}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 text-sm font-medium">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
              {roomType.name}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsShareDialogOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {/* <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button> */}
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          {/* Desktop Grid Gallery */}
          <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 gap-2 h-[80vh] max-h-[500px] overflow-hidden">
            <div className="md:col-span-2 md:row-span-2 relative">
              <img
                src={photosToShow[0]}
                alt={`${roomType.name} photo 1`}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="md:col-span-2 relative">
              <img
                src={photosToShow[1]}
                alt={`${roomType.name} photo 2`}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="md:col-span-2 relative">
              <img
                src={photosToShow[2]}
                alt={`${roomType.name} photo 3`}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden">
            <div className="relative group">
              <Carousel className="w-full">
                <CarouselContent>
                  {photosToShow.map((photo, index) => (
                    <CarouselItem key={index}>
                      <div className="aspect-video relative rounded-lg overflow-hidden">
                        <img
                          src={photo}
                          alt={`${roomType.name} photo ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-x-12">
          <div className="lg:col-span-3 space-y-8">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
                {roomType.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>Rishikesh, Uttarakhand</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-700">
                    Up to {roomType.maxOccupancy} guests
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold text-gray-900">4.8</span>
                <span className="text-gray-500">(127 reviews)</span>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {isDescriptionExpanded ? description : truncatedDescription}
              {description.length > 50 && (
                <Button
                  variant="link"
                  className="p-0 h-auto ml-2"
                  onClick={() =>
                    setIsDescriptionExpanded(!isDescriptionExpanded)
                  }
                >
                  {isDescriptionExpanded ? "Read Less" : "Read More"}
                </Button>
              )}
            </p>

            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                Amenities
              </h2>
              <div className="space-y-6">
                {/* Essential Amenities */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
                    Essentials
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {roomType.amenities
                      .filter((amenityId) => {
                        const amenity = allAmenities.find(
                          (a) => a.id === amenityId
                        );
                        return (
                          amenity &&
                          [
                            "Free Wi-Fi",
                            "Wifi",
                            "Air Conditioning",
                            "Air Conditioner",
                            "Ensuite Bathroom",
                            "Bathroom",
                          ].includes(amenity.name)
                        );
                      })
                      .map((amenityId) => {
                        const amenity = allAmenities.find(
                          (a) => a.id === amenityId
                        );
                        if (!amenity) return null;
                        return (
                          <div
                            key={amenity.id}
                            className="flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon
                                name={
                                  amenityIcons[amenity.name] || amenity.icon
                                }
                                className="h-5 w-5 text-primary"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {amenity.name}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Comfort Amenities */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
                    Comfort
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {roomType.amenities
                      .filter((amenityId) => {
                        const amenity = allAmenities.find(
                          (a) => a.id === amenityId
                        );
                        return (
                          amenity &&
                          ![
                            "Free Wi-Fi",
                            "Wifi",
                            "Air Conditioning",
                            "Air Conditioner",
                            "Ensuite Bathroom",
                            "Bathroom",
                          ].includes(amenity.name)
                        );
                      })
                      .map((amenityId) => {
                        const amenity = allAmenities.find(
                          (a) => a.id === amenityId
                        );
                        if (!amenity) return null;
                        return (
                          <div
                            key={amenity.id}
                            className="flex items-center gap-3"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon
                                name={
                                  amenityIcons[amenity.name] || amenity.icon
                                }
                                className="h-5 w-5 text-primary"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {amenity.name}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Ashram Rules
              </h2>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="checkin" className="border-b">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="text-left font-medium">
                        Check-in & Check-out
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3 pl-8">
                      <div className="text-sm">
                        <span className="text-gray-600">Check-in:</span>
                        <span className="ml-2 font-medium">12:00 PM</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Check-out:</span>
                        <span className="ml-2 font-medium">
                          Before 10:00 AM
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Late check-out may be available upon request
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="age" className="border-b">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <Info className="h-5 w-5 text-primary" />
                      <span className="text-left font-medium">
                        Age & ID Requirements
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3 pl-8 text-sm text-gray-600">
                      <p>Minimum age to check-in: 17 years</p>
                      <p>
                        Valid government-issued photo ID required at check-in
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="parking" className="border-b">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <ParkingCircle className="h-5 w-5 text-primary" />
                      <span className="text-left font-medium">
                        Parking & Transportation
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3 pl-8 text-sm text-gray-600">
                      <p>Free parking available (5 spaces)</p>
                      <p>First-come, first-served basis</p>
                      <p>Valet service not available</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* booking section */}
          <div
            className="lg:col-span-2 mt-8 lg:mt-0 shadow-lg rounded-xl border border-gray-100"
            id="booking-form"
          >
            <Card className="sticky top-32 bg-white border-0 overflow-hidden p-6">
              <div className="p-6 bg-orange-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">from</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(pricing.nightlyRate, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-gray-600">/night</span>
                </div>
              </div>
              <div className="mt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <FormField
                        control={form.control}
                        name="dateRange"
                        render={({ field }) => {
                          const handleDateSelect = (range: DateRange | undefined) => {
                            field.onChange(range);
                            if (range?.from && range?.to) {
                              setIsDatesPopoverOpen(false);
                            }
                          };

                          return (
                            <FormItem>
                              <Popover
                                open={isDatesPopoverOpen}
                                onOpenChange={setIsDatesPopoverOpen}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal border-0 border-b rounded-none p-4 h-auto hover:bg-transparent",
                                      !field.value?.from &&
                                        "text-muted-foreground"
                                    )}
                                  >
                                    <div className="flex items-center w-full">
                                      <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                      <div className="flex-1">
                                        <div className="text-xs text-gray-600 mb-1">
                                          Check-in → Check-out
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {field.value?.from && field.value?.to
                                            ? `${format(
                                                field.value.from,
                                                "MMM dd"
                                              )} - ${format(
                                                field.value.to,
                                                "MMM dd, yyyy"
                                              )}`
                                            : "Select dates"}
                                        </div>
                                      </div>
                                    </div>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="bottom"
                                  align="center"
                                  sideOffset={12}
                                  className="w-full max-w-[min(100vw-1.5rem,640px)] md:max-w-none border border-border/40 rounded-2xl bg-white shadow-xl px-4 py-4 md:px-5 md:py-4 max-h-[80vh] overflow-y-auto"
                                >
                                  <div className="px-5 py-4 border-b border-border/30">
                                    <div className="flex gap-4 md:flex-row md:items-start md:justify-between text-sm">
                                      <div className="flex-1">
                                        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                                          Check-in
                                        </span>
                                        <span className="mt-1 block text-base font-medium text-foreground">
                                          {field.value?.from
                                            ? format(
                                                field.value.from,
                                                "EEE, MMM d"
                                              )
                                            : "Select date"}
                                        </span>
                                      </div>
                                      <div className="flex-1 text-right">
                                        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                                          Check-out
                                        </span>
                                        <span className="mt-1 block text-base font-medium text-foreground">
                                          {field.value?.to
                                            ? format(
                                                field.value.to,
                                                "EEE, MMM d"
                                              )
                                            : "Select date"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={field.value?.from}
                                    selected={{
                                      from: field.value?.from,
                                      to: field.value?.to,
                                    }}
                                    onSelect={handleDateSelect}
                                    numberOfMonths={2}
                                    disabled={disabledDates}
                                    showOutsideDays
                                    className="pt-3 pb-4 md:pt-4 md:pb-5 px-1 md:px-5"
                                    classNames={{
                                      months:
                                        "flex flex-col gap-6 sm:flex-row sm:gap-6",
                                      month: "space-y-4",
                                      caption:
                                        "flex items-center justify-between",
                                      caption_label:
                                        "text-base font-semibold text-foreground",
                                      nav: "flex items-center gap-2",
                                      nav_button:
                                        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                      nav_button_previous: "order-1",
                                      nav_button_next: "order-2",
                                      table: "w-full border-collapse",
                                      head_row: "flex w-full",
                                      head_cell:
                                        "flex h-11 w-11 items-center justify-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70",
                                      row: "mt-1 flex w-full",
                                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                                      day: "inline-flex h-11 w-11 items-center justify-center rounded-full border border-transparent text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary/50 focus-visible:bg-primary/5 aria-selected:hover:bg-primary aria-selected:hover:border-primary",
                                      day_selected:
                                        "inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground border border-primary",
                                      day_today:
                                        "inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border/60 text-foreground",
                                      day_range_start:
                                        "day-range-start inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground border border-primary",
                                      day_range_end:
                                        "day-range-end inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground border border-primary",
                                      day_range_middle:
                                        "day-range-middle inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-foreground aria-selected:!text-foreground border border-primary/20",
                                      day_outside:
                                        "pointer-events-none opacity-0 select-none",
                                      day_disabled:
                                        "opacity-40 text-muted-foreground hover:border-transparent hover:bg-transparent",
                                      day_hidden: "invisible",
                                    }}
                                  />
                                  <p className="px-5 pb-1 text-xs text-muted-foreground">
                                    Availability reflects rooms housekeeping has marked Clean or Dirty; maintenance rooms stay hidden until they&apos;re ready.
                                  </p>
                                  {(() => {
                                    const relevantClosures = propertyClosures.filter(
                                      (c) => !c.roomTypeId || c.roomTypeId === roomType?.id
                                    );
                                    if (relevantClosures.length === 0) return null;
                                    return (
                                      <div className="flex items-start gap-2 mx-5 mb-3 px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                        <div>
                                          {relevantClosures.length === 1 ? (
                                            <span>
                                              Bookings are closed from{" "}
                                              <strong>
                                                {format(new Date(relevantClosures[0].startDate + "T00:00:00"), "d MMM yyyy")}
                                              </strong>{" "}
                                              to{" "}
                                              <strong>
                                                {format(new Date(relevantClosures[0].endDate + "T00:00:00"), "d MMM yyyy")}
                                              </strong>.
                                            </span>
                                          ) : (
                                            <>
                                              <span className="font-medium">Bookings are closed during:</span>
                                              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                                                {relevantClosures.map((c, i) => (
                                                  <li key={i}>
                                                    {format(new Date(c.startDate + "T00:00:00"), "d MMM yyyy")}
                                                    {" – "}
                                                    {format(new Date(c.endDate + "T00:00:00"), "d MMM yyyy")}
                                                  </li>
                                                ))}
                                              </ul>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </PopoverContent>
                              </Popover>
                              <FormMessage className="pl-2" />
                            </FormItem>
                          );
                        }}
                      />
                      <div className="grid grid-cols-2 gap-0 divide-x">
                        {/* Guests Dropdown */}
                        <FormField
                          control={form.control}
                          name="guests"
                          render={() => (
                            <FormItem>
                              <Popover
                                open={isGuestsPopoverOpen}
                                onOpenChange={setIsGuestsPopoverOpen}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Users className="h-5 w-5 text-primary" />
                                      <div>
                                        <div className="text-xs text-gray-600 mb-1">
                                          Guests
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {guestsCount + childrenCount} guest
                                          {guestsCount + childrenCount > 1
                                            ? "s"
                                            : ""}
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronDown
                                      className={cn(
                                        "size-4 text-gray-400 transition-transform",
                                        isGuestsPopoverOpen && "rotate-180"
                                      )}
                                    />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="bottom"
                                  sideOffset={12}
                                  align="center"
                                  className="w-[min(90vw,420px)] sm:w-[380px] rounded-3xl border border-border/30 bg-white shadow-xl p-6 space-y-6"
                                >
                                  <div className="space-y-1">
                                    <h4 className="text-lg font-semibold text-foreground">
                                      Select guests
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      Choose number of adults and children
                                    </p>
                                  </div>
                                  <div className="divide-y divide-border/20">
                                    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                      <div className="flex items-center gap-3">
                                        <div className="flex lg:h-10 lg:w-10 w-8 h-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                          <Users className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <span className="block text-base font-medium text-foreground">
                                            Adults
                                          </span>
                                          <span className="block text-xs text-muted-foreground">
                                            Ages 13 or above
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center lg:gap-3">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                          onClick={() =>
                                            form.setValue(
                                              "guests",
                                              Math.max(1, guestsCount - 1)
                                            )
                                          }
                                          type="button"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-9 text-center text-base font-semibold text-foreground">
                                          {guestsCount}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                          onClick={() =>
                                            form.setValue(
                                              "guests",
                                              Math.max(
                                                1,
                                                Math.min(
                                                  totalCapacity -
                                                    childrenCount,
                                                  guestsCount + 1
                                                )
                                              ),
                                              { shouldValidate: true }
                                            )
                                          }
                                          type="button"
                                          disabled={
                                            totalCapacity === 0 ||
                                            guestsCount + childrenCount >=
                                              totalCapacity
                                          }
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <FormField
                                      control={form.control}
                                      name="children"
                                      render={({ field: childField }) => (
                                        <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                          <div className="flex items-center gap-3">
                                            <div className="flex lg:h-10 lg:w-10 w-8 h-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                              <Baby className="h-4 w-4" />
                                            </div>
                                            <div>
                                              <span className="block text-base font-medium text-foreground">
                                                Children
                                              </span>
                                              <span className="block text-xs text-muted-foreground">
                                                Ages 0 to 12
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center lg:gap-3">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                              onClick={() =>
                                                childField.onChange(
                                                  Math.max(
                                                    0,
                                                    childField.value - 1
                                                  )
                                                )
                                              }
                                              type="button"
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-9 text-center text-base font-semibold text-foreground">
                                              {childField.value}
                                            </span>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                              onClick={() =>
                                                childField.onChange(
                                                  Math.min(
                                                    childField.value + 1,
                                                    Math.max(0, maxChildrenAllowed)
                                                  )
                                                )
                                              }
                                              type="button"
                                              disabled={
                                                totalCapacity === 0 ||
                                                childField.value >=
                                                  Math.max(0, maxChildrenAllowed)
                                              }
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    />
                                  </div>
                                  <div className="pt-2 border-t border-border/20 space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                      {capacityHelperMessage}
                                    </p>
                                    {isAtTotalCapacity && (
                                      <p className="text-xs text-amber-700">
                                        Need space for more guests? Increase your room count first.
                                      </p>
                                    )}
                                    {!isAtTotalCapacity &&
                                      isAtChildCapacity &&
                                      roomType?.maxChildren !== undefined && (
                                        <p className="text-xs text-amber-700">
                                          You’ve reached the child limit for these rooms.
                                        </p>
                                      )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <FormMessage className="px-3 pb-2" />
                            </FormItem>
                          )}
                        />

                        {/* Rooms Dropdown */}
                        <FormField
                          control={form.control}
                          name="rooms"
                          render={({ field }) => (
                            <FormItem>
                              <Popover
                                open={isRoomsPopoverOpen}
                                onOpenChange={setIsRoomsPopoverOpen}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Building className="h-5 w-5 text-primary" />
                                      <div>
                                        <div className="text-xs text-gray-600 mb-1">
                                          Rooms
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {roomsCount} room
                                          {roomsCount > 1 ? "s" : ""}
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronDown
                                      className={cn(
                                        "size-4 text-gray-400 transition-transform",
                                        isRoomsPopoverOpen && "rotate-180"
                                      )}
                                    />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="bottom"
                                  sideOffset={12}
                                  align="center"
                                  className="w-[min(90vw,420px)] sm:w-[380px] rounded-3xl border border-border/30 bg-white shadow-xl p-6 space-y-6"
                                >
                                  <div className="space-y-1">
                                    <h4 className="text-lg font-semibold text-foreground">
                                      Select rooms
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      Choose number of rooms
                                    </p>
                                  </div>
                                  <div className="divide-y divide-border/20">
                                    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                      <div className="flex items-center gap-3">
                                        <div className="flex lg:h-10 lg:w-10 w-8 h-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                          <Building className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <span className="block text-base font-medium text-foreground">
                                            Rooms
                                          </span>
                                          <span className="block text-xs text-muted-foreground">
                                            Number of rooms
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center lg:gap-3">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                          onClick={() =>
                                            field.onChange(
                                              Math.max(1, field.value - 1)
                                            )
                                          }
                                          type="button"
                                          disabled={field.value <= 1}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-9 text-center text-base font-semibold text-foreground">
                                          {field.value}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="lg:h-9 lg:w-9 w-7 h-7 rounded-full border border-border/50 text-foreground transition hover:border-primary hover:text-primary disabled:border-border/30 disabled:text-border"
                                          onClick={() =>
                                            field.onChange(
                                              Math.min(
                                                maxSelectableRooms || 1,
                                                field.value + 1
                                              )
                                            )
                                          }
                                          type="button"
                                          disabled={
                                            maxSelectableRooms === 0 ||
                                            field.value >= maxSelectableRooms
                                          }
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="pt-3 text-xs text-muted-foreground">
                                    {maxSelectableRooms > 0 ? (
                                      <p>
                                        {`You can select up to ${maxSelectableRooms} room${
                                          maxSelectableRooms === 1 ? "" : "s"
                                        } for these dates.`}
                                        {isRoomsCappedByRequest && requestedRoomsLimit && (
                                          <>
                                            {" "}You originally chose {requestedRoomsLimit}; adjust your search if you need more.
                                          </>
                                        )}
                                      </p>
                                    ) : (
                                      <p>No rooms of this type are ready for the selected dates.</p>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <FormMessage className="px-3 pb-2" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Special Requests */}
                    <FormField
                      control={form.control}
                      name="specialRequests"
                      render={({ field }) => (
                        <FormItem>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-900">
                              Special Requests{" "}
                              <span className="text-gray-500 font-normal">
                                (Optional)
                              </span>
                            </label>
                            <textarea
                              {...field}
                              placeholder="Any special requests or requirements?"
                              className="w-full min-h-[80px] p-3 border border-gray-200 shadow-md hover:border-gray-300 rounded-xl resize-none text-sm focus:outline-none"
                            />
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Pricing Breakdown */}
                    {nightCount > 0 && (
                      <PricingBreakdown
                        nightlyRate={pricing.nightlyRate}
                        nights={nightCount}
                        rooms={roomsCount}
                        totalCost={pricing.totalCost}
                        taxesAndFees={pricing.taxesAndFees}
                        grandTotal={pricing.grandTotal}
                        taxesApplied={pricing.taxesApplied}
                        taxRatePercent={pricing.taxRatePercent}
                        currency={property.currency}
                      />
                    )}
                    {roomsUnavailableForDates && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <Info className="h-4 w-4" />
                        <p>
                          This room type is fully booked for at least one night in your selected range. Please adjust your dates or pick another room type.
                        </p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl"
                      disabled={!dateRange?.from || !dateRange?.to || maxSelectableRooms === 0}
                    >
                      Book now
                    </Button>

                    <p className="text-xs text-center text-gray-500">
                      You won&apos;t be charged yet. Review before payment.
                    </p>
                  </form>
                </Form>
              </div>
            </Card>
          </div>
        </div>

        {relatedRoomTypes.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold font-serif text-foreground mb-8">
              Related Rooms
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedRoomTypes.slice(0, 3).map((relatedRoomType) => (
                <RoomTypeCard
                  key={relatedRoomType.id}
                  roomType={relatedRoomType}
                  price={relatedRoomType.price}
                  hasSearched={false}
                  onSelect={() => {}}
                  isSelectionComplete={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        roomType={roomType}
        shareUrl={shareUrl}
      />
    </div>
  );
}
