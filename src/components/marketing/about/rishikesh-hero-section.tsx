"use client";

import Link from "next/link";
import Image from "@/components/ui/cloudflare-image";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";

export function RishikeshHeroSection() {
  const contentVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const imageVariants: Variants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 },
    },
  };

  return (
    <section className="bg-background py-10 sm:py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="grid lg:grid-cols-2 gap-12 items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.div variants={contentVariants} className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              About Rishikesh
            </p>

            <h1 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
              <span className="block sm:inline lg:block">The Spiritual Gateway</span>
              <span className="sm:inline lg:block"> to the Himalayas</span>
            </h1>

            <p className="text-base text-muted-foreground md:text-lg">
              Nestled along the sacred Ganga River, Rishikesh is a timeless
              sanctuary for seekers of peace, wisdom, and inner transformation.
              Surrounded by the majestic Himalayas, it offers serene ashrams,
              sacred ghats, and the divine energy that awakens the soul. From
              morning chants to evening Ganga Aarti, every moment here reflects
              harmony between nature and spirituality.
            </p>
            <div>
              <Button asChild size="lg">
                <Link href="#rishikesh-experience">
                  Explore the Spirit of Rishikesh
                </Link>
              </Button>
            </div>
          </motion.div>
          
          <motion.div variants={imageVariants} className="relative">
            <div className="relative rounded-xl overflow-hidden">
              <Image
                src="/ram-lkshmanjula.webp"
                alt="Rishikesh riverside view"
                width={600}
                height={400}
                className="object-cover aspect-[3/2] rounded-2xl w-full"
                priority
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
