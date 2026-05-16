import Image from "next/image";

/**
 * Renders a static amenities hero with an image overlay, headline, and subtitle.
 *
 * @returns The JSX element containing the hero layout.
 */
export function AmenitiesHeroSection() {
  const heroImagePath = "/Standard-Room.png";
  
  return (
    <section className="relative overflow-hidden bg-muted">
      <div className="absolute inset-0">
        <Image
          src={heroImagePath}
          alt="Handpicked pieces for mindful living"
          fill
          priority
          quality={100}
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black/45" />
      <div className="container mx-auto relative px-4 md:px-6 z-10">
        <div className="flex flex-col items-center gap-4 py-24 text-center text-white md:py-32">
          <h1 className="2xl:text-5xl md:text-4xl text-3xl font-bold">
            Peaceful Comforts
          </h1>
          <p className="text-base text-white/80 md:text-lg max-w-3xl">
            Find peace and comfort in our sacred spaces and mindful facilities.
          </p>
        </div>
      </div>
    </section>
  );
}
