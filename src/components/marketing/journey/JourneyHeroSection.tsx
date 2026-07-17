"use client";

import Image from "@/components/ui/cloudflare-image";
import { motion } from "framer-motion";

export function JourneyHeroSection() {
  return (
    <section className="relative w-full h-[70vh] min-h-[500px]">
      <Image
        src="/rishikesh-ahsram.jpeg"
        alt="Sahajanand Ashram Journey"
        fill
        style={{ objectFit: "cover" }}
        priority
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold font-serif leading-tight mb-6">
            Our Journey
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl md:text-2xl font-medium text-primary-foreground/90 max-w-3xl mx-auto"
          >
            The story of Sahajanand Ashram from 1987 to present
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
