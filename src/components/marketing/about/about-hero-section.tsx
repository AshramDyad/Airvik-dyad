import Image from "next/image";
import { Button } from "@/components/ui/button";

export function AboutHeroSection() {
  return (
    <section className="bg-background py-10 sm:py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Main Content */}
          <div className="space-y-4">
            {/* Eyebrow */}
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              About Sahajanand Wellness
            </p>

            {/* Headline */}
            <h1 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
              <span className="block sm:inline lg:block">A Trust for Service,</span>
              <span className="sm:inline lg:block"> Learning & Shelter</span>
            </h1>

            {/* Body Copy */}
            <p className="text-base text-muted-foreground md:text-lg">
              Run by a registered religious trust in Muni-Ki-Reti, this ashram provides simple riverside dharmashala accommodation, yogashala and Vedic study programs. Meals are served in the langar hall; the centre holds daily Ganga Aarti and community seva activities all sustained by donations.
            </p>

            {/* CTA */}
            <div>
              <Button asChild size="lg">
                <a href="#our-story">Explore Our Story</a>
              </Button>
            </div>
          </div>

          {/* Right Column: Image */}
          <div className="relative">
            <div className="relative rounded-xl overflow-hidden">
              <Image
                src="/rishikesh-ahsram.jpeg"
                alt="Sahajanand Wellness Ashram"
                width={600}
                height={400}
                className="object-cover aspect-[3/2] rounded-2xl w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
