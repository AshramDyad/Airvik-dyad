"use client";

import { AboutActivitiesSection } from "@/components/marketing/about/about-activities-section";
import { AboutStorySection } from "@/components/marketing/about/about-story-section";
import { PlacesToVisitSection } from "@/components/marketing/about/places-to-visit-section";

export function AboutUsSections() {
  return (
    <>
      <AboutStorySection />
      <AboutActivitiesSection />
      <PlacesToVisitSection />
    </>
  );
}
