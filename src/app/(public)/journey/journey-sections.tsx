"use client";

import { JourneyCTA } from "@/components/marketing/journey/JourneyCTA";
import { JourneyTimeline } from "@/components/marketing/journey/JourneyTimeline";

export function JourneySections() {
  return (
    <>
      <JourneyTimeline />
      <JourneyCTA />
    </>
  );
}
