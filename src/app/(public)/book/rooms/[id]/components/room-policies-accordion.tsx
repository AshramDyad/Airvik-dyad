"use client";

import { Clock, Info, ParkingCircle } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function RoomPoliciesAccordion() {
  return (
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
              <span className="ml-2 font-medium">Before 10:00 AM</span>
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
            <p>Valid government-issued photo ID required at check-in</p>
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
  );
}
