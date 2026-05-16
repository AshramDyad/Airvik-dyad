import { AmenitiesHeroSection } from "@/components/marketing/amenities/HeroSection";

import { AmenitiesSectionsLoader } from "./amenities-sections-loader";

export default function AmenitiesPage() {
  return (
    <div className="bg-background text-foreground">
      <AmenitiesHeroSection />
      <AmenitiesSectionsLoader />
    </div>
  );
}
