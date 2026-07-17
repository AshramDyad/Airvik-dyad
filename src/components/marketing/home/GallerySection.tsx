"use client";

import React from "react";
import Image from "@/components/ui/cloudflare-image";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const galleryImages = [
  {
    src: "/Trayambakeshwar_Temple_VK.jpg",
    alt: "Exterior view of the Sahajanand Wellness ashram building",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    src: "/ganga-rishikesh.jpg",
    alt: "Ganga Aarti ceremony with a large crowd",
  },
  {
    src: "/havan.png",
    alt: "The dining hall (Annakshetra) at the ashram",
  },
  {
    src: "/ved-pathsala.png",
    alt: "Priests performing the Ganga Aarti at night",
  },
  {
    src: "/gallery-room-05-2-1.png",
    alt: "A spiritual ceremony taking place at the ashram",
    className: "hidden md:block",
  },
];

/**
 * Renders the "Glimpses of Serenity" gallery section with animated image tiles.
 *
 * The section includes a centered heading and subtitle, a small decorative image,
 * and a responsive grid of images that animate into view with staggered entrance
 * and scale/fade effects.
 *
 * @returns A React element containing the gallery section markup and animations.
 */
export function GallerySection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <section className="bg-background py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex justify-center">
            <Image
              src="/om.png"
              alt="Sahajanand Wellness"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
          </div>
          <h2 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
            Glimpses of Serenity
          </h2>
          <p className="text-base text-muted-foreground md:text-lg max-w-3xl mx-auto">
            A visual journey through the sacred spaces and moments at Sahajanand
            Wellness.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 auto-rows-[250px] gap-4 mt-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {galleryImages.map((image, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={cn(
                "relative overflow-hidden rounded-2xl shadow-lg group",
                image.className
              )}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
