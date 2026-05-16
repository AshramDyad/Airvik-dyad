import { AboutHeroSection } from "@/components/marketing/about/about-hero-section";

import { AboutUsSectionsLoader } from "./about-us-sections-loader";

export default function AboutUsPage() {
  return (
    <div className="bg-background text-foreground">
      <AboutHeroSection />
      <AboutUsSectionsLoader />
    </div>
  );
}
