"use client";

import { motion } from "framer-motion";
import { ExperienceCard } from "./experience-card";
import { Sparkles, Backpack, Landmark } from "lucide-react";
import Image from "next/image";

const experiences = [
  {
    title: "Spirituality",
    description: "Daily rituals, meditations, and Ashrams along the Ganga.",
    Icon: Sparkles,
  },
  {
    title: "Adventure",
    description: "Rafting, trekking, and Himalayan escapes for all levels.",
    Icon: Backpack,
  },
  {
    title: "Culture",
    description: "Temples, traditions, and vibrant festivals of Rishikesh.",
    Icon: Landmark,
  },
];

export function RishikeshExperienceSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <section className="relative py-10 sm:py-12" id="#rishikesh-story">
      <Image
        src="/rih.png"
        alt="Ganga river in Rishikesh"
        fill
        sizes="100vw"
        className="object-cover"
        quality={90}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-primary leading-tight">
          Rishikesh Snapshot
          </h2>
          <p className="text-lg text-white max-w-3xl mx-auto mt-4">
            Discover the core pillars of transformation that await you in this
            sacred land.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {experiences.map((experience) => (
            <motion.div key={experience.title} variants={itemVariants}>
              <ExperienceCard
                title={experience.title}
                description={experience.description}
                Icon={experience.Icon}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
