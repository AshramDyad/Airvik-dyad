"use client";

import { motion, type Variants } from "framer-motion";
import Image from "@/components/ui/cloudflare-image";

type LocalAmenity = {
  label: string;
  image: string;
  alt?: string;
};

const amenities: LocalAmenity[] = [
  { label: "WiFi", image: "/icons/wifi.svg" },
  { label: "Geyser", image: "/icons/Geyser.svg" },
  { label: "Air Conditioner", image: "/icons/AC.svg" },
  { label: "Front Desk", image: "/icons/Front-Desk.svg" },
  { label: "Towels", image: "/icons/Towels.svg" },
  { label: "Common Washroom", image: "/icons/Common-Washroom.svg" },
];

const meals = [
  { time: "7:00–9:00 AM", label: "Breakfast" },
  { time: "12:30–2:00 PM", label: "Lunch" },
  { time: "7:00–9:00 PM", label: "Dinner" },
];

export function EssentialAmenitiesGrid() {
  const gridVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <section className="py-10 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <motion.div
            className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
            variants={gridVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {amenities.map(({ label, image, alt }, index) => (
              <motion.div
                key={`${label}-${index}`}
                className="group flex h-full flex-col items-center justify-center rounded-2xl border border-border/80 bg-background px-5 py-4 text-center shadow-sm transition-shadow duration-200 hover:shadow-md"
                variants={cardVariants}
              >
                <div className="flex size-12 items-center justify-center rounded-full border border-orange-500 bg-orange-50 text-primary sm:size-14 lg:size-16">
                  <Image
                    src={image}
                    alt={alt ?? label}
                    width={40}
                    height={40}
                    className="size-8 object-contain sm:size-10"
                  />
                </div>
                <span className="mt-3 text-sm font-semibold text-foreground sm:text-base">
                  {label}
                </span>
              </motion.div>
            ))}
          </motion.div>
          <motion.aside
            className="flex flex-col justify-between rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-orange-100 p-4 shadow-md sm:p-6"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground sm:text-2xl">
                  Satvik Bhojan Free with Rooms
                </h3>
                <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  Free
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Nourishing vegetarian meals prepared with sattvic ingredients
                served fresh daily.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:mt-8">
              {meals.map(({ time, label }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-2xl border border-orange-200 bg-white/70 px-4 py-3 text-sm font-medium text-foreground shadow-sm backdrop-blur sm:px-5 sm:py-4 sm:text-base"
                >
                  <span className="text-muted-foreground">{time}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
