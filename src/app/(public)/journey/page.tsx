import { JourneyHeroSection } from "@/components/marketing/journey/JourneyHeroSection";

import { JourneySectionsLoader } from "./journey-sections-loader";

export default function JourneyPage() {
  return (
    <div className="bg-background text-foreground">
      <JourneyHeroSection />
      <JourneySectionsLoader />
    </div>
  );
}
