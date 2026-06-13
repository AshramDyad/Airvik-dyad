import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar, Clock, HelpCircle, Phone } from "lucide-react";

export function BookingPolicies() {
  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Important Information</h3>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="cancellation" className="border-b">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-left font-medium">Cancellation Policy</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pl-8 text-sm text-gray-600">
              <p><strong className="text-gray-900">Cancel 7 or more days before check-in:</strong> 50% refund of total booking amount</p>
              <p>Cancel less than 7 days before check-in: No refund</p>
              <p>No-show: No refund</p>
              <p className="text-xs text-gray-500 mt-2">
                Cancellation requests must be made in writing through your booking confirmation email or by contacting support.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="checkin" className="border-b">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-left font-medium">Check-in Requirements</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pl-8 text-sm text-gray-600">
              <p><strong className="text-gray-900">Check-in:</strong> 12:00 PM </p>
              <p><strong className="text-gray-900">Check-out:</strong> Before 10:00 AM </p>
              <p><strong className="text-gray-900">Required documents:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Valid government-issued photo ID (Aadhaar, Passport, Driver&apos;s License)</li>
                <li>Booking confirmation (email or SMS)</li>
              </ul>
              <p><strong className="text-gray-900">Age requirement:</strong> Guests must be 18 years or older</p>
              <p className="text-xs text-gray-500 mt-2">
                Early check-in or late check-out may be available upon request, subject to availability.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="support" className="border-b">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <span className="text-left font-medium">Need Help?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pl-8 text-sm text-gray-600">
              <p><strong className="text-gray-900">Contact Support</strong></p>
              <p>Phone: <a href="tel:+919876543210" className="text-primary hover:underline">+91 98765 43210</a></p>
              <p>Email: <a href="mailto:support@sahajanandwellness.com" className="text-primary hover:underline">support@sahajanandwellness.com</a></p>
              <p><strong className="text-gray-900">Support hours:</strong> 9:00 AM - 9:00 PM IST (7 days a week)</p>
              <p className="text-xs text-gray-500 mt-2">
                For urgent matters outside support hours, please call our 24/7 emergency line.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="property-rules">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-primary" />
              <span className="text-left font-medium">Property Rules</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pl-8 text-sm text-gray-600">
              <ul className="list-disc list-inside space-y-2">
                <li>No smoking inside rooms (designated outdoor smoking areas available)</li>
                <li>Quiet hours: 10:00 PM - 7:00 AM</li>
                <li>No outside guests allowed in rooms after 9:00 PM</li>
                <li>Pets not allowed</li>
                <li>Alcohol consumption permitted in designated areas only</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Violation of property rules may result in immediate termination of stay without refund.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
