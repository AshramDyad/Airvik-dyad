import type { Metadata } from "next";
import { AmenitiesHeroSection } from "@/components/marketing/amenities/HeroSection";
import { DailyRhythmSection } from "@/components/marketing/amenities/DailyRhythmSection";
import { EssentialAmenitiesGrid } from "@/components/marketing/amenities/EssentialAmenitiesGrid";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Ashram Amenities & Facilities",
  description:
    "Explore the amenities at Sahajanand Wellness ashram, Rishikesh — clean, comfortable rooms, vegetarian meals (annakshetra), daily yoga and meditation, Ganga Aarti, gaushala and free Wi‑Fi for a peaceful, affordable stay.",
  path: "/amenities",
});

export default function AmenitiesPage() {
  return (
    <div className="bg-background text-foreground">
      <AmenitiesHeroSection />
      <EssentialAmenitiesGrid />
      <DailyRhythmSection />
    </div>
  );
}