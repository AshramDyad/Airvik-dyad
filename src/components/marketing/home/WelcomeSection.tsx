"use client";

import React from "react";
import Image from "@/components/ui/cloudflare-image";
import { ActivityCard } from "@/components/marketing/home/ActivityCard";
import { motion, type Variants } from "framer-motion";

const activities = [
  {
    title: "Gaushala",
    description: "A sanctuary for cows, embodying selfless service.",
    imageUrl: "/Gaushala.jpeg",
    href: "/about-us",
  },
  {
    title: "Veda-Pathshala",
    description: "Preserving ancient wisdom through Vedic education.",
    imageUrl: "/veda4.webp",
    href: "/about-us",
  },
  {
    title: "Annakshetra",
    description:
      "Serving humanity through daily, wholesome meals for all visitors and the local community.",
    imageUrl: "/annakshetra.png",
    href: "/about-us",
  },
  {
    title: "Ganga Aarti",
    description: "Experience the divine evening ceremony on our ghat.",
    imageUrl: "/ganga-arti.jpg",
    href: "/about-us",
  },
];

const serviceBadges = [
  { label: "Yoga & Meditation" },
  { label: "Ganga Aarti" },
  { label: "Vedic Learning" },
  { label: "Sacred Service" },
];

export function WelcomeSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const imageVariants: Variants = {
    hidden: { x: -20, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const textVariants: Variants = {
    hidden: { x: 20, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: 0.15,
      },
    },
  };

  return (
    <>
      <section className="bg-background py-10 sm:py-12 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            transition={{ staggerChildren: 0.3 }}
          >
            <motion.div
              variants={imageVariants}
              className="order-2 lg:order-1"
            >
              <Image
                src="/rishikesh-ahsram.jpeg"
                alt="Sahajanand Wellness Ashram in Rishikesh"
                width={700}
                height={500}
                className="relative h-auto sm:h-[450px] md:h-[500px] rounded-2xl w-full object-cover"
                priority
              />
            </motion.div>

            <motion.div
              variants={textVariants}
              className="order-1 lg:order-2"
            >
              <motion.div variants={itemVariants} className="text-center lg:text-left space-y-4">
                <div>
                  <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                    Welcome Home
                  </span>
                </div>

                <h2 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
                  <span className="block sm:inline lg:block">A Sacred Space for</span>
                  <span className="sm:inline lg:block"> the Welfare of All</span>
                </h2>

                <p className="text-base text-muted-foreground md:text-lg">
                  Sahajanand Wellness is a registered religious trust on the banks of the Ganges at Muni-Ki-Reti, Rishikesh. It offers simple dharmshala stays, yoga, daily Ganga Aarti and community services (langar, Vedic classes, gaushala) for pilgrims and spiritual seekers.
                </p>

              </motion.div>

              <motion.div
                variants={itemVariants}
                className="sm:flex flex-wrap justify-center lg:justify-start gap-3 mt-4 hidden"
              >
                {serviceBadges.map((badge) => (
                  <div
                    key={badge.label}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-background border border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary group-hover:scale-125 transition-transform duration-300" />
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </motion.div>

            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Ashram Activities Section */}
      <section className="bg-gradient-to-b from-background to-secondary/60 py-10 sm:py-12">
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
                src="/swaminarayan-logo-1.png"
                alt="Sahajanand Wellness"
                width={40}
                height={40}
                className="w-10 h-10 object-contain"
              />
            </div>
            <h2 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
              Our Sacred Activities
            </h2>
            <p className="text-base text-muted-foreground md:text-lg max-w-xl mx-auto">
              At the heart of our ashram are activities dedicated to service,
              learning, and spiritual growth.
            </p>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {activities.map((activity) => (
              <motion.div key={activity.title} variants={itemVariants}>
                <ActivityCard
                  key={activity.title}
                  title={activity.title}
                  description={activity.description}
                  imageUrl={activity.imageUrl}
                  href={activity.href}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
