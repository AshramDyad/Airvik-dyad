import Image from "next/image";
import { format } from "date-fns";
import { Calendar, MapPin } from "lucide-react";

import type { Metadata } from "next";
import { getHomepageBanner, getUpcomingEvents } from "@/lib/server/events";
import { EventCard } from "@/components/marketing/events/EventCard";
import { Badge } from "@/components/ui/badge";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Events & Festivals",
  description:
    "Join upcoming spiritual events, festivals and celebrations at Sahajanand Wellness ashram on the banks of the Ganges in Rishikesh — Ganga Aarti, satsang and community gatherings.",
  path: "/events",
});

export default async function EventsPublicPage() {
  const activeEvent = await getHomepageBanner();
  const upcomingEvents = await getUpcomingEvents();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section - Active Event */}
      {activeEvent ? (
        <section className="relative w-full bg-muted/30">
          <div className="container mx-auto px-4 py-12 md:py-20">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="space-y-6">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none text-sm px-3 py-1">
                  Featured Event
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:leading-tight text-primary">
                  {activeEvent.title}
                </h1>
                {activeEvent.description && (
                  <p className="text-lg text-muted-foreground md:text-xl leading-relaxed max-w-2xl">
                    {activeEvent.description}
                  </p>
                )}
                {activeEvent.startsAt && (
                   <div className="flex flex-wrap items-center gap-6 text-base font-medium text-foreground/80">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span>{format(new Date(activeEvent.startsAt), "MMMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <MapPin className="h-5 w-5 text-primary" />
                         <span>Swaminarayan Ashram</span>
                      </div>
                   </div>
                )}
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-border/50">
                <Image
                  src={activeEvent.imageUrl}
                  alt={activeEvent.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-primary/5 py-16 md:py-24">
            <div className="container px-4 text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-primary">
                    Upcoming Events
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Stay tuned for spiritual gatherings and community celebrations at Swaminarayan Ashram.
                </p>
            </div>
        </section>
      )}

      {/* Upcoming Events Grid */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="space-y-10">
          {activeEvent && (
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">More Upcoming Events</h2>
              </div>
          )}
          
          {upcomingEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              <Calendar className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No upcoming events scheduled at the moment.</p>
              <p>Please check back later.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
