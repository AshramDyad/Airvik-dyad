"use client";

import Image from "@/components/ui/cloudflare-image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Button } from "@/components/ui/button";

const placesToVisit = [
  {
    title: "Triveni Ghat",
    imageUrl: "/triveni-ghat-rishikesh-uttarakhand.jpg",
    description:
      "The biggest and most famous ghat in Rishikesh, known for its evening Ganga Aarti.",
  },
  {
    title: "Ganga Aarti",
    imageUrl: "/rishikesh-ganga-aarti-.png",
    description:
      "A mesmerizing ritual of worship with lamps, chants, and prayers on the banks of the Ganga.",
  },
  {
    title: "Lakshman Jhula | Ram Jhula",
    imageUrl: "/ram-lkshmanjula.webp",
    description:
      "Iconic suspension bridges offering stunning views of the river and surrounding temples.",
  },
];

export function PlacesToVisitSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <section className="bg-background py-10 sm:py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section Title */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Explore Rishikesh
          </span>
          <h2 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
            Places to Visit
          </h2>
          <p className="text-base text-muted-foreground md:text-lg max-w-xl mx-auto">
            Discover the spiritual and natural attractions that make Rishikesh a world-renowned destination.
          </p>
        </motion.div>

        {/* Places - Circular Images */}
        <motion.div
          className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-6 lg:gap-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {placesToVisit.map((place) => (
            <motion.div 
              key={place.title} 
              variants={itemVariants}
              className="flex flex-col items-center max-w-xs"
            >
              {/* Circular Image */}
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 lg:w-52 lg:h-52 rounded-full overflow-hidden mb-4">
                <Image
                  src={place.imageUrl}
                  alt={place.title}
                  fill
                  sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 160px"
                  className="object-cover"
                />
              </div>
              
              {/* Text Below */}
              <div className="text-center">
                <h3 className="text-xl font-serif font-bold text-foreground mb-2">
                  {place.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {place.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* View All Button */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
        >
          <Button asChild size="lg">
            <Link href="/about-rishikesh">View All Places</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}