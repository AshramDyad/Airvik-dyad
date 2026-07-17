"use client";

import Image from "@/components/ui/cloudflare-image";
import { motion } from "framer-motion";

export function SunilBhagatMessageSection() {
  return (
    <section className="py-10 lg:py-28 md:py-18 bg-muted/50">
      <div className="container mx-auto px-4">
        {/* Centered Heading */}
        <motion.div
          className="text-center mb-6 lg:mb-16 md:mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight">
            Swami&apos;s Message
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          transition={{ staggerChildren: 0.3 }}
        >
          {/* Content Column */}
          <motion.div
            className="space-y-6 text-lg text-muted-foreground text-center lg:text-left"
            variants={{
              hidden: { x: -20, opacity: 0 },
              visible: {
                x: 0,
                opacity: 1,
                transition: { duration: 0.8, ease: "easeOut" },
              },
            }}
          >
            <p>
            Live with a steady purpose and let selfless service (karma yoga) be your daily practice: be kind, work diligently, follow dharma, and help others without expectation — small acts of giving, honest effort, and joining in satsang, aarti, or community service will purify the heart, strengthen the mind, and bring true, lasting happiness; remain humble, persistent, and disciplined, and let your actions be your prayer.
            </p>
          </motion.div>

          {/* Image Column */}
          <motion.div
            variants={{
              hidden: { x: 20, opacity: 0 },
              visible: {
                x: 0,
                opacity: 1,
                transition: { duration: 0.8, ease: "easeOut" },
              },
            }}
          >
            <Image
              src="/Message-img.png"
              alt="Swami&apos;s Message"
              width={500}
              height={600}
              className="rounded-lg shadow-xl w-full h-auto object-cover"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
