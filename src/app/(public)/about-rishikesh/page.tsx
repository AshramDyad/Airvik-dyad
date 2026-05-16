import { RishikeshHeroSection } from "@/components/marketing/about/rishikesh-hero-section";

import { RishikeshSectionsLoader } from "./rishikesh-sections-loader";

export default function AboutRishikeshPage() {
  return (
    <div className="bg-background text-foreground">
      <RishikeshHeroSection />
      <RishikeshSectionsLoader />
    </div>
  );
}
