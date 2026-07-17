"use client";

import Image from "@/components/ui/cloudflare-image";
import { motion } from "framer-motion";

export function SunilBhagatBioSection() {
  return (
    <section className="py-10 lg:py-28 md:py-18 bg-background">
      <div className="container mx-auto px-4">
        {/* Centered Heading */}
        <motion.div
          className="text-center lg:mb-16 md:mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight mb-6">
            SwamiShri&apos;s life
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          transition={{ staggerChildren: 0.3 }}
        >
          {/* Image Column */}
          <motion.div
            className="order-2 lg:order-1"
            variants={{
              hidden: { x: -20, opacity: 0 },
              visible: {
                x: 0,
                opacity: 1,
                transition: { duration: 0.8, ease: "easeOut" },
              },
            }}
          >
            <Image
              src="/about-img.png"
              alt="Sunil Bhagat"
              width={500}
              height={600}
              className="rounded-lg shadow-xl w-full h-80
               object-cover"
            />
          </motion.div>

          {/* Content Column */}
          <motion.div
            className="order-1 lg:order-2 space-y-6 text-lg text-muted-foreground text-center lg:text-left"
            variants={{
              hidden: { x: 20, opacity: 0 },
              visible: {
                x: 0,
                opacity: 1,
                transition: { duration: 0.8, ease: "easeOut" },
              },
            }}
          >
            <p>
              Guiding the ashram&apos;s spiritual journey is{" "}
              <span className="font-semibold text-foreground">
                Sunil Bhagat
              </span>
              , affectionately known as Swami. His profound wisdom and
              compassionate teachings inspire all who visit, making the ashram a
              beacon of peace and service. Swami&apos;s journey is one of deep
              devotion, dedicated to sharing timeless wisdom. He emphasizes
              love, compassion, and a balanced life, helping seekers find inner
              peace and connect with their true selves.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
