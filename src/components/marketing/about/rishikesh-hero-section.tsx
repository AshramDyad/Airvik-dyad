import Image from "next/image";
import { Button } from "@/components/ui/button";

export function RishikeshHeroSection() {
  return (
    <section className="bg-background py-10 sm:py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              About Rishikesh
            </p>

            <h1 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
              <span className="block sm:inline lg:block">The Spiritual Gateway</span>
              <span className="sm:inline lg:block"> to the Himalayas</span>
            </h1>

            <p className="text-base text-muted-foreground md:text-lg">
              Nestled along the sacred Ganga River, Rishikesh is a timeless
              sanctuary for seekers of peace, wisdom, and inner transformation.
              Surrounded by the majestic Himalayas, it offers serene ashrams,
              sacred ghats, and the divine energy that awakens the soul. From
              morning chants to evening Ganga Aarti, every moment here reflects
              harmony between nature and spirituality.
            </p>
            <div>
              <Button asChild size="lg">
                <a href="#rishikesh-experience">
                  Explore the Spirit of Rishikesh
                </a>
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <div className="relative rounded-xl overflow-hidden">
              <Image
                src="/ram-lkshmanjula.webp"
                alt="Rishikesh riverside view"
                width={600}
                height={400}
                className="object-cover aspect-[3/2] rounded-2xl w-full"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
