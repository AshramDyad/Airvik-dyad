import Image from "next/image";

export function JourneyHeroSection() {
  return (
    <section className="relative w-full h-[70vh] min-h-[500px]">
      <Image
        src="/rishikesh-ahsram.jpeg"
        alt="Sahajanand Ashram Journey"
        fill
        style={{ objectFit: "cover" }}
        quality={100}
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white px-4">
        <div className="max-w-4xl">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold font-serif leading-tight mb-6">
            Our Journey
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-primary-foreground/90 max-w-3xl mx-auto">
            The story of Sahajanand Ashram from 1987 to present
          </p>
        </div>
      </div>
    </section>
  );
}
