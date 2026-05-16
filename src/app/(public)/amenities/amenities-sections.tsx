"use client";

import { DailyRhythmSection } from "@/components/marketing/amenities/DailyRhythmSection";
import { EssentialAmenitiesGrid } from "@/components/marketing/amenities/EssentialAmenitiesGrid";

export function AmenitiesSections() {
  return (
    <>
      <EssentialAmenitiesGrid />
      <DailyRhythmSection />
    </>
  );
}
