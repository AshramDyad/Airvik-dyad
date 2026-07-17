"use client";

import { motion } from "framer-motion";
import Image from "@/components/ui/cloudflare-image";
import { cn } from "@/lib/utils";
import { FaArrowRightLong } from "react-icons/fa6";

interface TimelineEvent {
  title: string;
  description: string[];
  image?: string;
  link?: {
    text: string;
    url: string;
  };
}

interface TimelineYear {
  year: string;
  events: TimelineEvent[];
}

const timelineData: TimelineYear[] = [
  {
    year: "2020",
    events: [
      {
        title: "Global Virtual Satsang Launch",
        description: [
          "Launched our first global virtual satsang platform, connecting seekers from over 25 countries.",
          "The initiative helped bring the ashram's teachings to thousands of homes during challenging times, maintaining our spiritual community's bond.",
        ],
        image: "/s-1.webp",
      },
    ],
  },
  {
    year: "2018",
    events: [
      {
        title: "Inauguration of Dhyana Hall",
        description: [
          "The new Dhyana Hall was consecrated, capable of hosting 500 meditators comfortably.",
          "Constructed using sustainable materials and traditional architecture to enhance the meditative energy.",
        ],
        image: "/yoga-ashram.png",
        link: { text: "View Gallery", url: "/ashram-glimpse" },
      },
    ],
  },
  {
    year: "2015",
    events: [
      {
        title: "First International Yoga Retreat",
        description: [
          "Hosted our inaugural international yoga retreat, welcoming participants from Europe and North America.",
          "A week-long immersion into Hatha Yoga, Pranayama, and Vedic chanting.",
        ],
        image: "/sunil-bhagat-yoga.jpeg",
      },
    ],
  },
  {
    year: "2010",
    events: [
      {
        title: "Foundation of the Ashram",
        description: [
          "The ashram was founded on the banks of the holy river, starting with just a small kutir and a handful of dedicated disciples.",
          "The vision was to create a sanctuary for spiritual growth and self-discovery.",
        ],
        image: "/rishikesh-ahsram.jpeg",
      },
    ],
  },
];

export function JourneyTimeline() {
  return (
    <section className="py-16 bg-background overflow-hidden">
      <div className="container mx-auto px-4 relative">
        {/* Central Vertical Line - Desktop */}
        <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-primary block" />

        {/* Central Vertical Line - Mobile */}
        {/* <div className="absolute left-8 top-0 bottom-0 w-1 bg-primary block md:hidden" /> */}

        {timelineData.map((yearGroup, yearIndex) => (
          <div key={yearGroup.year} className="mb-12 relative">
            {/* Year Heading */}
            <div className="flex justify-center mb-12 relative z-10">
              <span className="bg-primary text-white px-6 py-2 rounded-full text-xl font-bold shadow-md border-4 border-white">
                {yearGroup.year}
              </span>
            </div>

            <div className="relative">
              {yearGroup.events.map((event, eventIndex) => {
                // Calculate continuous global index across all years
                const previousEventsCount = timelineData
                  .slice(0, yearIndex)
                  .reduce((acc, curr) => acc + curr.events.length, 0);
                const globalIndex = previousEventsCount + eventIndex;

                // First card (globalIndex 0) should be on the Right (isLeft = false)
                // Even index = Right, Odd index = Left
                const isLeft = globalIndex % 2 !== 0;

                return (
                  <TimelineItem
                    key={`${yearGroup.year}-${eventIndex}`}
                    event={event}
                    isLeft={isLeft}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelineItem({
  event,
  isLeft,
}: {
  event: TimelineEvent;
  isLeft: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full mb-8 md:mb-10 relative",
        // Mobile: always start from left (with some padding for line)
        // Desktop: justify-start or justify-end based on isLeft
        "md:justify-between",
        isLeft ? "md:flex-row" : "md:flex-row-reverse"
      )}
    >
      {/* Mobile: The spacer for the line is handled by padding/margin on the item wrapper or absolute positioning */}

      {/* Content Card */}
      <motion.div
        initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn(
          "relative md:w-[45%] w-full ml-0 p-4 bg-white rounded-xl shadow-sm border border-gray-100",
          // Arrow on Desktop
          "before:hidden md:before:block before:absolute before:top-6 before:w-4 before:h-4 before:bg-white before:border-gray-100 before:transform before:rotate-45",
          isLeft
            ? "before:-right-2 before:border-t before:border-r"
            : "before:-left-2 before:border-b before:border-l"
        )}
      >
        {/* Connector Dot - Desktop */}
        <div
          className={cn(
            "hidden md:block absolute top-5 -translate-x-1 size-5 rounded-full border-2 border-primary z-10",
            isLeft
              ? "bg-primary -right-[calc(11.1%+15px)]"
              : "bg-primary -left-[calc(11.1%+8px)]"
            // 50% (center) - 45% (width) = 5% gap.
            // We want dot at center.
            // If width is 45%, right edge is at 45%. Center is at 50%. Distance is 5% of container width.
            // 5% of container / 45% of self = 1/9 = ~11.1% of self.
            // Adjusting for element widths.
          )}
        />

        {/* Connector Dot - Mobile */}
        {/* <div className="md:hidden absolute top-8 -left-[38px] w-4 h-4 rounded-full bg-primary border-2 border-primary  z-10" /> */}

        {/* Connector Arrow - Mobile */}
        {/* <div className="md:hidden absolute top-8 -left-2 w-4 h-4 bg-white border-b border-l border-gray-100 transform rotate-45" /> */}

        {event.image && (
          <div className="mb-4 relative h-60 w-full overflow-hidden rounded-xl bg-gray-100">
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <h3 className="text-lg font-bold text-gray-700 mb-2">{event.title}</h3>

        <div className="space-y-2 text-gray-600">
          {event.description.map((desc, i) => (
            <p key={i}>{desc}</p>
          ))}
        </div>

        {event.link && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <a
              href={event.link.url}
              className="text-primary font-medium inline-flex items-center gap-2 transition-colors group"
            >
              {event.link.text}
              <span><FaArrowRightLong className="group-hover:translate-x-3 transition-transform"/></span>
            </a>
          </div>
        )}
      </motion.div>

      {/* Empty spacer for the other side on desktop to maintain flex layout structure */}
      <div className="hidden md:block w-[45%]" />
    </div>
  );
}
